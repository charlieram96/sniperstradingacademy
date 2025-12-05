/**
 * Treasury Service
 * Manages treasury settings and HD wallet address derivation
 */

import { ethers } from 'ethers';
import { createServiceRoleClient } from '@/lib/supabase/server';

export interface TreasurySettings {
  treasuryWalletAddress: string;
  masterWalletXpub: string;
  currentDerivationIndex: number;
}

export interface PayoutWalletSettings {
  payoutWalletAddress: string;
  payoutWalletPrivateKey: string;
}

export interface DepositAddressResult {
  address: string;
  derivationIndex: number;
  derivationPath: string;
}

// USDC has 6 decimals: 1 USDC = 1,000,000 smallest units
const USDC_DECIMALS = 6;
const USDC_MULTIPLIER = 10 ** USDC_DECIMALS; // 1000000

/**
 * Convert USDC amount (e.g., 499.00) to smallest units (e.g., 499000000)
 */
export function usdcToWei(amount: number): bigint {
  return BigInt(Math.round(amount * USDC_MULTIPLIER));
}

/**
 * Convert smallest units back to USDC amount for display
 */
export function weiToUsdc(wei: bigint | number): number {
  const weiNum = typeof wei === 'bigint' ? Number(wei) : wei;
  return weiNum / USDC_MULTIPLIER;
}

/**
 * Format wei amount as USDC string (e.g., "499.00")
 */
export function formatUsdcFromWei(wei: bigint | number): string {
  return weiToUsdc(wei).toFixed(2);
}

/**
 * Get all treasury settings
 */
export async function getTreasurySettings(): Promise<TreasurySettings | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('treasury_settings')
    .select('setting_key, setting_value');

  if (error || !data) {
    console.error('[TreasuryService] Failed to fetch settings:', error);
    return null;
  }

  const settings: Record<string, string> = {};
  for (const row of data) {
    settings[row.setting_key] = row.setting_value;
  }

  return {
    treasuryWalletAddress: settings['treasury_wallet_address'] || '',
    masterWalletXpub: settings['master_wallet_xpub'] || '',
    currentDerivationIndex: parseInt(settings['current_derivation_index'] || '0', 10),
  };
}

/**
 * Get a single treasury setting
 */
export async function getTreasurySetting(key: string): Promise<string | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('treasury_settings')
    .select('setting_value')
    .eq('setting_key', key)
    .single();

  if (error || !data) {
    return null;
  }

  return data.setting_value;
}

/**
 * Update treasury settings
 */
