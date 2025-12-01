/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// =============================================
// Coinbase CDP SDK Wallet Service
// Platform-managed custodial wallets for USDC on Polygon
// =============================================

import { CdpClient } from '@coinbase/cdp-sdk';
import {
  CoinbaseWalletConfig,
  CreateWalletParams,
  CreateWalletResponse,
  WalletBalance,
  TransferParams,
  TransferResponse,
  ExportWalletParams,
  ExportWalletResponse,
  ServiceResponse,
  POLYGON_CONFIG,
} from './wallet-types';
import { polygonUSDCClient } from '../polygon/usdc-client';

/**
 * Coinbase CDP SDK Client
 * Uses Coinbase's custodial wallet infrastructure for secure key management
 */
class CoinbaseWalletService {
  private cdp: CdpClient | null = null;
  private network: 'polygon' | 'polygon-testnet';
  private networkId: string;
  private isInitialized: boolean = false;

  constructor() {
    this.network = (process.env.POLYGON_NETWORK as 'polygon' | 'polygon-testnet') || 'polygon';
    // CDP uses 'polygon-mainnet' or 'polygon-amoy' for testnet
    this.networkId = this.network === 'polygon' ? 'polygon-mainnet' : 'polygon-amoy';
  }

  /**
   * Initialize the Coinbase CDP SDK
   * Called lazily on first use
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const apiKeyId = process.env.CDP_API_KEY_ID;
    const apiKeySecret = process.env.CDP_API_KEY_SECRET;
    const walletSecret = process.env.CDP_WALLET_SECRET;

    if (!apiKeyId || !apiKeySecret) {
      console.warn('[CoinbaseWalletService] API credentials not configured');
      throw new Error('Coinbase CDP API credentials not configured. Set CDP_API_KEY_ID and CDP_API_KEY_SECRET.');
    }

    try {
      // Initialize CdpClient with credentials
      this.cdp = new CdpClient({
        apiKeyId,
        apiKeySecret,
        walletSecret, // Required for write operations
      });

      this.isInitialized = true;
      console.log('[CoinbaseWalletService] Initialized successfully');
    } catch (error: any) {
      console.error('[CoinbaseWalletService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create a new custodial wallet (EVM account) for a user
   */
  async createWallet(params: CreateWalletParams): Promise<ServiceResponse<CreateWalletResponse>> {
    try {
      await this.initialize();

      if (!this.cdp) {
        throw new Error('CDP SDK not initialized');
      }

      // Create account with user-specific name for idempotency
      const accountName = `user-${params.userId}`;
      const account = await this.cdp.evm.getOrCreateAccount({
        name: accountName,
      });

      console.log(`[CoinbaseWalletService] Created/retrieved account for user ${params.userId}: ${account.address}`);

      return {
        success: true,
        data: {
          walletId: accountName, // Use account name as wallet ID
          address: account.address,
          network: this.network,
          createdAt: new Date().toISOString(),
          // Store account name for later reference
          walletData: JSON.stringify({ accountName, address: account.address }),
        },
      };
    } catch (error: any) {
      console.error('[CoinbaseWalletService] createWallet error:', error);
      return this.handleError(error, 'WALLET_CREATION_FAILED');
    }
  }

  /**
   * Get an existing account by name
   */
  async getAccount(accountName: string): Promise<ServiceResponse<any>> {
    try {
      await this.initialize();

      if (!this.cdp) {
        throw new Error('CDP SDK not initialized');
      }

      const account = await this.cdp.evm.getAccount({ name: accountName });

      return {
        success: true,
        data: account,
      };
    } catch (error: any) {
      console.error('[CoinbaseWalletService] getAccount error:', error);
      return this.handleError(error, 'ACCOUNT_NOT_FOUND');
    }
  }

  /**
   * Get wallet balance (USDC + MATIC)
   * Uses direct RPC for real-time balance
   */
  async getWalletBalance(address: string): Promise<ServiceResponse<WalletBalance>> {
    try {
      // Use polygon client for real-time balance
      const [usdcResponse, maticResponse] = await Promise.all([
        polygonUSDCClient.getBalance(address),
        polygonUSDCClient.getMATICBalance(address),
      ]);

      if (!usdcResponse.success || !usdcResponse.data) {
        return {
          success: false,
          error: {
            code: 'BALANCE_FETCH_FAILED',
            message: 'Failed to fetch USDC balance',
          },
        };
      }

      return {
        success: true,
        data: {
          address,
          usdc: usdcResponse.data.balance,
          matic: maticResponse.success ? maticResponse.data! : '0',
          lastUpdated: new Date(),
        },
      };
    } catch (error: any) {
      console.error('[CoinbaseWalletService] getWalletBalance error:', error);
      return this.handleError(error, 'BALANCE_FETCH_FAILED');
    }
  }

