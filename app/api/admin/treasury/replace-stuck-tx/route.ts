/**
 * POST /api/admin/treasury/replace-stuck-tx
 *
 * Broadcasts a replacement transaction from the gas-tank wallet at a specific nonce
 * with higher gas, to unstick a tx that's gathered dust in the Polygon mempool.
 *
 * Body: { nonce: number, action: 'replace' | 'cancel', gasMultiplier?: number }
 *  - replace: re-broadcast the original POL funding to the same deposit address (recovery).
 *  - cancel: send 0-value self-transfer at the same nonce (frees the queue without re-funding).
 *
 * Does NOT mutate users.sweep_*; once the replacement is mined and POL lands,
 * sweep-execute step 1 promotes the user to 'ready' on its own.
 *
 * Superadmin-only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import {
  GAS_BUFFER_MULTIPLIER,
  REPLACEMENT_BUMP_MULTIPLIER,
  applyMultiplier,
  maxFee,
} from '@/lib/treasury/gas-config';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Action = 'replace' | 'cancel';

export async function POST(req: NextRequest) {
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
      .select('role')
      .eq('id', authUser.id)
      .single();

    if (!['superadmin', 'superadmin+'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'Access denied. Superadmin only.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const nonce = Number(body.nonce);
    const action: Action = body.action === 'cancel' ? 'cancel' : 'replace';
    const requestedMultiplier = Number(body.gasMultiplier);
    const userMultiplier =
      Number.isFinite(requestedMultiplier) && requestedMultiplier > 1
        ? requestedMultiplier
        : GAS_BUFFER_MULTIPLIER;

    if (!Number.isInteger(nonce) || nonce < 0) {
      return NextResponse.json({ error: 'Invalid nonce' }, { status: 400 });
    }

    const gasTankPrivateKey = process.env.GAS_TANK_PRIVATE_KEY;
    if (!gasTankPrivateKey) {
      return NextResponse.json({ error: 'Gas tank not configured' }, { status: 500 });
    }

    const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(gasTankPrivateKey, provider);

    const confirmedNonce = await provider.getTransactionCount(wallet.address, 'latest');
    if (nonce < confirmedNonce) {
      return NextResponse.json(
        { error: `Nonce ${nonce} is already mined (confirmed nonce is ${confirmedNonce})` },
        { status: 400 }
      );
    }

    // Find the original pending tx so we can recover its `to`, `value`, and original fees.
    // We locate it via users.sweep_funding_tx where the tx exists in mempool with this nonce.
    const supabase = createServiceRoleClient();
    const { data: fundingSentUsers } = await supabase
      .from('users')
      .select('id, email, sweep_funding_tx, crypto_deposit_address')
      .eq('sweep_status', 'funding_sent')
      .not('sweep_funding_tx', 'is', null);

    let originalTx: ethers.TransactionResponse | null = null;
    let linkedUserId: string | null = null;
    if (fundingSentUsers) {
      for (const u of fundingSentUsers) {
        const tx = await provider.getTransaction(u.sweep_funding_tx!).catch(() => null);
        if (tx && tx.nonce === nonce) {
          originalTx = tx;
          linkedUserId = u.id;
          break;
        }
      }
    }

    if (!originalTx && action === 'replace') {
      return NextResponse.json(
        {
          error:
            'Cannot find original tx for replacement. Use action="cancel" to free this nonce, or include the original hash explicitly.',
        },
        { status: 400 }
      );
    }

    const feeData = await provider.getFeeData();
    const originalMaxFee = originalTx?.maxFeePerGas ?? originalTx?.gasPrice ?? BigInt(0);
    const originalPriorityFee = originalTx?.maxPriorityFeePerGas ?? BigInt(0);

    // newFee = max(network suggestion × user multiplier, original × 1.15)
    // The 1.15 floor satisfies Polygon's ≥10% replacement bump rule, and the user multiplier
    // floors the new fee at a safe distance above current network gas.
    const newMaxFee = maxFee(
      applyMultiplier(feeData.maxFeePerGas, userMultiplier),
      applyMultiplier(originalMaxFee, REPLACEMENT_BUMP_MULTIPLIER)
    );
    const newPriorityFee = maxFee(
      applyMultiplier(feeData.maxPriorityFeePerGas, userMultiplier),
      applyMultiplier(originalPriorityFee, REPLACEMENT_BUMP_MULTIPLIER)
    );

    let replacementTx: ethers.TransactionResponse;
    if (action === 'replace' && originalTx) {
      replacementTx = await wallet.sendTransaction({
        to: originalTx.to ?? undefined,
        value: originalTx.value,
        nonce,
        maxFeePerGas: newMaxFee,
        maxPriorityFeePerGas: newPriorityFee,
        gasLimit: 21000,
      });
    } else {
      // Cancel: 0-value self-transfer
      replacementTx = await wallet.sendTransaction({
        to: wallet.address,
        value: 0,
        nonce,
        maxFeePerGas: newMaxFee,
        maxPriorityFeePerGas: newPriorityFee,
        gasLimit: 21000,
      });
    }

    console.log(
      `[ReplaceStuckTx] Broadcast ${action} for nonce ${nonce}: ${replacementTx.hash} (admin ${authUser.id})`
    );

    // If we have a user linked to this nonce, update their funding tx hash so the
    // sweep-verify / status display point at the new (replacement) hash rather than
    // the dead original.
    if (action === 'replace' && linkedUserId) {
      await supabase
        .from('users')
        .update({ sweep_funding_tx: replacementTx.hash })
        .eq('id', linkedUserId);
    }

    await supabase.from('crypto_audit_log').insert({
      event_type: 'admin_action',
      admin_id: authUser.id,
      user_id: linkedUserId,
      entity_type: 'treasury',
      details: {
        action: 'replace_stuck_tx',
        sub_action: action,
        nonce,
        gas_tank: wallet.address,
        original_hash: originalTx?.hash ?? null,
        new_hash: replacementTx.hash,
        original_max_fee_gwei: Number(ethers.formatUnits(originalMaxFee, 'gwei')),
        new_max_fee_gwei: Number(ethers.formatUnits(newMaxFee, 'gwei')),
        multiplier: userMultiplier,
        linked_user_id: linkedUserId,
      },
    });

    return NextResponse.json({
      success: true,
      action,
      nonce,
      originalHash: originalTx?.hash ?? null,
      newHash: replacementTx.hash,
      newMaxFeeGwei: Number(ethers.formatUnits(newMaxFee, 'gwei')),
      newPriorityFeeGwei: Number(ethers.formatUnits(newPriorityFee, 'gwei')),
      linkedUserId,
    });
  } catch (error) {
    console.error('[ReplaceStuckTx] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
