/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// =============================================
// Polygon USDC Client
// Direct blockchain interaction using ethers.js
// =============================================

import { ethers } from 'ethers';
import { POLYGON_CONFIG, GAS_LIMITS, ServiceResponse, ACCEPTED_USDC_CONTRACTS_MAINNET } from '../coinbase/wallet-types';
import { computeOutgoingFees, applyMultiplier, maxFee, REPLACEMENT_BUMP_MULTIPLIER } from '../treasury/gas-config';

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
  nonce?: number;
}

function isReplacementUnderpriced(error: any): boolean {
  return (
    error?.code === 'REPLACEMENT_UNDERPRICED' ||
    /replacement (transaction|fee)/i.test(error?.message || '')
  );
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
  private usdcBridgedContract: ethers.Contract | null;
  private network: 'polygon' | 'polygon-testnet';
  private config: typeof POLYGON_CONFIG.MAINNET | typeof POLYGON_CONFIG.TESTNET;

  constructor() {
    this.network = (process.env.POLYGON_NETWORK as 'polygon' | 'polygon-testnet') || 'polygon';
    this.config = this.network === 'polygon' ? POLYGON_CONFIG.MAINNET : POLYGON_CONFIG.TESTNET;

    // Initialize provider
    const rpcUrl = process.env.POLYGON_RPC_URL || this.config.rpcUrl;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    // Initialize native USDC contract
    this.usdcContract = new ethers.Contract(
      this.config.usdcContract,
      USDC_ABI,
      this.provider
    );

    // Initialize bridged USDC.e contract (mainnet only)
    this.usdcBridgedContract = this.network === 'polygon'
      ? new ethers.Contract(POLYGON_CONFIG.MAINNET.usdcBridgedContract, USDC_ABI, this.provider)
      : null;
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

      const balancePromises: Promise<bigint>[] = [this.usdcContract.balanceOf(address)];
      if (this.usdcBridgedContract) {
        balancePromises.push(this.usdcBridgedContract.balanceOf(address));
      }

      const [balances, blockNumber] = await Promise.all([
        Promise.all(balancePromises),
        this.provider.getBlockNumber(),
      ]);

      const balanceRaw = balances.reduce((sum, b) => sum + b, BigInt(0));

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
   * Get USDC balance per token (native vs bridged) for sweep use
   */
  async getBalancePerToken(address: string): Promise<{ native: bigint; bridged: bigint }> {
    try {
      const native: bigint = await this.usdcContract.balanceOf(address);
      const bridged: bigint = this.usdcBridgedContract
        ? await this.usdcBridgedContract.balanceOf(address)
        : BigInt(0);
      return { native, bridged };
    } catch (error) {
      console.error('[PolygonUSDCClient] getBalancePerToken error:', error);
      return { native: BigInt(0), bridged: BigInt(0) };
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

      // Pin the nonce explicitly so a bump-and-replace retry targets the same slot
      const nonce = await this.provider.getTransactionCount(wallet.address, 'pending');

      let maxFeePerGas = BigInt(gasEstimate.data.maxFeePerGas);
      let maxPriorityFeePerGas = BigInt(gasEstimate.data.maxPriorityFeePerGas);

      const sendTx = () =>
        (usdcWithSigner as any).transfer(toAddress, amountRaw, {
          gasLimit: gasEstimate.data!.gasLimit,
          maxFeePerGas,
          maxPriorityFeePerGas,
          nonce,
        });

      let tx;
      try {
        tx = await sendTx();
      } catch (sendError: any) {
        if (!isReplacementUnderpriced(sendError)) throw sendError;

        // A stuck tx already occupies this nonce (e.g. broadcast during a gas
        // spike). Replace it: fees must exceed the stuck tx's by ≥10%, so bump
        // 15% over the higher of our estimate and the network's current view.
        const feeData = await this.provider.getFeeData();
        maxFeePerGas = applyMultiplier(
          maxFee(maxFeePerGas, feeData.maxFeePerGas),
          REPLACEMENT_BUMP_MULTIPLIER
        )!;
        maxPriorityFeePerGas = applyMultiplier(
          maxFee(maxPriorityFeePerGas, feeData.maxPriorityFeePerGas),
          REPLACEMENT_BUMP_MULTIPLIER
        )!;
        console.warn(
          `[PolygonUSDCClient] Nonce ${nonce} occupied by a stuck tx; retrying as replacement at ${ethers.formatUnits(maxFeePerGas, 'gwei')} gwei`
        );
        tx = await sendTx();
      }

      console.log('[PolygonUSDCClient] Transfer initiated:', tx.hash);

      return {
        success: true,
        data: {
          txHash: tx.hash,
          from: wallet.address,
          to: toAddress,
          amount: amountUSDC,
          gasUsed: '0', // Will be updated after confirmation
          gasPrice: ethers.formatUnits(maxFeePerGas, 'gwei'),
          status: 'pending',
          nonce,
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
    confirmations: number = 1,
    timeoutMs: number = 60_000
  ): Promise<ServiceResponse<USDCTransferResult>> {
    try {
      console.log(`[PolygonUSDCClient] Waiting for ${confirmations} confirmations...`);

      let receipt;
      try {
        receipt = await this.provider.waitForTransaction(txHash, confirmations, timeoutMs);
      } catch (waitError: any) {
        // Timed out: the tx is broadcast but not yet mined (e.g. gas spike).
        // Surface a distinct code so callers record it instead of hanging
        // until the serverless function is killed.
        if (waitError?.code === 'TIMEOUT') {
          return {
            success: false,
            error: {
              code: 'CONFIRMATION_TIMEOUT',
              message: `Transaction ${txHash} broadcast but not confirmed within ${timeoutMs / 1000}s`,
            },
          };
        }
        throw waitError;
      }

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
   * Look up the current state of a broadcast transaction without waiting.
   * 'not_found' means the tx is unknown to the node (e.g. evicted from the
   * mempool without mining) — safe to re-send.
   */
  async getTransactionStatus(
    txHash: string
  ): Promise<'confirmed' | 'failed' | 'pending' | 'not_found'> {
    const receipt = await this.provider.getTransactionReceipt(txHash);
    if (receipt) return receipt.status === 1 ? 'confirmed' : 'failed';
    const tx = await this.provider.getTransaction(txHash);
    return tx ? 'pending' : 'not_found';
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

      // Get current gas prices, buffered for spikes between sign-time and
      // inclusion-time (same policy as the treasury/sweep system)
      const feeData = await this.provider.getFeeData();
      const { maxFeePerGas, maxPriorityFeePerGas } = computeOutgoingFees(feeData);

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
