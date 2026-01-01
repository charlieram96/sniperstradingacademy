/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// =============================================
// MATIC Gas Manager
// Monitors and manages gas fees for platform operations
// =============================================

import { ethers } from 'ethers';
import { POLYGON_CONFIG, ServiceResponse } from '../coinbase/wallet-types';
import { polygonUSDCClient } from './usdc-client';
import { getPayoutWalletAddress } from '../treasury/treasury-service';

export interface GasTankStatus {
  address: string;
  maticBalance: string;
  maticBalanceUSD: string;
  lowBalanceWarning: boolean;
  criticalBalanceAlert: boolean;
  estimatedTransactionsRemaining: number;
  lastChecked: Date;
}

export interface GasRefillParams {
  targetBalance: string; // Target MATIC balance
  refillAmount: string; // Amount to refill
  sourceWallet?: string; // Optional external source
}

export interface GasUsageStats {
  totalTransactions: number;
  totalMaticSpent: string;
  totalUSDCost: string;
  averageGasPerTx: string;
  period: {
    start: Date;
    end: Date;
  };
}

export interface PayoutWalletStatus {
  address: string;
  usdcBalance: string;
  maticBalance: string;
  lowBalanceWarning: boolean;
  criticalBalanceAlert: boolean;
  lastChecked: Date;
}

const GAS_THRESHOLDS = {
  LOW_BALANCE_WARNING: '100', // MATIC
  CRITICAL_BALANCE_ALERT: '50', // MATIC
  AUTO_REFILL_THRESHOLD: '25', // MATIC
  TARGET_BALANCE: '200', // MATIC
  ESTIMATED_GAS_PER_TX: '0.001', // MATIC per USDC transfer
};

const PAYOUT_WALLET_THRESHOLDS = {
  LOW_BALANCE_WARNING: parseFloat(process.env.PAYOUT_WALLET_LOW_BALANCE_WARNING || '5000'), // USDC
  CRITICAL_BALANCE_ALERT: parseFloat(process.env.PAYOUT_WALLET_CRITICAL_BALANCE || '1000'), // USDC
};

class GasManager {
  private provider: ethers.JsonRpcProvider;
  private network: 'polygon' | 'polygon-testnet';
  private config: typeof POLYGON_CONFIG.MAINNET | typeof POLYGON_CONFIG.TESTNET;
  private gasTankAddress: string;

  constructor(gasTankAddress?: string) {
    this.network = (process.env.POLYGON_NETWORK as 'polygon' | 'polygon-testnet') || 'polygon';
    this.config = this.network === 'polygon' ? POLYGON_CONFIG.MAINNET : POLYGON_CONFIG.TESTNET;

    const rpcUrl = process.env.POLYGON_RPC_URL || this.config.rpcUrl;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    // Platform's main wallet that pays gas fees
    this.gasTankAddress = gasTankAddress || process.env.PLATFORM_GAS_WALLET_ADDRESS || '';

    if (!this.gasTankAddress) {
      console.warn('[GasManager] No gas tank address configured. Gas monitoring disabled.');
    }
  }