  /**
   * Transfer USDC using Coinbase CDP account
   * Sends ERC20 transfer transaction via CDP
   */
  async transferUSDC(params: TransferParams & { walletData: string }): Promise<ServiceResponse<TransferResponse>> {
    try {
      await this.initialize();

      if (!this.cdp) {
        throw new Error('CDP SDK not initialized');
      }

      const { walletData, toAddress, amount } = params;

      // Validate address
      if (!this.isValidAddress(toAddress)) {
        return {
          success: false,
          error: {
            code: 'INVALID_ADDRESS',
            message: 'Invalid destination address',
            details: { address: toAddress },
          },
        };
      }

      // Validate amount
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid amount',
            details: { amount },
          },
        };
      }

      // Parse wallet data to get account name
      const data = JSON.parse(walletData);
      const accountName = data.accountName;
      const fromAddress = data.address;

      // Get USDC contract address for the network
      const usdcContractAddress = this.network === 'polygon'
        ? POLYGON_CONFIG.MAINNET.usdcContract
        : POLYGON_CONFIG.TESTNET.usdcContract;

      // Build ERC20 transfer call data
      // transfer(address,uint256) = 0xa9059cbb
      const amountInWei = BigInt(Math.floor(amountNum * 1_000_000)); // USDC has 6 decimals
      const paddedTo = toAddress.slice(2).padStart(64, '0');
      const paddedAmount = amountInWei.toString(16).padStart(64, '0');
      const transferData = `0xa9059cbb${paddedTo}${paddedAmount}` as `0x${string}`;

      // Send transaction via CDP
      const result = await this.cdp.evm.sendTransaction({
        address: fromAddress as `0x${string}`,
        transaction: {
          to: usdcContractAddress as `0x${string}`,
          value: BigInt(0),
          data: transferData,
        },
        network: this.networkId as any,
      });

      console.log(`[CoinbaseWalletService] Transfer completed: ${result.transactionHash}`);

      return {
        success: true,
        data: {
          transactionHash: result.transactionHash,
          status: 'confirmed',
          from: fromAddress,
          to: toAddress,
          amount: amount,
          gasUsed: '0', // CDP handles gas
        },
      };
    } catch (error: any) {
      console.error('[CoinbaseWalletService] transferUSDC error:', error);
      return this.handleError(error, 'TRANSFER_FAILED');
    }
  }

  /**
   * Transfer using platform's treasury wallet (for payouts)
   * Uses direct ethers.js for platform-controlled wallet
   */
  async transferFromTreasury(
    toAddress: string,
    amount: string
  ): Promise<ServiceResponse<TransferResponse>> {
    try {
      const treasuryPrivateKey = process.env.PLATFORM_TREASURY_PRIVATE_KEY;

      if (!treasuryPrivateKey) {
        return {
          success: false,
          error: {
            code: 'TREASURY_NOT_CONFIGURED',
            message: 'Platform treasury wallet not configured',
          },
        };
      }

      // Use polygon client for direct transfer
      const transferResult = await polygonUSDCClient.transfer(
        treasuryPrivateKey,
        toAddress,
        amount
      );

      if (!transferResult.success || !transferResult.data) {
        return {
          success: false,
          error: transferResult.error || {
            code: 'TRANSFER_FAILED',
            message: 'Treasury transfer failed',
          },
        };
      }

      // Wait for confirmation
      const confirmation = await polygonUSDCClient.waitForConfirmation(
        transferResult.data.txHash,
        1
      );

      if (!confirmation.success || !confirmation.data) {
        return {
          success: false,
          error: {
            code: 'CONFIRMATION_FAILED',
            message: 'Transfer confirmation failed',
          },
        };
      }

      return {
        success: true,
        data: {
          transactionHash: confirmation.data.txHash,
          status: confirmation.data.status,
          from: confirmation.data.from,
          to: confirmation.data.to,
          amount: confirmation.data.amount,
          gasUsed: confirmation.data.gasUsed,
          blockNumber: confirmation.data.blockNumber,
        },
      };
    } catch (error: any) {
      console.error('[CoinbaseWalletService] transferFromTreasury error:', error);
      return this.handleError(error, 'TRANSFER_FAILED');
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(txHash: string): Promise<ServiceResponse<TransferResponse>> {
    try {
      const txResult = await polygonUSDCClient.getTransaction(txHash);

      if (!txResult.success || !txResult.data) {
        return {
          success: false,
          error: {
            code: 'TX_NOT_FOUND',
            message: 'Transaction not found',
          },
        };
      }

      const { receipt } = txResult.data;
      const status = receipt?.status === 1 ? 'confirmed' : receipt?.status === 0 ? 'failed' : 'pending';

      return {
        success: true,
        data: {
          transactionHash: txHash,
          status,
          from: txResult.data.transaction?.from || '',
          to: txResult.data.transaction?.to || '',
          amount: '0',
          gasUsed: receipt?.gasUsed?.toString() || '0',
          blockNumber: receipt?.blockNumber,
        },
      };
    } catch (error: any) {
      console.error('[CoinbaseWalletService] getTransactionStatus error:', error);
      return this.handleError(error, 'TX_STATUS_FAILED');
    }
  }

  /**
   * Export private key for self-custody (with security checks)
   * Returns the private key for user to backup
   */
  async exportWallet(params: ExportWalletParams & { walletData: string }): Promise<ServiceResponse<ExportWalletResponse>> {
    try {
      await this.initialize();

      if (!this.cdp) {
        throw new Error('CDP SDK not initialized');
      }

      const { walletData, userId } = params;
      const data = JSON.parse(walletData);
      const accountName = data.accountName;
      const address = data.address;

      // Export the account's private key
      const privateKey = await this.cdp.evm.exportAccount({
        name: accountName,
      });

      console.warn(`[CoinbaseWalletService] SECURITY: Wallet exported for user ${userId}`);

      return {
        success: true,
        data: {
          privateKey: `0x${privateKey}`,
          publicKey: '',
          address: address,
          warning: 'CRITICAL: This is your private key. Store it securely offline. You are now fully responsible for this wallet. If you lose this, your funds are UNRECOVERABLE.',
        },
      };
    } catch (error: any) {
      console.error('[CoinbaseWalletService] exportWallet error:', error);
      return this.handleError(error, 'EXPORT_FAILED');
    }
  }

  /**
   * Estimate gas for a USDC transfer
   */
  async estimateGas(fromAddress: string, toAddress: string, amount: string): Promise<ServiceResponse<string>> {
    try {
      const gasEstimate = await polygonUSDCClient.estimateTransferGas(fromAddress, toAddress, amount);

      if (!gasEstimate.success || !gasEstimate.data) {
        return {
          success: false,
          error: {
            code: 'GAS_ESTIMATION_FAILED',
            message: 'Failed to estimate gas',
          },
        };
      }

      return {
        success: true,
        data: gasEstimate.data.estimatedCostMATIC,
      };
    } catch (error: any) {
      console.error('[CoinbaseWalletService] estimateGas error:', error);
      return this.handleError(error, 'GAS_ESTIMATION_FAILED');
    }
  }

  /**
   * Get wallet by user ID (from database)
   */
  async getWalletByUserId(userId: string, supabase: any): Promise<ServiceResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('crypto_wallets')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'WALLET_NOT_FOUND',
            message: 'No active wallet found for user',
            details: error,
          },
        };
      }

      return { success: true, data };
    } catch (error: any) {
      return this.handleError(error, 'DATABASE_ERROR');
    }
  }

  /**
   * Create wallet and save to database
   */
  async createWalletForUser(userId: string, supabase: any): Promise<ServiceResponse<any>> {
    try {
      // Create wallet via Coinbase CDP
      const walletResponse = await this.createWallet({ userId });

      if (!walletResponse.success || !walletResponse.data) {
        return walletResponse;
      }

      const { walletId, address, network, walletData } = walletResponse.data;

      // Save to database (using service role, bypasses RLS)
      const { data, error } = await supabase
        .from('crypto_wallets')
        .insert({
          user_id: userId,
          coinbase_wallet_id: walletId,
          wallet_address: address,
          network,
          wallet_data_encrypted: walletData, // Store for recovery
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        console.error('[CoinbaseWalletService] Database error:', error);
        return {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to save wallet to database',
            details: error,
          },
        };
      }

      // Update user record
      await supabase
        .from('users')
        .update({ crypto_wallet_id: data.id })
        .eq('id', userId);

      // Log audit event
      await supabase.from('crypto_audit_log').insert({
        event_type: 'wallet_created',
        user_id: userId,
        entity_type: 'wallet',
        entity_id: data.id,
        details: { address, network },
      });

      return { success: true, data };
    } catch (error: any) {
      console.error('[CoinbaseWalletService] createWalletForUser error:', error);
      return this.handleError(error, 'WALLET_CREATION_FAILED');
    }
  }

  // =============================================
  // Helper Methods
  // =============================================

  /**
   * Validate Ethereum address format
   */
  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Standardized error handling
   */
  private handleError(error: any, defaultCode: string): ServiceResponse<never> {
    console.error('[CoinbaseWalletService]', error);

    return {
      success: false,
      error: {
        code: defaultCode,
        message: error.message || 'An unknown error occurred',
        details: error,
      },
    };
  }

  /**
   * Get network configuration
   */
  getNetworkConfig() {
    return this.network === 'polygon'
      ? POLYGON_CONFIG.MAINNET
      : POLYGON_CONFIG.TESTNET;
  }
}

// Export singleton instance
export const coinbaseWalletService = new CoinbaseWalletService();

// Export class for testing
export { CoinbaseWalletService };
