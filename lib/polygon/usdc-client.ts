/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// =============================================
// Polygon USDC Client
// Direct blockchain interaction using ethers.js
// =============================================

import { ethers } from 'ethers';
import { POLYGON_CONFIG, GAS_LIMITS, ServiceResponse } from '../coinbase/wallet-types';

// USDC ERC-20 ABI (minimal interface for transfers)
const USDC_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

export interface USDCBalance {
  address: string;
  balance: string; // Human-readable (e.g., "1234.567890")
  balanceRaw: string; // Wei format (e.g., "1234567890")
  decimals: number;
  blockNumber: number;
}

export interface USDCTransferResult {
  txHash: string;
  from: string;
  to: string;
  amount: string;
  gasUsed: string;
  gasPrice: string;
  blockNumber?: number;
  status: 'pending' | 'confirmed' | 'failed';
}

export interface GasEstimate {
  gasLimit: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  estimatedCostMATIC: string;
  estimatedCostUSD: string;
}

class PolygonUSDCClient {
  private provider: ethers.JsonRpcProvider;
  private usdcContract: ethers.Contract;
  private network: 'polygon' | 'polygon-testnet';
  private config: typeof POLYGON_CONFIG.MAINNET | typeof POLYGON_CONFIG.TESTNET;

  constructor() {
    this.network = (process.env.POLYGON_NETWORK as 'polygon' | 'polygon-testnet') || 'polygon';
    this.config = this.network === 'polygon' ? POLYGON_CONFIG.MAINNET : POLYGON_CONFIG.TESTNET;

    // Initialize provider
    const rpcUrl = process.env.POLYGON_RPC_URL || this.config.rpcUrl;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    // Initialize USDC contract
    this.usdcContract = new ethers.Contract(
      this.config.usdcContract,
      USDC_ABI,
      this.provider
    );
  }

  /**
   * Get USDC balance for an address
   */
  async getBalance(address: string): Promise<ServiceResponse<USDCBalance>> {
    try {
      if (!ethers.isAddress(address)) {
        return {
          success: false,
          error: {
            code: 'INVALID_ADDRESS',
            message: 'Invalid Ethereum address format',
          },
        };
      }

      const [balanceRaw, blockNumber] = await Promise.all([
        this.usdcContract.balanceOf(address),
        this.provider.getBlockNumber(),
      ]);

      // USDC has 6 decimals
      const balance = ethers.formatUnits(balanceRaw, 6);

      return {
        success: true,
        data: {
          address,
          balance,
          balanceRaw: balanceRaw.toString(),
          decimals: 6,
          blockNumber,
        },
      };
    } catch (error: any) {
      console.error('[PolygonUSDCClient] getBalance error:', error);
      return {
        success: false,
        error: {
          code: 'BALANCE_FETCH_FAILED',
          message: error.message || 'Failed to fetch balance',
          details: error,
        },
      };
    }
  }

  /**
   * Get MATIC balance for gas payments
   */
  async getMATICBalance(address: string): Promise<ServiceResponse<string>> {
    try {
      if (!ethers.isAddress(address)) {
        return {
          success: false,
          error: {
            code: 'INVALID_ADDRESS',
            message: 'Invalid Ethereum address format',
          },
        };
      }

      const balanceWei = await this.provider.getBalance(address);
      const balanceMATIC = ethers.formatEther(balanceWei);

      return {
        success: true,
        data: balanceMATIC,
      };
    } catch (error: any) {
      console.error('[PolygonUSDCClient] getMATICBalance error:', error);
      return {
        success: false,
        error: {
          code: 'BALANCE_FETCH_FAILED',
          message: error.message || 'Failed to fetch MATIC balance',
          details: error,
        },
      };
    }
  }