  /**
   * Check gas tank status
   */
  async getGasTankStatus(): Promise<ServiceResponse<GasTankStatus>> {
    try {
      if (!this.gasTankAddress) {
        return {
          success: false,
          error: {
            code: 'NOT_CONFIGURED',
            message: 'Gas tank address not configured',
          },
        };
      }

      const balanceResponse = await polygonUSDCClient.getMATICBalance(this.gasTankAddress);

      if (!balanceResponse.success || !balanceResponse.data) {
        return {
          success: false,
          error: balanceResponse.error || {
            code: 'BALANCE_CHECK_FAILED',
            message: 'Could not fetch MATIC balance',
          },
        };
      }

      const maticBalance = parseFloat(balanceResponse.data);
      const maticPriceUSD = parseFloat(process.env.MATIC_PRICE_USD || '0.50');
      const maticBalanceUSD = (maticBalance * maticPriceUSD).toFixed(2);

      const lowBalanceWarning = maticBalance < parseFloat(GAS_THRESHOLDS.LOW_BALANCE_WARNING);
      const criticalBalanceAlert = maticBalance < parseFloat(GAS_THRESHOLDS.CRITICAL_BALANCE_ALERT);

      const estimatedGasPerTx = parseFloat(GAS_THRESHOLDS.ESTIMATED_GAS_PER_TX);
      const estimatedTransactionsRemaining = Math.floor(maticBalance / estimatedGasPerTx);

      return {
        success: true,
        data: {
          address: this.gasTankAddress,
          maticBalance: maticBalance.toFixed(6),
          maticBalanceUSD,
          lowBalanceWarning,
          criticalBalanceAlert,
          estimatedTransactionsRemaining,
          lastChecked: new Date(),
        },
      };
    } catch (error: any) {
      console.error('[GasManager] getGasTankStatus error:', error);
      return {
        success: false,
        error: {
          code: 'STATUS_CHECK_FAILED',
          message: error.message || 'Failed to check gas tank status',
          details: error,
        },
      };
    }
  }

  /**
   * Check if refill is needed and return recommended amount
   */
  async checkRefillNeeded(): Promise<ServiceResponse<{
    needed: boolean;
    currentBalance: string;
    recommendedRefill: string;
    urgency: 'normal' | 'warning' | 'critical';
  }>> {
    try {
      const statusResponse = await this.getGasTankStatus();

      if (!statusResponse.success || !statusResponse.data) {
        return {
          success: false,
          error: statusResponse.error,
        };
      }

      const { maticBalance, criticalBalanceAlert, lowBalanceWarning } = statusResponse.data;
      const currentBalance = parseFloat(maticBalance);
      const targetBalance = parseFloat(GAS_THRESHOLDS.TARGET_BALANCE);

      const needed = currentBalance < parseFloat(GAS_THRESHOLDS.AUTO_REFILL_THRESHOLD);
      const recommendedRefill = needed ? (targetBalance - currentBalance).toFixed(2) : '0';

      let urgency: 'normal' | 'warning' | 'critical' = 'normal';
      if (criticalBalanceAlert) urgency = 'critical';
      else if (lowBalanceWarning) urgency = 'warning';

      return {
        success: true,
        data: {
          needed,
          currentBalance: maticBalance,
          recommendedRefill,
          urgency,
        },
      };
    } catch (error: any) {
      console.error('[GasManager] checkRefillNeeded error:', error);
      return {
        success: false,
        error: {
          code: 'REFILL_CHECK_FAILED',
          message: error.message || 'Failed to check refill status',
          details: error,
        },
      };
    }
  }

