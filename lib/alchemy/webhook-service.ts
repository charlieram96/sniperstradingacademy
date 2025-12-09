/**
 * Alchemy Webhook Service
 * Handles verification and parsing of Alchemy webhook notifications
 * for real-time USDC deposit detection on Polygon
 */

import { createHmac } from 'crypto';

// Polygon native USDC contract address
const USDC_CONTRACT_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';

export interface AlchemyWebhookPayload {
  webhookId: string;
  id: string;
  createdAt: string;
  type: 'ADDRESS_ACTIVITY' | 'MINED_TRANSACTION' | 'DROPPED_TRANSACTION';
  event: {
    network: string;
    activity: AlchemyActivity[];
  };
}

export interface AlchemyActivity {
  fromAddress: string;
  toAddress: string;
  blockNum: string;
  hash: string;
  value: number;
  asset: string;
  category: 'external' | 'internal' | 'erc20' | 'erc721' | 'erc1155' | 'specialnft';
  rawContract: {
    rawValue: string;
    address: string;
    decimals: number;
  };
  log?: {
    address: string;
    topics: string[];
    data: string;
    blockNumber: string;
    transactionHash: string;
    transactionIndex: string;
    blockHash: string;
    logIndex: string;
    removed: boolean;
  };
}

export interface ParsedUSDCTransfer {
  from: string;
  to: string;
  amount: bigint;
  amountUsdc: number;
  txHash: string;
  blockNumber: number;
}

/**
 * Verify Alchemy webhook signature
 * Uses HMAC-SHA256 with the signing key
 */
export function verifyAlchemySignature(
  payload: string,
  signature: string,
  signingKey: string
): boolean {
  try {
    const hmac = createHmac('sha256', signingKey);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    // Constant-time comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    let mismatch = 0;
    for (let i = 0; i < signature.length; i++) {
      mismatch |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }

    return mismatch === 0;
  } catch (error) {
    console.error('[AlchemyWebhook] Signature verification error:', error);
    return false;
  }
}

/**
 * Parse USDC transfers from Alchemy webhook payload
 * Filters to only USDC transfers on the correct contract
 */
export function parseUSDCTransfers(payload: AlchemyWebhookPayload): ParsedUSDCTransfer[] {
  const transfers: ParsedUSDCTransfer[] = [];

  if (payload.type !== 'ADDRESS_ACTIVITY' || !payload.event?.activity) {
    return transfers;
  }

  for (const activity of payload.event.activity) {
    // Only process ERC-20 transfers (Alchemy may send 'erc20' or 'token' depending on version)
    if (activity.category !== 'erc20' && activity.category !== 'token') {
      continue;
    }

    // Only process USDC transfers (check contract address)
    const contractAddress = activity.rawContract?.address?.toLowerCase();
    if (contractAddress !== USDC_CONTRACT_ADDRESS.toLowerCase()) {
      continue;
    }

    // Parse the transfer amount from raw value (USDC has 6 decimals)
    const rawValue = activity.rawContract?.rawValue || '0x0';
    const amount = BigInt(rawValue);
    const amountUsdc = Number(amount) / 1_000_000;

    transfers.push({
      from: activity.fromAddress.toLowerCase(),
      to: activity.toAddress.toLowerCase(),
      amount,
      amountUsdc,
      txHash: activity.hash,
      blockNumber: parseInt(activity.blockNum, 16),
    });
  }

  return transfers;
}

/**
 * Check if a transfer event matches our USDC contract
 */
export function isUSDCTransfer(activity: AlchemyActivity): boolean {
  if (activity.category !== 'erc20' && activity.category !== 'token') {
    return false;
  }

  const contractAddress = activity.rawContract?.address?.toLowerCase();
  return contractAddress === USDC_CONTRACT_ADDRESS.toLowerCase();
}

/**
 * Get the Alchemy webhook signing key from environment
 */
export function getAlchemySigningKey(): string {
  return process.env.ALCHEMY_WEBHOOK_SIGNING_KEY || '';
}

/**
 * Format webhook event for logging
 */
export function formatWebhookEventForLog(payload: AlchemyWebhookPayload): Record<string, unknown> {
  return {
    webhookId: payload.webhookId,
    eventId: payload.id,
    type: payload.type,
    network: payload.event?.network,
    activityCount: payload.event?.activity?.length || 0,
    createdAt: payload.createdAt,
  };
}
