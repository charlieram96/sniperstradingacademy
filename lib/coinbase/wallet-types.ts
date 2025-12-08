/* eslint-disable @typescript-eslint/no-explicit-any */
// =============================================
// Coinbase Server Wallet v2 Types
// =============================================

export interface CoinbaseWalletConfig {
  apiKey: string;
  apiSecret: string;
  projectId: string;
  network: 'polygon' | 'polygon-testnet';
}

export interface CreateWalletParams {
  userId: string;
  label?: string;
}

export interface CreateWalletResponse {
  walletId: string;
  address: string;
  network: string;
  createdAt: string;
  walletData?: string; // Encrypted wallet data for recovery
}

export interface WalletBalance {
  address: string;
  usdc: string; // Amount in USDC (e.g., "1234.567890")
  matic: string; // Amount in MATIC (e.g., "0.123456789012345678")
  lastUpdated: Date;
}

export interface TransferParams {
  fromWalletId: string;
  toAddress: string;
  amount: string; // USDC amount as string to avoid floating point issues
  memo?: string;
}

export interface TransferResponse {
  transactionHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  from: string;
  to: string;
  amount: string;
  gasUsed?: string;
  blockNumber?: number;
}

export interface ExportWalletParams {
  walletId: string;
  userId: string; // For security verification
}

export interface ExportWalletResponse {
  privateKey: string;
  publicKey: string;
  address: string;
  warning: string;
}

// =============================================
// Database Types (matching SQL schema)
// =============================================

export interface CryptoWallet {
  id: string;
  user_id: string;
  coinbase_wallet_id: string;
  wallet_address: string;
  network: string;
  created_at: string;
  last_backup_shown_at: string | null;
  is_exported: boolean;
  exported_at: string | null;
  status: 'active' | 'disabled' | 'migrated';
}

export interface USDCTransaction {
  id: string;
  transaction_type:
    | 'payment_in'
    | 'payout'
    | 'withdrawal'
    | 'refund'
    | 'transfer_internal'
    | 'on_ramp';
  from_address: string;
  to_address: string;
  amount: string; // NUMERIC as string
  gas_fee_matic: string | null;
  gas_fee_usdc_equivalent: string | null;
  polygon_tx_hash: string | null;
  block_number: number | null;
  status: 'pending' | 'confirmed' | 'failed' | 'cancelled';
  error_message: string | null;
  retry_count: number;
  user_id: string | null;
  related_payment_id: string | null;
  related_commission_id: string | null;
  created_at: string;
  confirmed_at: string | null;
  updated_at: string;
}

export interface PaymentIntent {
  id: string;
  user_id: string;
  intent_type: 'initial_unlock' | 'monthly_subscription' | 'weekly_subscription';
  amount_usdc: string;
  status:
    | 'created'
    | 'awaiting_funds'
    | 'processing'
    | 'completed'
    | 'expired'
    | 'cancelled';
  user_wallet_address: string;
  platform_wallet_address: string;
  funds_detected_at: string | null;
  expires_at: string;
  usdc_transaction_id: string | null;
  on_ramp_session_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
}

