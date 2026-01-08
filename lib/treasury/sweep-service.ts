/**
 * Treasury Sweep Service
 * Consolidates USDC from user deposit addresses to the central treasury wallet
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
  userId: string;
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
 * Get users with deposit addresses that may have funds to sweep
 * Returns users who have a permanent deposit address set
 */
export async function getUsersToSweep(limit: number = 50): Promise<
  Array<{
    id: string;
    email: string;
    crypto_deposit_address: string;
    crypto_derivation_index: number;
  }>
> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('users')
    .select('id, email, crypto_deposit_address, crypto_derivation_index')
    .not('crypto_deposit_address', 'is', null)
    .not('crypto_derivation_index', 'is', null)
    .limit(limit);

  if (error) {
    console.error('[SweepService] Error fetching users to sweep:', error);
    return [];
  }

  return data || [];
}

// Legacy function for backwards compatibility
export async function getDepositsToSweep(limit: number = 50) {
  return getUsersToSweep(limit);
}

/**
 * Sweep a single user's deposit address to treasury
 */
export async function sweepUserDeposit(
  userId: string,
  depositAddress: string,
  derivationIndex: number,
  treasuryAddress: string,
  masterXprv: string
): Promise<SweepResult> {
  const result: SweepResult = {
    userId,
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
    // Need ~0.08-0.1 POL for ERC-20 transfer at high gas prices
    const polResult = await polygonUSDCClient.getMATICBalance(depositAddress);
    if (!polResult.success || parseFloat(polResult.data || '0') < 0.08) {
      throw new Error(`Insufficient POL for gas. Have: ${polResult.data || '0'} POL, need at least 0.08 POL`);
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

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[SweepService] Error sweeping ${depositAddress}:`, error);
    result.error = errorMsg;
    return result;
  }
}

/**
 * Sweep all user deposit addresses with funds to treasury
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

  // Get users with deposit addresses
  const users = await getUsersToSweep(limit);
  if (users.length === 0) {
    console.log('[SweepService] No users with deposit addresses to sweep');
    return summary;
  }

  console.log(`[SweepService] Checking ${users.length} user(s) for sweep`);

  const supabase = createServiceRoleClient();

  // Process each user
  for (const user of users) {
    summary.totalProcessed++;

    const result = await sweepUserDeposit(
      user.id,
      user.crypto_deposit_address,
      user.crypto_derivation_index,
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
        user_id: user.id,
        entity_type: 'user',
        entity_id: user.id,
        details: {
          deposit_address: user.crypto_deposit_address,
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
          user_id: user.id,
          entity_type: 'user',
          entity_id: user.id,
          details: {
            deposit_address: user.crypto_deposit_address,
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
 * Sweep a specific user's deposit by user ID (for admin manual trigger)
 */
export async function sweepDepositById(userId: string): Promise<SweepResult> {
  const supabase = createServiceRoleClient();

  // Get user's deposit details
  const { data: user, error } = await supabase
    .from('users')
    .select('id, crypto_deposit_address, crypto_derivation_index')
    .eq('id', userId)
    .single();

  if (error || !user || !user.crypto_deposit_address || user.crypto_derivation_index === null) {
    return {
      userId,
      depositAddress: '',
      amount: 0,
      success: false,
      error: 'User deposit address not found',
    };
  }

  // Get master xprv
  const masterXprv = await getMasterXprv();
  if (!masterXprv) {
    return {
      userId,
      depositAddress: user.crypto_deposit_address,
      amount: 0,
      success: false,
      error: 'Master wallet xprv not configured',
    };
  }

  // Get treasury address
  const treasuryAddress = await getTreasurySetting('treasury_wallet_address');
  if (!treasuryAddress) {
    return {
      userId,
      depositAddress: user.crypto_deposit_address,
      amount: 0,
      success: false,
      error: 'Treasury wallet address not configured',
    };
  }

  return sweepUserDeposit(
    user.id,
    user.crypto_deposit_address,
    user.crypto_derivation_index,
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
  amountPol: string = '0.15'
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
