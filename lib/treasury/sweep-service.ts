/**
 * Treasury Sweep Service
 * Consolidates USDC from deposit addresses to the central treasury wallet
 * Uses HD wallet derivation to sign transactions from deposit addresses
 * Note: Polygon's native gas token is POL (formerly MATIC)
 */

import { ethers } from 'ethers';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getTreasurySetting } from './treasury-service';
import { polygonUSDCClient } from '@/lib/polygon/usdc-client';

// Minimum USDC balance to sweep (to avoid wasting gas on dust)
const MIN_SWEEP_AMOUNT_USDC = 1; // $1 minimum

export interface SweepResult {
  depositAddressId: string;
  depositAddress: string;
  amount: number;
  success: boolean;
  txHash?: string;
  error?: string;
}

export interface SweepSummary {
  totalProcessed: number;
  successful: number;
  failed: number;
  totalSweptUsdc: number;
  results: SweepResult[];
}

/**
 * Get master wallet xprv from treasury settings
 */
export async function getMasterXprv(): Promise<string | null> {
  return getTreasurySetting('master_wallet_xprv');
}

/**
 * Derive private key for a deposit address using BIP-44 derivation
 * Path: m/44'/60'/0'/0/{index}
 */
export function derivePrivateKey(masterXprv: string, derivationIndex: number): string {
  // Create HD node from xprv
  const hdNode = ethers.HDNodeWallet.fromExtendedKey(masterXprv);

  // Derive child at the specified index
  // The xprv represents the account level (m/44'/60'/0'/0)
  // We just need to derive the index
  const childNode = hdNode.derivePath(derivationIndex.toString());

  // Check if this is a private key wallet (has signing capability)
  if (!('privateKey' in childNode) || !childNode.privateKey) {
    throw new Error('Cannot derive private key from extended public key. Please configure master_wallet_xprv.');
  }

  return childNode.privateKey;
}

/**
 * Verify that a private key derives the expected address
 */
export function verifyDerivedAddress(privateKey: string, expectedAddress: string): boolean {
  const wallet = new ethers.Wallet(privateKey);
  return wallet.address.toLowerCase() === expectedAddress.toLowerCase();
}

/**
 * Get deposit addresses ready to be swept
 * Conditions: status='used', received_at IS NOT NULL, swept_at IS NULL
 */
export async function getDepositsToSweep(limit: number = 50): Promise<
  Array<{
    id: string;
    deposit_address: string;
    derivation_index: number;
    user_id: string;
    received_amount: number;
  }>
> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('deposit_addresses')
    .select('id, deposit_address, derivation_index, user_id, received_amount')
    .eq('status', 'used')
    .not('received_at', 'is', null)
    .is('swept_at', null)
    .order('received_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[SweepService] Error fetching deposits to sweep:', error);
    return [];
  }

  return data || [];
}

/**
 * Sweep a single deposit address to treasury
 */