export interface PayoutBatch {
  id: string;
  batch_name: string;
  batch_type: 'direct_bonuses' | 'monthly_residual' | 'manual' | 'mixed';
  total_amount_usdc: string;
  total_payouts: number;
  estimated_gas_matic: string | null;
  status:
    | 'pending'
    | 'approved'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'cancelled';
  approved_by: string | null;
  approved_at: string | null;
  processing_started_at: string | null;
  completed_at: string | null;
  successful_payouts: number;
  failed_payouts: number;
  total_gas_spent_matic: string | null;
  total_gas_spent_usdc: string | null;
  commission_ids: string[];
  error_log: Array<{
    commission_id: string;
    error: string;
    timestamp: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface GasUsageLog {
  id: string;
  transaction_id: string;
  transaction_type: string;
  gas_limit: number | null;
  gas_used: number;
  gas_price_gwei: string;
  max_fee_per_gas_gwei: string | null;
  max_priority_fee_gwei: string | null;
  matic_spent: string;
  usdc_equivalent: string | null;
  matic_price_usd: string | null;
  polygon_tx_hash: string;
  block_number: number | null;
  created_at: string;
}

export interface TreasurySnapshot {
  id: string;
  usdc_balance: string;
  matic_balance: string;
  total_user_wallets_usdc: string;
  pending_commissions_usdc: string;
  pending_payouts_usdc: string;
  platform_net_balance: string | null;
  matic_price_usd: string | null;
  usdc_price_usd: string;
  total_active_wallets: number;
  snapshot_type: 'daily' | 'monthly' | 'manual';
  snapshot_at: string;
}

export interface ExternalWalletAddress {
  id: string;
  user_id: string;
  wallet_address: string;
  wallet_label: string | null;
  network: string;
  is_verified: boolean;
  verified_at: string | null;
  first_used_at: string | null;
  last_used_at: string | null;
  total_withdrawals: number;
  total_amount_withdrawn: string;
  status: 'active' | 'disabled' | 'flagged';
  created_at: string;
  updated_at: string;
}

export interface OnRampSession {
  id: string;
  user_id: string;
  provider: string;
  provider_session_id: string | null;
  provider_order_id: string | null;
  fiat_amount: string | null;
  fiat_currency: string | null;
  crypto_amount: string | null;
  fee_amount: string | null;
  destination_wallet_address: string;
  status:
    | 'initiated'
    | 'pending'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'expired';
  deposit_tx_hash: string | null;
  deposit_confirmed_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

// =============================================
// API Request/Response Types
// =============================================

export interface CreatePaymentIntentRequest {
  userId: string;
  intentType: 'initial_unlock' | 'monthly_subscription' | 'weekly_subscription';
  amountUSDC: string;
}

export interface CreatePaymentIntentResponse {
  intent: PaymentIntent;
  userWalletAddress: string;
  qrCodeData: string; // QR code string for easy scanning
  expiresIn: number; // Seconds until expiration
}

export interface CheckPaymentStatusRequest {
  intentId: string;
}

export interface CheckPaymentStatusResponse {
  intent: PaymentIntent;
  walletBalance: string;
  fundsDetected: boolean;
  amountReceived?: string;
}

export interface ProcessPayoutBatchRequest {
  batchId: string;
  adminUserId: string;
}

export interface ProcessPayoutBatchResponse {
  batchId: string;
  status: string;
  processedPayouts: number;
  failedPayouts: number;
  totalGasSpent: string;
  transactions: Array<{
    commissionId: string;
    userId: string;
    amount: string;
    txHash: string;
    status: 'success' | 'failed';
    error?: string;
  }>;
}

export interface WithdrawToExternalRequest {
  userId: string;
  externalAddress: string;
  amount: string;
  label?: string;
}

export interface WithdrawToExternalResponse {
  transactionId: string;
  txHash: string;
  from: string;
  to: string;
  amount: string;
  gasSpent: string;
  status: string;
}

// =============================================
// Service Response Types
// =============================================

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface WalletServiceError {
  code:
    | 'WALLET_NOT_FOUND'
    | 'INSUFFICIENT_BALANCE'
    | 'INVALID_ADDRESS'
    | 'TRANSACTION_FAILED'
    | 'GAS_ESTIMATION_FAILED'
    | 'API_ERROR'
    | 'NETWORK_ERROR'
    | 'UNAUTHORIZED'
    | 'VALIDATION_ERROR';
  message: string;
  details?: any;
}

// =============================================
// Constants
// =============================================

export const PAYMENT_AMOUNTS = {
  INITIAL_UNLOCK: '499.00',
  MONTHLY_SUBSCRIPTION: '199.00',
  WEEKLY_SUBSCRIPTION: '49.75',
  DIRECT_BONUS: '249.50', // 50% of initial unlock
} as const;

export const POLYGON_CONFIG = {
  MAINNET: {
    chainId: 137,
    name: 'Polygon Mainnet',
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com',
    usdcContract: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // USDC on Polygon
  },
  TESTNET: {
    chainId: 80002,
    name: 'Polygon Amoy Testnet',
    rpcUrl: process.env.POLYGON_TESTNET_RPC_URL || 'https://rpc-amoy.polygon.technology',
    blockExplorer: 'https://amoy.polygonscan.com',
    usdcContract: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', // Mock USDC on testnet
  },
} as const;

export const GAS_LIMITS = {
  USDC_TRANSFER: 65000, // Standard ERC-20 transfer
  USDC_APPROVE: 50000,  // ERC-20 approve
  BUFFER_MULTIPLIER: 1.2, // 20% buffer for safety
} as const;

export const PAYMENT_INTENT_EXPIRY = {
  INITIAL_UNLOCK: 24 * 60 * 60, // 24 hours
  SUBSCRIPTION: 48 * 60 * 60,   // 48 hours
} as const;

export const WITHDRAWAL_LIMITS = {
  DAILY_MAX_USDC: '10000.00',
  SINGLE_TX_MAX_USDC: '5000.00',
  MINIMUM_WITHDRAWAL: '10.00',
} as const;