  /**
   * Refill gas tank (transfer MATIC from external wallet)
   */
  async refillGasTank(params: GasRefillParams): Promise<ServiceResponse<{
    txHash: string;
    amount: string;
    newBalance: string;
  }>> {
    try {
      if (!this.gasTankAddress) {
        return {
          success: false,
          error: {
            code: 'NOT_CONFIGURED',
            message: 'Gas tank address not configured',
          },
        };
      }

      // This would require a source wallet with MATIC
      // In production, this could be:
      // 1. Manual transfer from CEX
      // 2. Automatic purchase via on-ramp
      // 3. Swap USDC → MATIC via DEX

      console.log(`[GasManager] Refill needed: ${params.refillAmount} MATIC to ${this.gasTankAddress}`);

      // TODO: Implement actual refill logic
      // For now, return mock response
      return {
        success: false,
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Automatic refill not yet implemented. Please refill manually.',
          details: {
            destination: this.gasTankAddress,
            recommendedAmount: params.refillAmount,
          },
        },
      };
    } catch (error: any) {
      console.error('[GasManager] refillGasTank error:', error);
      return {
        success: false,
        error: {
          code: 'REFILL_FAILED',
          message: error.message || 'Failed to refill gas tank',
          details: error,
        },
      };
    }
  }

  /**
   * Get gas usage statistics from database
   */
  async getGasUsageStats(
    supabase: any,
    startDate: Date,
    endDate: Date
  ): Promise<ServiceResponse<GasUsageStats>> {
    try {
      const { data, error } = await supabase
        .from('gas_usage_log')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) {
        return {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to fetch gas usage stats',
            details: error,
          },
        };
      }

      const totalTransactions = data.length;
      const totalMaticSpent = data.reduce((sum: number, log: any) => {
        return sum + parseFloat(log.matic_spent || 0);
      }, 0);

      const totalUSDCost = data.reduce((sum: number, log: any) => {
        return sum + parseFloat(log.usdc_equivalent || 0);
      }, 0);

      const averageGasPerTx = totalTransactions > 0
        ? (totalMaticSpent / totalTransactions).toFixed(6)
        : '0';

      return {
        success: true,
        data: {
          totalTransactions,
          totalMaticSpent: totalMaticSpent.toFixed(6),
          totalUSDCost: totalUSDCost.toFixed(2),
          averageGasPerTx,
          period: {
            start: startDate,
            end: endDate,
          },
        },
      };
    } catch (error: any) {
      console.error('[GasManager] getGasUsageStats error:', error);
      return {
        success: false,
        error: {
          code: 'STATS_FETCH_FAILED',
          message: error.message || 'Failed to fetch gas usage stats',
          details: error,
        },
      };
    }
  }

  /**
   * Log gas usage to database
   */
  async logGasUsage(
    supabase: any,
    params: {
      transactionId: string;
      transactionType: string;
      gasUsed: number;
      gasPriceGwei: string;
      maticSpent: string;
      txHash: string;
      blockNumber?: number;
    }
  ): Promise<ServiceResponse<any>> {
    try {
      const maticPriceUSD = parseFloat(process.env.MATIC_PRICE_USD || '0.50');
      const usdcEquivalent = (parseFloat(params.maticSpent) * maticPriceUSD).toFixed(6);

      const { data, error } = await supabase
        .from('gas_usage_log')
        .insert({
          transaction_id: params.transactionId,
          transaction_type: params.transactionType,
          gas_used: params.gasUsed,
          gas_price_gwei: params.gasPriceGwei,
          matic_spent: params.maticSpent,
          usdc_equivalent: usdcEquivalent,
          matic_price_usd: maticPriceUSD.toFixed(6),
          polygon_tx_hash: params.txHash,
          block_number: params.blockNumber,
        })
        .select()
        .single();

      if (error) {
        console.error('[GasManager] Failed to log gas usage:', error);
        // Don't fail the transaction if logging fails
        return {
          success: false,
          error: {
            code: 'LOG_FAILED',
            message: 'Failed to log gas usage',
            details: error,
          },
        };
      }

      return { success: true, data };
    } catch (error: any) {
      console.error('[GasManager] logGasUsage error:', error);
      return {
        success: false,
        error: {
          code: 'LOG_FAILED',
          message: error.message || 'Failed to log gas usage',
          details: error,
        },
      };
    }
  }

  /**
   * Send low balance alert
   */
  async sendLowBalanceAlert(supabase: any, status: GasTankStatus): Promise<void> {
    try {
      // Get admin users
      const { data: admins } = await supabase
        .from('users')
        .select('id, email, full_name')
        .in('role', ['admin', 'superadmin', 'superadmin+']);

      if (!admins || admins.length === 0) {
        console.warn('[GasManager] No admins found to send alert');
        return;
      }

      const urgency = status.criticalBalanceAlert ? 'CRITICAL' : 'WARNING';
      const message = `
        ${urgency}: Gas Tank Low Balance

        Address: ${status.address}
        Current Balance: ${status.maticBalance} MATIC (~$${status.maticBalanceUSD})
        Estimated Transactions Remaining: ${status.estimatedTransactionsRemaining}

        ${status.criticalBalanceAlert
          ? 'IMMEDIATE ACTION REQUIRED: Refill gas tank to continue operations.'
          : 'Action needed soon: Please refill gas tank.'
        }

        Recommended refill: ${GAS_THRESHOLDS.TARGET_BALANCE} MATIC
      `.trim();

      console.log(`[GasManager] ${urgency} Alert:`, message);

      // TODO: Send actual notifications via email/SMS
      // For now, just log

      // You can integrate with your notification service:
      // await notificationService.sendEmail({
      //   to: admins.map(a => a.email),
      //   subject: `${urgency}: Platform Gas Tank Low Balance`,
      //   body: message
      // });

    } catch (error) {
      console.error('[GasManager] sendLowBalanceAlert error:', error);
    }
  }

  /**
   * Check payout wallet status (USDC + MATIC for gas)
   */
  async getPayoutWalletStatus(): Promise<ServiceResponse<PayoutWalletStatus>> {
    try {
      // Get payout address from database first, then fall back to env vars
      const payoutAddress = await getPayoutWalletAddress();

      if (!payoutAddress) {
        return {
          success: false,
          error: {
            code: 'NOT_CONFIGURED',
            message: 'Payout wallet address not configured',
          },
        };
      }

      const addressToCheck = payoutAddress;

      const [usdcResponse, maticResponse] = await Promise.all([
        polygonUSDCClient.getBalance(addressToCheck),
        polygonUSDCClient.getMATICBalance(addressToCheck),
      ]);

      if (!usdcResponse.success || !usdcResponse.data) {
        return {
          success: false,
          error: usdcResponse.error || {
            code: 'BALANCE_CHECK_FAILED',
            message: 'Could not fetch USDC balance',
          },
        };
      }

      const usdcBalance = parseFloat(usdcResponse.data.balance);
      const maticBalance = maticResponse.success ? maticResponse.data! : '0';

      const lowBalanceWarning = usdcBalance < PAYOUT_WALLET_THRESHOLDS.LOW_BALANCE_WARNING;
      const criticalBalanceAlert = usdcBalance < PAYOUT_WALLET_THRESHOLDS.CRITICAL_BALANCE_ALERT;

      return {
        success: true,
        data: {
          address: addressToCheck,
          usdcBalance: usdcBalance.toFixed(6),
          maticBalance,
          lowBalanceWarning,
          criticalBalanceAlert,
          lastChecked: new Date(),
        },
      };
    } catch (error: any) {
      console.error('[GasManager] getPayoutWalletStatus error:', error);
      return {
        success: false,
        error: {
          code: 'STATUS_CHECK_FAILED',
          message: error.message || 'Failed to check payout wallet status',
          details: error,
        },
      };
    }
  }

  /**
   * Send low payout wallet balance alert
   */
  async sendLowPayoutWalletAlert(supabase: any, status: PayoutWalletStatus): Promise<void> {
    try {
      const { data: admins } = await supabase
        .from('users')
        .select('id, email, full_name')
        .in('role', ['admin', 'superadmin', 'superadmin+']);

      if (!admins || admins.length === 0) {
        console.warn('[GasManager] No admins found to send payout wallet alert');
        return;
      }

      const urgency = status.criticalBalanceAlert ? 'CRITICAL' : 'WARNING';
      const message = `
        ${urgency}: Payout Wallet Low USDC Balance

        Address: ${status.address}
        Current USDC Balance: ${status.usdcBalance}
        Current MATIC Balance: ${status.maticBalance}

        ${status.criticalBalanceAlert
          ? 'IMMEDIATE ACTION REQUIRED: Transfer USDC from treasury to payout wallet.'
          : 'Action needed soon: Please transfer USDC from treasury to payout wallet.'
        }

        Recommended minimum: ${PAYOUT_WALLET_THRESHOLDS.LOW_BALANCE_WARNING} USDC
      `.trim();

      console.log(`[GasManager] Payout Wallet ${urgency} Alert:`, message);

      // Log to audit
      await supabase.from('crypto_audit_log').insert({
        event_type: 'payout_wallet_low_balance',
        admin_id: null,
        entity_type: 'payout_wallet',
        entity_id: null,
        details: {
          urgency,
          address: status.address,
          usdc_balance: status.usdcBalance,
          matic_balance: status.maticBalance,
          threshold_warning: PAYOUT_WALLET_THRESHOLDS.LOW_BALANCE_WARNING,
          threshold_critical: PAYOUT_WALLET_THRESHOLDS.CRITICAL_BALANCE_ALERT,
        },
      });

    } catch (error) {
      console.error('[GasManager] sendLowPayoutWalletAlert error:', error);
    }
  }

  /**
   * Get current gas prices
   */
  async getCurrentGasPrices(): Promise<ServiceResponse<{
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    baseFee: string;
  }>> {
    try {
      const feeData = await this.provider.getFeeData();

      return {
        success: true,
        data: {
          maxFeePerGas: ethers.formatUnits(feeData.maxFeePerGas || BigInt(0), 'gwei'),
          maxPriorityFeePerGas: ethers.formatUnits(feeData.maxPriorityFeePerGas || BigInt(0), 'gwei'),
          baseFee: ethers.formatUnits(feeData.gasPrice || BigInt(0), 'gwei'),
        },
      };
    } catch (error: any) {
      console.error('[GasManager] getCurrentGasPrices error:', error);
      return {
        success: false,
        error: {
          code: 'GAS_PRICE_FETCH_FAILED',
          message: error.message || 'Failed to fetch gas prices',
          details: error,
        },
      };
    }
  }

  /**
   * Set gas tank address
   */
  setGasTankAddress(address: string): void {
    if (!ethers.isAddress(address)) {
      throw new Error('Invalid gas tank address');
    }
    this.gasTankAddress = address;
  }

  /**
   * Get gas tank address
   */
  getGasTankAddress(): string {
    return this.gasTankAddress;
  }

  /**
   * Estimate total gas for a batch of transactions
   */
  async estimateBatchGas(
    transactionCount: number,
    supabase: any
  ): Promise<{
    totalEstimatedMatic: string;
    totalEstimatedUSD: string;
    perTransactionMatic: string;
    gasPrice: string;
  }> {
    try {
      const feeData = await this.provider.getFeeData();
      const maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits('100', 'gwei');

      // Estimated gas per USDC transfer
      const gasPerTx = BigInt(65000); // Standard ERC-20 transfer
      const totalGas = gasPerTx * BigInt(transactionCount);
      const totalCostWei = totalGas * maxFeePerGas;

      const totalEstimatedMatic = ethers.formatEther(totalCostWei);
      const maticPriceUSD = parseFloat(process.env.MATIC_PRICE_USD || '0.50');
      const totalEstimatedUSD = (parseFloat(totalEstimatedMatic) * maticPriceUSD).toFixed(2);

      const perTransactionMatic = (parseFloat(totalEstimatedMatic) / transactionCount).toFixed(6);

      return {
        totalEstimatedMatic,
        totalEstimatedUSD,
        perTransactionMatic,
        gasPrice: ethers.formatUnits(maxFeePerGas, 'gwei'),
      };
    } catch (error) {
      console.error('[GasManager] estimateBatchGas error:', error);
      // Return default estimates
      const defaultPerTx = parseFloat(GAS_THRESHOLDS.ESTIMATED_GAS_PER_TX);
      const totalMatic = (defaultPerTx * transactionCount).toFixed(6);
      const maticPriceUSD = parseFloat(process.env.MATIC_PRICE_USD || '0.50');

      return {
        totalEstimatedMatic: totalMatic,
        totalEstimatedUSD: (parseFloat(totalMatic) * maticPriceUSD).toFixed(2),
        perTransactionMatic: defaultPerTx.toFixed(6),
        gasPrice: '100',
      };
    }
  }
}

// Export singleton instance
export const gasManager = new GasManager();

// Export class for testing
export { GasManager, GAS_THRESHOLDS, PAYOUT_WALLET_THRESHOLDS };