  /**
   * Transfer USDC (requires signer)
   * Used by platform for payouts and internal transfers
   */
  async transfer(
    fromPrivateKey: string,
    toAddress: string,
    amountUSDC: string
  ): Promise<ServiceResponse<USDCTransferResult>> {
    try {
      // Validate inputs
      if (!ethers.isAddress(toAddress)) {
        return {
          success: false,
          error: {
            code: 'INVALID_ADDRESS',
            message: 'Invalid destination address',
          },
        };
      }

      const amountNum = parseFloat(amountUSDC);
      if (isNaN(amountNum) || amountNum <= 0) {
        return {
          success: false,
          error: {
            code: 'INVALID_AMOUNT',
            message: 'Invalid amount',
          },
        };
      }

      // Create wallet (signer)
      const wallet = new ethers.Wallet(fromPrivateKey, this.provider);
      const usdcWithSigner = this.usdcContract.connect(wallet);

      // Convert amount to USDC units (6 decimals)
      const amountRaw = ethers.parseUnits(amountUSDC, 6);

      // Check sender balance
      const balanceResponse = await this.getBalance(wallet.address);
      if (!balanceResponse.success || !balanceResponse.data) {
        return {
          success: false,
          error: {
            code: 'BALANCE_CHECK_FAILED',
            message: 'Could not verify sender balance',
          },
        };
      }

      if (parseFloat(balanceResponse.data.balance) < amountNum) {
        return {
          success: false,
          error: {
            code: 'INSUFFICIENT_BALANCE',
            message: `Insufficient USDC balance. Have: ${balanceResponse.data.balance}, Need: ${amountUSDC}`,
          },
        };
      }

      // Estimate gas
      const gasEstimate = await this.estimateTransferGas(wallet.address, toAddress, amountUSDC);
      if (!gasEstimate.success || !gasEstimate.data) {
        return {
          success: false,
          error: {
            code: 'GAS_ESTIMATION_FAILED',
            message: 'Could not estimate gas',
          },
        };
      }

      // Execute transfer (cast to any for ethers v6 typing)
      const tx = await (usdcWithSigner as any).transfer(toAddress, amountRaw, {
        gasLimit: gasEstimate.data.gasLimit,
        maxFeePerGas: gasEstimate.data.maxFeePerGas,
        maxPriorityFeePerGas: gasEstimate.data.maxPriorityFeePerGas,
      });

      console.log('[PolygonUSDCClient] Transfer initiated:', tx.hash);

      return {
        success: true,
        data: {
          txHash: tx.hash,
          from: wallet.address,
          to: toAddress,
          amount: amountUSDC,
          gasUsed: '0', // Will be updated after confirmation
          gasPrice: ethers.formatUnits(gasEstimate.data.maxFeePerGas, 'gwei'),
          status: 'pending',
        },
      };
    } catch (error: any) {
      console.error('[PolygonUSDCClient] transfer error:', error);
      return {
        success: false,
        error: {
          code: 'TRANSFER_FAILED',
          message: error.message || 'Transfer failed',
          details: error,
        },
      };
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForConfirmation(
    txHash: string,
    confirmations: number = 1
  ): Promise<ServiceResponse<USDCTransferResult>> {
    try {
      console.log(`[PolygonUSDCClient] Waiting for ${confirmations} confirmations...`);

      const receipt = await this.provider.waitForTransaction(txHash, confirmations);

      if (!receipt) {
        return {
          success: false,
          error: {
            code: 'TX_NOT_FOUND',
            message: 'Transaction not found',
          },
        };
      }

      const status = receipt.status === 1 ? 'confirmed' : 'failed';

      // Parse transfer event to get from/to/amount
      let from = '';
      let to = '';
      let amount = '0';

      for (const log of receipt.logs) {
        try {
          const parsed = this.usdcContract.interface.parseLog({
            topics: [...log.topics],
            data: log.data,
          });

          if (parsed && parsed.name === 'Transfer') {
            from = parsed.args[0];
            to = parsed.args[1];
            amount = ethers.formatUnits(parsed.args[2], 6);
            break;
          }
        } catch (e) {
          // Not a USDC transfer event, skip
          continue;
        }
      }

      return {
        success: true,
        data: {
          txHash: receipt.hash,
          from,
          to,
          amount,
          gasUsed: receipt.gasUsed.toString(),
          gasPrice: ethers.formatUnits(receipt.gasPrice || BigInt(0), 'gwei'),
          blockNumber: receipt.blockNumber,
          status,
        },
      };
    } catch (error: any) {
      console.error('[PolygonUSDCClient] waitForConfirmation error:', error);
      return {
        success: false,
        error: {
          code: 'CONFIRMATION_FAILED',
          message: error.message || 'Failed to confirm transaction',
          details: error,
        },
      };
    }
  }

  /**
   * Estimate gas for USDC transfer
   */
  async estimateTransferGas(
    fromAddress: string,
    toAddress: string,
    amountUSDC: string
  ): Promise<ServiceResponse<GasEstimate>> {
    try {
      const amountRaw = ethers.parseUnits(amountUSDC, 6);

      // Estimate gas limit - must specify 'from' address or ethers uses zero address
      const gasLimitEstimate = await this.usdcContract.transfer.estimateGas(toAddress, amountRaw, { from: fromAddress });

      // Add buffer for safety
      const gasLimit = (gasLimitEstimate * BigInt(Math.floor(GAS_LIMITS.BUFFER_MULTIPLIER * 100))) / BigInt(100);

      // Get current gas prices
      const feeData = await this.provider.getFeeData();

      const maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits('100', 'gwei');
      const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('30', 'gwei');

      // Calculate estimated cost in MATIC
      const estimatedCostWei = gasLimit * maxFeePerGas;
      const estimatedCostMATIC = ethers.formatEther(estimatedCostWei);

      // Get MATIC price (placeholder - integrate price oracle)
      const maticPriceUSD = parseFloat(process.env.MATIC_PRICE_USD || '0.50');
      const estimatedCostUSD = (parseFloat(estimatedCostMATIC) * maticPriceUSD).toFixed(4);

      return {
        success: true,
        data: {
          gasLimit: gasLimit.toString(),
          maxFeePerGas: maxFeePerGas.toString(),
          maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
          estimatedCostMATIC,
          estimatedCostUSD,
        },
      };
    } catch (error: any) {
      console.error('[PolygonUSDCClient] estimateTransferGas error:', error);
      return {
        success: false,
        error: {
          code: 'GAS_ESTIMATION_FAILED',
          message: error.message || 'Gas estimation failed',
          details: error,
        },
      };
    }
  }

  /**
   * Monitor address for incoming USDC transfers
   * Returns when balance increases or timeout
   */
  async waitForIncomingTransfer(
    address: string,
    expectedAmount: string,
    timeoutSeconds: number = 300
  ): Promise<ServiceResponse<{ received: boolean; actualAmount: string; txHash?: string }>> {
    try {
      const expectedNum = parseFloat(expectedAmount);
      const startTime = Date.now();

      // Get initial balance
      const initialBalanceResponse = await this.getBalance(address);
      if (!initialBalanceResponse.success || !initialBalanceResponse.data) {
        return {
          success: false,
          error: {
            code: 'BALANCE_CHECK_FAILED',
            message: 'Could not check initial balance',
          },
        };
      }

      const initialBalance = parseFloat(initialBalanceResponse.data.balance);

      console.log(`[PolygonUSDCClient] Monitoring ${address} for ${expectedAmount} USDC...`);
      console.log(`[PolygonUSDCClient] Initial balance: ${initialBalance} USDC`);

      return new Promise((resolve) => {
        // Set up transfer event listener
        const filter = this.usdcContract.filters.Transfer(null, address);

        const listener = async (from: string, to: string, amount: bigint, event: any) => {
          console.log(`[PolygonUSDCClient] Transfer detected: ${ethers.formatUnits(amount, 6)} USDC`);

          const currentBalanceResponse = await this.getBalance(address);
          if (!currentBalanceResponse.success || !currentBalanceResponse.data) {
            return; // Continue listening
          }

          const currentBalance = parseFloat(currentBalanceResponse.data.balance);
          const received = currentBalance - initialBalance;

          // Check if we received enough
          if (received >= expectedNum * 0.99) { // 1% tolerance for rounding
            this.usdcContract.off(filter, listener);
            clearTimeout(timeout);

            resolve({
              success: true,
              data: {
                received: true,
                actualAmount: received.toFixed(6),
                txHash: event.log.transactionHash,
              },
            });
          }
        };

        this.usdcContract.on(filter, listener);

        // Set timeout
        const timeout = setTimeout(() => {
          this.usdcContract.off(filter, listener);

          resolve({
            success: true,
            data: {
              received: false,
              actualAmount: '0',
            },
          });
        }, timeoutSeconds * 1000);
      });
    } catch (error: any) {
      console.error('[PolygonUSDCClient] waitForIncomingTransfer error:', error);
      return {
        success: false,
        error: {
          code: 'MONITORING_FAILED',
          message: error.message || 'Failed to monitor for transfers',
          details: error,
        },
      };
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(txHash: string): Promise<ServiceResponse<any>> {
    try {
      const [tx, receipt] = await Promise.all([
        this.provider.getTransaction(txHash),
        this.provider.getTransactionReceipt(txHash),
      ]);

      return {
        success: true,
        data: {
          transaction: tx,
          receipt,
        },
      };
    } catch (error: any) {
      console.error('[PolygonUSDCClient] getTransaction error:', error);
      return {
        success: false,
        error: {
          code: 'TX_FETCH_FAILED',
          message: error.message || 'Failed to fetch transaction',
          details: error,
        },
      };
    }
  }

  /**
   * Get current network info
   */
  getNetworkConfig() {
    return this.config;
  }

  /**
   * Get block explorer URL for transaction
   */
  getExplorerUrl(txHash: string): string {
    return `${this.config.blockExplorer}/tx/${txHash}`;
  }

  /**
   * Get block explorer URL for address
   */
  getAddressExplorerUrl(address: string): string {
    return `${this.config.blockExplorer}/address/${address}`;
  }
}

// Export singleton instance
export const polygonUSDCClient = new PolygonUSDCClient();

// Export class for testing
export { PolygonUSDCClient };