export async function updateTreasurySettings(
  settings: Partial<TreasurySettings>,
  updatedBy: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleClient();

  const updates: { key: string; value: string }[] = [];

  if (settings.treasuryWalletAddress !== undefined) {
    // Validate address format
    if (settings.treasuryWalletAddress && !isValidEthereumAddress(settings.treasuryWalletAddress)) {
      return { success: false, error: 'Invalid treasury wallet address format' };
    }
    updates.push({ key: 'treasury_wallet_address', value: settings.treasuryWalletAddress });
  }

  if (settings.masterWalletXpub !== undefined) {
    // Validate xpub format (basic check)
    if (settings.masterWalletXpub && !isValidXpub(settings.masterWalletXpub)) {
      return { success: false, error: 'Invalid master wallet xpub format' };
    }
    updates.push({ key: 'master_wallet_xpub', value: settings.masterWalletXpub });
  }

  // Update each setting
  for (const update of updates) {
    const { error } = await supabase
      .from('treasury_settings')
      .update({
        setting_value: update.value,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq('setting_key', update.key);

    if (error) {
      console.error(`[TreasuryService] Failed to update ${update.key}:`, error);
      return { success: false, error: `Failed to update ${update.key}` };
    }
  }

  return { success: true };
}

/**
 * Generate a unique deposit address from the treasury HD wallet
 * Uses BIP-44 derivation: m/44'/60'/0'/0/{index}
 */
export async function generateDepositAddress(
  userId: string,
  paymentIntentId: string,
  purpose: 'initial_unlock' | 'monthly_subscription' | 'weekly_subscription',
  expectedAmount: number,
  expiresAt: Date
): Promise<{ success: boolean; data?: DepositAddressResult; error?: string }> {
  const supabase = createServiceRoleClient();

  // Get master xpub
  const xpub = await getTreasurySetting('master_wallet_xpub');

  if (!xpub) {
    return { success: false, error: 'Treasury wallet not configured. Please contact admin.' };
  }

  try {
    // Get next derivation index atomically using the database function
    const { data: indexResult, error: indexError } = await supabase.rpc('get_next_derivation_index');

    if (indexError || indexResult === null) {
      console.error('[TreasuryService] Failed to get derivation index:', indexError);
      return { success: false, error: 'Failed to generate deposit address' };
    }

    const derivationIndex = indexResult as number;

    // Derive address from xpub using ethers.js
    // The xpub already represents m/44'/60'/0'/0, so we just derive /{index}
    const derivationPath = `m/44'/60'/0'/0/${derivationIndex}`;

    // Create HD node from xpub and derive the child
    const hdNode = ethers.HDNodeWallet.fromExtendedKey(xpub);
    const childNode = hdNode.derivePath(derivationIndex.toString());
    const address = childNode.address;

    // Convert amount to smallest units (BIGINT)
    const expectedAmountWei = Number(usdcToWei(expectedAmount));

    // Store the deposit address mapping
    const { data: depositAddress, error: insertError } = await supabase
      .from('deposit_addresses')
      .insert({
        user_id: userId,
        payment_intent_id: paymentIntentId,
        deposit_address: address,
        derivation_index: derivationIndex,
        derivation_path: derivationPath,
        purpose,
        expected_amount: expectedAmountWei, // Now stored as BIGINT
        expires_at: expiresAt.toISOString(),
        status: 'active',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[TreasuryService] Failed to store deposit address:', insertError);
      return { success: false, error: 'Failed to create deposit address record' };
    }

    // Log audit event
    await supabase.from('crypto_audit_log').insert({
      event_type: 'deposit_address_created',
      user_id: userId,
      entity_type: 'deposit_address',
      entity_id: depositAddress.id,
      details: {
        address,
        derivation_index: derivationIndex,
        purpose,
        expected_amount: expectedAmount,
        payment_intent_id: paymentIntentId,
      },
    });

    return {
      success: true,
      data: {
        address,
        derivationIndex,
        derivationPath,
      },
    };
  } catch (error: unknown) {
    console.error('[TreasuryService] Address derivation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Address derivation failed: ${errorMessage}` };
  }
}

/**
 * Get deposit address by address string
 */
export async function getDepositAddressByAddress(address: string) {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('deposit_addresses')
    .select('*, payment_intents(*)')
    .eq('deposit_address', address)
    .single();

  if (error) {
    return null;
  }

  return data;
}

/**
 * Get active deposit addresses for monitoring
 * @param limit Max number of addresses to return (default 100 for scaling)
 */
export async function getActiveDepositAddresses(limit: number = 100) {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('deposit_addresses')
    .select('*')
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[TreasuryService] Failed to fetch active deposit addresses:', error);
    return [];
  }

  return data || [];
}

/**
 * Update deposit address status when payment is received
 * @param receivedAmountWei Amount received in smallest units (BIGINT)
 */
export async function markDepositAddressReceived(
  depositAddressId: string,
  receivedAmountWei: number,
  txHash: string,
  options?: {
    isOverpaid?: boolean;
    overpaymentAmount?: number;
    isLate?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleClient();

  const updateData: Record<string, unknown> = {
    status: 'used',
    received_amount: receivedAmountWei,
    received_tx_hash: txHash,
    received_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_underpaid: false, // Clear underpaid flag when fully received
  };

  // Handle overpayment
  if (options?.isOverpaid) {
    updateData.is_overpaid = true;
    updateData.overpayment_amount = options.overpaymentAmount || 0;
    updateData.requires_admin_review = true;
  }

  // Handle late payment
  if (options?.isLate) {
    updateData.is_late = true;
  }

  const { error } = await supabase
    .from('deposit_addresses')
    .update(updateData)
    .eq('id', depositAddressId);

  if (error) {
    console.error('[TreasuryService] Failed to mark deposit received:', error);
    return { success: false, error: 'Failed to update deposit address' };
  }

  return { success: true };
}

/**
 * Mark deposit address as underpaid (partial payment received)
 */
export async function markAsUnderpaid(
  depositAddressId: string,
  receivedAmountWei: number,
  shortfallAmountWei: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from('deposit_addresses')
    .update({
      received_amount: receivedAmountWei,
      is_underpaid: true,
      shortfall_amount: shortfallAmountWei,
      updated_at: new Date().toISOString(),
    })
    .eq('id', depositAddressId);

  if (error) {
    console.error('[TreasuryService] Failed to mark as underpaid:', error);
    return { success: false, error: 'Failed to update deposit address' };
  }

  return { success: true };
}

/**
 * Get expired addresses to check for late payments
 */
export async function getExpiredAddressesForLateCheck(limit: number = 50) {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.rpc('get_expired_addresses_for_late_check');

  if (error) {
    console.error('[TreasuryService] Failed to fetch expired addresses:', error);
    return [];
  }

  return (data || []).slice(0, limit);
}

/**
 * Get deposit addresses needing admin review
 */
export async function getAddressesNeedingReview() {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.rpc('get_addresses_needing_review');

  if (error) {
    console.error('[TreasuryService] Failed to fetch addresses needing review:', error);
    return [];
  }

  return data || [];
}

/**
 * Mark overpayment as reviewed/resolved
 */
export async function resolveOverpaymentReview(
  depositAddressId: string,
  resolution: 'refunded' | 'credited' | 'ignored',
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from('deposit_addresses')
    .update({
      requires_admin_review: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', depositAddressId);

  if (error) {
    console.error('[TreasuryService] Failed to resolve overpayment:', error);
    return { success: false, error: 'Failed to update deposit address' };
  }

  // Log the resolution
  await supabase.from('crypto_audit_log').insert({
    event_type: 'overpayment_resolved',
    entity_type: 'deposit_address',
    entity_id: depositAddressId,
    details: {
      resolution,
      notes,
    },
  });

  return { success: true };
}

/**
 * Get last scanned block number for event scanning
 */
export async function getLastScannedBlock(): Promise<number> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.rpc('get_last_scanned_block');

  if (error || data === null) {
    console.error('[TreasuryService] Failed to get last scanned block:', error);
    return 0;
  }

  return Number(data);
}

/**
 * Update last scanned block number
 */
export async function updateLastScannedBlock(blockNumber: number): Promise<void> {
  const supabase = createServiceRoleClient();

  const { error } = await supabase.rpc('update_last_scanned_block', {
    p_block_number: blockNumber,
  });

  if (error) {
    console.error('[TreasuryService] Failed to update last scanned block:', error);
  }
}

/**
 * Check if treasury is properly configured
 */
export async function isTreasuryConfigured(): Promise<boolean> {
  const settings = await getTreasurySettings();

  if (!settings) return false;

  return !!(
    settings.treasuryWalletAddress &&
    settings.masterWalletXpub &&
    isValidEthereumAddress(settings.treasuryWalletAddress) &&
    isValidXpub(settings.masterWalletXpub)
  );
}

// =============================================
// Payout Wallet Functions
// =============================================

/**
 * Get payout wallet settings from database
 */
export async function getPayoutWalletSettings(): Promise<PayoutWalletSettings | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('treasury_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['payout_wallet_address', 'payout_wallet_private_key']);

  if (error || !data) {
    console.error('[TreasuryService] Failed to fetch payout wallet settings:', error);
    return null;
  }

  const settings: Record<string, string> = {};
  for (const row of data) {
    settings[row.setting_key] = row.setting_value;
  }

  return {
    payoutWalletAddress: settings['payout_wallet_address'] || '',
    payoutWalletPrivateKey: settings['payout_wallet_private_key'] || '',
  };
}

/**
 * Update payout wallet settings
 */
export async function updatePayoutWalletSettings(
  settings: Partial<PayoutWalletSettings>,
  updatedBy: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleClient();

  const updates: { key: string; value: string }[] = [];

  if (settings.payoutWalletAddress !== undefined) {
    // Validate address format
    if (settings.payoutWalletAddress && !isValidEthereumAddress(settings.payoutWalletAddress)) {
      return { success: false, error: 'Invalid payout wallet address format' };
    }
    updates.push({ key: 'payout_wallet_address', value: settings.payoutWalletAddress });
  }

  if (settings.payoutWalletPrivateKey !== undefined) {
    // Validate private key format (basic check - should start with 0x and be 66 chars)
    if (settings.payoutWalletPrivateKey && !isValidPrivateKey(settings.payoutWalletPrivateKey)) {
      return { success: false, error: 'Invalid private key format. Must be a 64-character hex string (with or without 0x prefix)' };
    }
    // Normalize private key to include 0x prefix
    const normalizedKey = settings.payoutWalletPrivateKey.startsWith('0x')
      ? settings.payoutWalletPrivateKey
      : `0x${settings.payoutWalletPrivateKey}`;
    updates.push({ key: 'payout_wallet_private_key', value: normalizedKey });
  }

  // Update each setting
  for (const update of updates) {
    const { error } = await supabase
      .from('treasury_settings')
      .update({
        setting_value: update.value,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq('setting_key', update.key);

    if (error) {
      console.error(`[TreasuryService] Failed to update ${update.key}:`, error);
      return { success: false, error: `Failed to update ${update.key}` };
    }
  }

  // Log audit event
  await supabase.from('crypto_audit_log').insert({
    event_type: 'payout_wallet_settings_updated',
    admin_id: updatedBy,
    entity_type: 'payout_wallet',
    entity_id: null,
    details: {
      updated_fields: updates.map(u => u.key),
      // Never log the actual private key
    },
  });

  return { success: true };
}

/**
 * Check if payout wallet is properly configured in database
 */
export async function isPayoutWalletConfiguredInDb(): Promise<boolean> {
  const settings = await getPayoutWalletSettings();

  if (!settings) return false;

  return !!(
    settings.payoutWalletAddress &&
    settings.payoutWalletPrivateKey &&
    isValidEthereumAddress(settings.payoutWalletAddress) &&
    isValidPrivateKey(settings.payoutWalletPrivateKey)
  );
}

/**
 * Get payout wallet address (from DB first, then env var fallback)
 */
export async function getPayoutWalletAddress(): Promise<string> {
  // Try database first
  const dbSettings = await getPayoutWalletSettings();
  if (dbSettings?.payoutWalletAddress) {
    return dbSettings.payoutWalletAddress;
  }

  // Fall back to env var
  return process.env.PAYOUT_WALLET_ADDRESS || process.env.PLATFORM_TREASURY_WALLET_ADDRESS || '';
}

/**
 * Get payout wallet private key (from DB first, then env var fallback)
 * WARNING: Handle with care - this returns sensitive data
 */
export async function getPayoutWalletPrivateKey(): Promise<string> {
  // Try database first
  const dbSettings = await getPayoutWalletSettings();
  if (dbSettings?.payoutWalletPrivateKey) {
    return dbSettings.payoutWalletPrivateKey;
  }

  // Fall back to env var
  return process.env.PAYOUT_WALLET_PRIVATE_KEY || process.env.PLATFORM_TREASURY_PRIVATE_KEY || '';
}

// =============================================
// Helper Functions
// =============================================

/**
 * Validate Ethereum address format
 */
function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate extended public key format (basic check)
 * Supports xpub (BIP-44) and other HD key formats
 */
function isValidXpub(xpub: string): boolean {
  // Extended public keys are base58 encoded and typically start with 'xpub', 'ypub', 'zpub', etc.
  // They are 111 characters for mainnet
  // For ethers.js, we need an extended key that can be parsed
  try {
    // Try to create an HD node from it - if it works, it's valid
    ethers.HDNodeWallet.fromExtendedKey(xpub);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate Ethereum private key format
 * Private keys are 64 hex characters (32 bytes), optionally prefixed with 0x
 */
function isValidPrivateKey(privateKey: string): boolean {
  // Remove 0x prefix if present
  const keyWithoutPrefix = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;

  // Must be exactly 64 hex characters
  if (!/^[a-fA-F0-9]{64}$/.test(keyWithoutPrefix)) {
    return false;
  }

  // Try to create a wallet from it to fully validate
  try {
    new ethers.Wallet(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);
    return true;
  } catch {
    return false;
  }
}
