/**
 * Polygon Event Scanner
 * Scans USDC Transfer events for deposit detection and tx hash retrieval
 */

import { ethers } from 'ethers';

// Polygon USDC contract address (native USDC)
const USDC_CONTRACT_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';

// Transfer event topic (keccak256("Transfer(address,address,uint256)"))
const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');

// ERC-20 Transfer event ABI
const TRANSFER_EVENT_ABI = ['event Transfer(address indexed from, address indexed to, uint256 value)'];

export interface TransferEvent {
  txHash: string;
  blockNumber: number;
  from: string;
  to: string;
  value: bigint;
  logIndex: number;
}

export interface DepositMatch {
  depositAddress: string;
  txHash: string;
  amount: bigint;
  from: string;
  blockNumber: number;
}

/**
 * Get JSON RPC provider for Polygon
 */
function getProvider(): ethers.JsonRpcProvider {
  const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
  return new ethers.JsonRpcProvider(rpcUrl);
}

/**
 * Find the transaction hash for a deposit to a specific address
 * Scans Transfer events where `to` matches the deposit address
 */
export async function findDepositTransactionHash(
  depositAddress: string,
  sinceBlock?: number | 'latest'
): Promise<TransferEvent | null> {
  const provider = getProvider();

  try {
    // Default to last 10000 blocks if not specified (about 5-6 hours on Polygon)
    let fromBlock = sinceBlock;
    if (!fromBlock || fromBlock === 'latest') {
      const currentBlock = await provider.getBlockNumber();
      fromBlock = Math.max(0, currentBlock - 10000);
    }

    // Pad the deposit address to 32 bytes for topic matching
    const toAddressTopic = ethers.zeroPadValue(depositAddress.toLowerCase(), 32);

    const logs = await provider.getLogs({
      address: USDC_CONTRACT_ADDRESS,
      topics: [
        TRANSFER_TOPIC,
        null, // from: any
        toAddressTopic, // to: our deposit address
      ],
      fromBlock,
      toBlock: 'latest',
    });

    if (logs.length === 0) {
      return null;
    }

    // Parse the most recent transfer (last in array)
    const log = logs[logs.length - 1];
    const iface = new ethers.Interface(TRANSFER_EVENT_ABI);
    const parsed = iface.parseLog({
      topics: log.topics as string[],
      data: log.data,
    });

    if (!parsed) {
      return null;
    }

    return {
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      from: parsed.args[0],
      to: parsed.args[1],
      value: parsed.args[2],
      logIndex: log.index,
    };
  } catch (error) {
    console.error('[EventScanner] Error finding deposit tx hash:', error);
    return null;
  }
}

/**
 * Scan for deposits to multiple addresses in a block range
 * More efficient than checking balances one by one
 */
export async function scanRecentDeposits(
  depositAddresses: string[],
  fromBlock: number,
  toBlock?: number | 'latest'
): Promise<DepositMatch[]> {
  if (depositAddresses.length === 0) {
    return [];
  }

  const provider = getProvider();
  const matches: DepositMatch[] = [];

  try {
    // Create a map for quick lookup
    const addressMap = new Set(
      depositAddresses.map((addr) => addr.toLowerCase())
    );

    // Fetch all Transfer events for USDC in the block range
    // Note: We can't filter by multiple `to` addresses in one query,
    // so we fetch all and filter locally
    const logs = await provider.getLogs({
      address: USDC_CONTRACT_ADDRESS,
      topics: [TRANSFER_TOPIC],
      fromBlock,
      toBlock: toBlock || 'latest',
    });

    const iface = new ethers.Interface(TRANSFER_EVENT_ABI);

    for (const log of logs) {
      const parsed = iface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });

      if (!parsed) continue;

      const toAddress = (parsed.args[1] as string).toLowerCase();

      // Check if this transfer is to one of our deposit addresses
      if (addressMap.has(toAddress)) {
        matches.push({
          depositAddress: toAddress,
          txHash: log.transactionHash,
          amount: parsed.args[2],
          from: parsed.args[0],
          blockNumber: log.blockNumber,
        });
      }
    }

    return matches;
  } catch (error) {
    console.error('[EventScanner] Error scanning recent deposits:', error);
    return [];
  }
}

/**
 * Get the current block number on Polygon
 */
export async function getCurrentBlockNumber(): Promise<number> {
  const provider = getProvider();
  return provider.getBlockNumber();
}

/**
 * Get USDC balance for an address (in smallest units)
 */
export async function getUsdcBalance(address: string): Promise<bigint> {
  const provider = getProvider();

  try {
    const usdcContract = new ethers.Contract(
      USDC_CONTRACT_ADDRESS,
      ['function balanceOf(address) view returns (uint256)'],
      provider
    );

    const balance = await usdcContract.balanceOf(address);
    return balance;
  } catch (error) {
    console.error('[EventScanner] Error getting USDC balance:', error);
    return BigInt(0);
  }
}

/**
 * Batch get USDC balances for multiple addresses
 * Uses multicall if available, otherwise sequential calls
 */
export async function batchGetUsdcBalances(
  addresses: string[]
): Promise<Map<string, bigint>> {
  const provider = getProvider();
  const results = new Map<string, bigint>();

  try {
    const usdcContract = new ethers.Contract(
      USDC_CONTRACT_ADDRESS,
      ['function balanceOf(address) view returns (uint256)'],
      provider
    );

    // For now, sequential calls (can be optimized with multicall later)
    const promises = addresses.map(async (address) => {
      try {
        const balance = await usdcContract.balanceOf(address);
        return { address: address.toLowerCase(), balance };
      } catch {
        return { address: address.toLowerCase(), balance: BigInt(0) };
      }
    });

    const balances = await Promise.all(promises);

    for (const { address, balance } of balances) {
      results.set(address, balance);
    }

    return results;
  } catch (error) {
    console.error('[EventScanner] Error batch getting balances:', error);
    return results;
  }
}

/**
 * Get total USDC received at an address since a specific block
 * Sums all incoming Transfer events
 */
export async function getTotalReceivedSince(
  address: string,
  sinceBlock: number
): Promise<{ total: bigint; txHashes: string[] }> {
  const provider = getProvider();
  let total = BigInt(0);
  const txHashes: string[] = [];

  try {
    const toAddressTopic = ethers.zeroPadValue(address.toLowerCase(), 32);

    const logs = await provider.getLogs({
      address: USDC_CONTRACT_ADDRESS,
      topics: [TRANSFER_TOPIC, null, toAddressTopic],
      fromBlock: sinceBlock,
      toBlock: 'latest',
    });

    const iface = new ethers.Interface(TRANSFER_EVENT_ABI);

    for (const log of logs) {
      const parsed = iface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });

      if (parsed) {
        total += parsed.args[2];
        txHashes.push(log.transactionHash);
      }
    }

    return { total, txHashes };
  } catch (error) {
    console.error('[EventScanner] Error getting total received:', error);
    return { total, txHashes };
  }
}