export async function sweepDeposit(
  depositAddressId: string,
  depositAddress: string,
  derivationIndex: number,
  treasuryAddress: string,
  masterXprv: string
): Promise<SweepResult> {
  const result: SweepResult = {
    depositAddressId,
    depositAddress,
    amount: 0,
    success: false,
  };

  try {
    // Derive private key
    const privateKey = derivePrivateKey(masterXprv, derivationIndex);

    // Verify the derived address matches
    if (!verifyDerivedAddress(privateKey, depositAddress)) {
      throw new Error(`Derived address mismatch! Expected ${depositAddress}`);
    }

    // Get current USDC balance
    const balanceResult = await polygonUSDCClient.getBalance(depositAddress);
    if (!balanceResult.success || !balanceResult.data) {
      throw new Error('Failed to get balance');
    }

    const balanceUsdc = parseFloat(balanceResult.data.balance);
    result.amount = balanceUsdc;

    // Skip if below minimum
    if (balanceUsdc < MIN_SWEEP_AMOUNT_USDC) {
      console.log(`[SweepService] Skipping ${depositAddress}: balance ${balanceUsdc} below minimum`);
      result.success = true;
      result.error = `Balance ${balanceUsdc} below minimum ${MIN_SWEEP_AMOUNT_USDC}`;
      return result;
    }

    console.log(`[SweepService] Sweeping ${balanceUsdc} USDC from ${depositAddress} to treasury`);

    // Check POL balance for gas (POL is Polygon's native token, formerly MATIC)
    const polResult = await polygonUSDCClient.getMATICBalance(depositAddress);
    if (!polResult.success || parseFloat(polResult.data || '0') < 0.01) {
      throw new Error(`Insufficient POL for gas. Have: ${polResult.data || '0'} POL`);
    }

    // Transfer USDC to treasury
    const transferResult = await polygonUSDCClient.transfer(
      privateKey,
      treasuryAddress,
      balanceUsdc.toFixed(6)
    );

    if (!transferResult.success || !transferResult.data) {
      throw new Error(transferResult.error?.message || 'Transfer failed');
    }

    // Wait for confirmation
    const confirmResult = await polygonUSDCClient.waitForConfirmation(
      transferResult.data.txHash,
      1 // 1 confirmation
    );

    if (!confirmResult.success || confirmResult.data?.status !== 'confirmed') {
      throw new Error('Transaction not confirmed');
    }

    result.success = true;
    result.txHash = transferResult.data.txHash;

    console.log(`[SweepService] Swept ${balanceUsdc} USDC, tx: ${result.txHash}`);

    // Update database
    const supabase = createServiceRoleClient();
    await supabase
      .from('deposit_addresses')
      .update({
        swept_at: new Date().toISOString(),
        sweep_tx_hash: result.txHash,
      })
      .eq('id', depositAddressId);

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[SweepService] Error sweeping ${depositAddress}:`, error);
    result.error = errorMsg;
    return result;
  }
}

/**
 * Sweep all pending deposits to treasury
 */
export async function sweepAllPendingDeposits(limit: number = 50): Promise<SweepSummary> {
  const summary: SweepSummary = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    totalSweptUsdc: 0,
    results: [],
  };

  // Get master xprv
  const masterXprv = await getMasterXprv();
  if (!masterXprv) {
    console.error('[SweepService] Master wallet xprv not configured');
    return summary;
  }

  // Get treasury address
  const treasuryAddress = await getTreasurySetting('treasury_wallet_address');
  if (!treasuryAddress) {
    console.error('[SweepService] Treasury wallet address not configured');
    return summary;
  }

  // Get deposits to sweep
  const deposits = await getDepositsToSweep(limit);
  if (deposits.length === 0) {
    console.log('[SweepService] No deposits to sweep');
    return summary;
  }

  console.log(`[SweepService] Processing ${deposits.length} deposit(s) for sweep`);

  const supabase = createServiceRoleClient();

  // Process each deposit
  for (const deposit of deposits) {
    summary.totalProcessed++;

    const result = await sweepDeposit(
      deposit.id,
      deposit.deposit_address,
      deposit.derivation_index,
      treasuryAddress,
      masterXprv
    );

    summary.results.push(result);

    if (result.success && result.txHash) {
      summary.successful++;
      summary.totalSweptUsdc += result.amount;

      // Log audit event
      await supabase.from('crypto_audit_log').insert({
        event_type: 'deposit_swept',
        user_id: deposit.user_id,
        entity_type: 'deposit_address',
        entity_id: deposit.id,
        details: {
          deposit_address: deposit.deposit_address,
          treasury_address: treasuryAddress,
          amount_usdc: result.amount,
          tx_hash: result.txHash,
        },
      });
    } else if (!result.success || result.error) {
      // Only count as failed if there was an actual error (not just dust skip)
      if (!result.error?.includes('below minimum')) {
        summary.failed++;

        // Log failure
        await supabase.from('crypto_audit_log').insert({
          event_type: 'deposit_sweep_failed',
          user_id: deposit.user_id,
          entity_type: 'deposit_address',
          entity_id: deposit.id,
          details: {
            deposit_address: deposit.deposit_address,
            error: result.error,
          },
        });
      }
    }
  }

  console.log(`[SweepService] Sweep complete. Success: ${summary.successful}, Failed: ${summary.failed}, Total USDC: ${summary.totalSweptUsdc}`);

  return summary;
}

/**
 * Sweep a specific deposit by ID (for admin manual trigger)
 */
export async function sweepDepositById(depositAddressId: string): Promise<SweepResult> {
  const supabase = createServiceRoleClient();

  // Get deposit details
  const { data: deposit, error } = await supabase
    .from('deposit_addresses')
    .select('id, deposit_address, derivation_index, user_id')
    .eq('id', depositAddressId)
    .single();

  if (error || !deposit) {
    return {
      depositAddressId,
      depositAddress: '',
      amount: 0,
      success: false,
      error: 'Deposit address not found',
    };
  }

  // Get master xprv
  const masterXprv = await getMasterXprv();
  if (!masterXprv) {
    return {
      depositAddressId,
      depositAddress: deposit.deposit_address,
      amount: 0,
      success: false,
      error: 'Master wallet xprv not configured',
    };
  }

  // Get treasury address
  const treasuryAddress = await getTreasurySetting('treasury_wallet_address');
  if (!treasuryAddress) {
    return {
      depositAddressId,
      depositAddress: deposit.deposit_address,
      amount: 0,
      success: false,
      error: 'Treasury wallet address not configured',
    };
  }

  return sweepDeposit(
    deposit.id,
    deposit.deposit_address,
    deposit.derivation_index,
    treasuryAddress,
    masterXprv
  );
}

/**
 * Estimate gas for sweeping (for pre-funding deposit addresses with POL)
 */
export async function estimateSweepGas(): Promise<{
  gasLimit: string;
  estimatedCostMatic: string;
}> {
  // ERC-20 transfers typically use ~65,000 gas on Polygon
  // Add buffer for safety
  const estimatedGasLimit = 100000;

  // Get current gas price
  const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const feeData = await provider.getFeeData();

  const maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits('100', 'gwei');
  const estimatedCost = BigInt(estimatedGasLimit) * maxFeePerGas;

  return {
    gasLimit: estimatedGasLimit.toString(),
    estimatedCostMatic: ethers.formatEther(estimatedCost),
  };
}

/**
 * Fund a deposit address with POL for gas (from gas tank)
 * POL is Polygon's native token (formerly MATIC)
 */
export async function fundDepositForSweep(
  depositAddress: string,
  amountPol: string = '0.05'
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  // Get gas tank private key
  const gasTankPrivateKey = process.env.GAS_TANK_PRIVATE_KEY;
  if (!gasTankPrivateKey) {
    return { success: false, error: 'Gas tank not configured' };
  }

  try {
    const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(gasTankPrivateKey, provider);

    // Send POL for gas
    const tx = await wallet.sendTransaction({
      to: depositAddress,
      value: ethers.parseEther(amountPol),
    });

    const receipt = await tx.wait();

    console.log(`[SweepService] Funded ${depositAddress} with ${amountPol} POL, tx: ${receipt?.hash}`);

    return {
      success: true,
      txHash: receipt?.hash,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SweepService] Error funding deposit address:', error);
    return { success: false, error: errorMsg };
  }
}
