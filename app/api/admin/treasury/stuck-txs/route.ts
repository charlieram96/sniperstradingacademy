/**
 * GET /api/admin/treasury/stuck-txs
 *
 * Lists pending transactions broadcast by the gas-tank wallet that haven't been mined.
 * Used by the admin financials page to surface funding-pipeline stalls (e.g. a Polygon
 * gas-price spike strands a tx, blocking every subsequent nonce). Superadmin-only.
 */

import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { roleRank } from '@/lib/admin/permissions';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET() {
  try {
    const authSupabase = await createClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await authSupabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await authSupabase
      .from('users')
      .select('role, permissions')
      .eq('id', authUser.id)
      .single();

    if (!(roleRank(userData?.role) >= roleRank('superadmin') || (userData?.permissions ?? []).includes('manage_payouts'))) {
      return NextResponse.json(
        { error: 'Access denied. Superadmin only.' },
        { status: 403 }
      );
    }

    const gasTankPrivateKey = process.env.GAS_TANK_PRIVATE_KEY;
    if (!gasTankPrivateKey) {
      return NextResponse.json({ error: 'Gas tank not configured' }, { status: 500 });
    }

    const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(gasTankPrivateKey, provider);
    const gasTankAddress = wallet.address;

    const [confirmedNonce, pendingNonce, feeData, polBalance] = await Promise.all([
      provider.getTransactionCount(gasTankAddress, 'latest'),
      provider.getTransactionCount(gasTankAddress, 'pending'),
      provider.getFeeData(),
      provider.getBalance(gasTankAddress),
    ]);

    const currentMaxFee = feeData.maxFeePerGas ?? BigInt(0);

    // Pull funding_sent users with their funding tx hashes so we can link nonces to users.
    const supabase = createServiceRoleClient();
    const { data: fundingSentUsers } = await supabase
      .from('users')
      .select('id, email, crypto_deposit_address, sweep_funding_tx, sweep_funded_at, sweep_usdc_balance')
      .eq('sweep_status', 'funding_sent')
      .not('sweep_funding_tx', 'is', null);

    type FundingUser = {
      id: string;
      email: string;
      crypto_deposit_address: string;
      sweep_funding_tx: string | null;
      sweep_funded_at: string | null;
      sweep_usdc_balance: number | string | null;
    };

    type StuckTx = {
      nonce: number;
      hash: string;
      to: string | null;
      valuePol: string;
      ageSeconds: number | null;
      originalMaxFeeGwei: number;
      currentGasPriceGwei: number;
      needsBump: boolean;
      linkedUserId: string | null;
      linkedUserEmail: string | null;
      linkedUsdcBalance: string | null;
    };

    // Pre-fetch every funding_sent user's tx once, then index by nonce. Avoids an O(N*M)
    // RPC fan-out when there are many stuck nonces.
    const fundingTxByNonce = new Map<number, { user: FundingUser; tx: ethers.TransactionResponse }>();
    if (fundingSentUsers) {
      const lookups = await Promise.all(
        fundingSentUsers.map(async (u) => {
          if (!u.sweep_funding_tx) return null;
          const tx = await provider.getTransaction(u.sweep_funding_tx).catch(() => null);
          return tx ? { user: u as FundingUser, tx } : null;
        })
      );
      for (const entry of lookups) {
        if (entry) fundingTxByNonce.set(entry.tx.nonce, entry);
      }
    }

    const stuckTxs: StuckTx[] = [];
    const currentGasPriceGwei = Number(ethers.formatUnits(currentMaxFee, 'gwei'));

    for (let nonce = confirmedNonce; nonce < pendingNonce; nonce++) {
      const match = fundingTxByNonce.get(nonce);

      // If nothing matched in DB the nonce is still in the gap (probably a payout or other
      // tx) — surface it without the original-fee diagnostic.
      if (!match) {
        stuckTxs.push({
          nonce,
          hash: '',
          to: null,
          valuePol: '0',
          ageSeconds: null,
          originalMaxFeeGwei: 0,
          currentGasPriceGwei,
          needsBump: true,
          linkedUserId: null,
          linkedUserEmail: null,
          linkedUsdcBalance: null,
        });
        continue;
      }

      const { user: matchedUser, tx } = match;
      const originalMaxFee = tx.maxFeePerGas ?? tx.gasPrice ?? BigInt(0);
      const ageSeconds = matchedUser.sweep_funded_at
        ? Math.round((Date.now() - new Date(matchedUser.sweep_funded_at).getTime()) / 1000)
        : null;

      stuckTxs.push({
        nonce,
        hash: matchedUser.sweep_funding_tx ?? '',
        to: tx.to,
        valuePol: ethers.formatEther(tx.value),
        ageSeconds,
        originalMaxFeeGwei: Number(ethers.formatUnits(originalMaxFee, 'gwei')),
        currentGasPriceGwei,
        // Needs bump if original fee is under 110% of current network suggestion.
        needsBump: originalMaxFee < (currentMaxFee * BigInt(110)) / BigInt(100),
        linkedUserId: matchedUser.id,
        linkedUserEmail: matchedUser.email,
        linkedUsdcBalance: matchedUser.sweep_usdc_balance?.toString() ?? null,
      });
    }

    return NextResponse.json({
      success: true,
      gasTankAddress,
      gasTankPolBalance: ethers.formatEther(polBalance),
      confirmedNonce,
      pendingNonce,
      stuckCount: stuckTxs.length,
      currentGasPriceGwei,
      stuckTxs,
    });
  } catch (error) {
    console.error('[AdminStuckTxs] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
