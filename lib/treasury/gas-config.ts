/**
 * Shared gas pricing for Polygon transactions sent by the treasury system
 * (sweep-fund, sweep-execute, replace-stuck-tx).
 *
 * History: a Polygon gas-price spike to ~270 gwei in May 2026 left funding
 * transactions stuck in mempool when the cron signed at the RPC's instantaneous
 * suggestion with no buffer. These constants give every outgoing tx headroom
 * for spikes between sign-time and inclusion-time.
 */
import { ethers } from 'ethers';

// Multiply the network's recommended fee by this before signing.
export const GAS_BUFFER_MULTIPLIER = 1.5;

// Floor fallback used when feeData.maxFeePerGas / maxPriorityFeePerGas come back null.
// Polygon has been running 200+ gwei, so these are intentionally generous.
export const FALLBACK_MAX_FEE_GWEI = 300;
export const FALLBACK_PRIORITY_FEE_GWEI = 50;

// EIP-1559 replacement-tx minimum bump: ethers/most RPCs require ≥10%. We use 15% for safety.
export const REPLACEMENT_BUMP_MULTIPLIER = 1.15;

/**
 * Apply a decimal multiplier to a bigint fee value without losing precision.
 * Returns null if input is null (so callers can fall back to floor constants).
 */
export function applyMultiplier(fee: bigint | null | undefined, multiplier: number): bigint | null {
  if (fee == null) return null;
  // Scale through integer math to avoid bigint→Number loss on large fees.
  const scaled = Math.round(multiplier * 1000);
  return (fee * BigInt(scaled)) / BigInt(1000);
}

/**
 * Pick the larger of two bigints (or the one that isn't null).
 */
export function maxFee(a: bigint | null, b: bigint | null): bigint {
  if (a == null) return b ?? BigInt(0);
  if (b == null) return a;
  return a > b ? a : b;
}

/**
 * Compute outgoing fees with buffer and floor fallback.
 * Used by sweep-fund and sweep-execute when broadcasting fresh transactions.
 */
export function computeOutgoingFees(feeData: ethers.FeeData): {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
} {
  const maxFeePerGas =
    applyMultiplier(feeData.maxFeePerGas, GAS_BUFFER_MULTIPLIER) ??
    ethers.parseUnits(String(FALLBACK_MAX_FEE_GWEI), 'gwei');
  const maxPriorityFeePerGas =
    applyMultiplier(feeData.maxPriorityFeePerGas, GAS_BUFFER_MULTIPLIER) ??
    ethers.parseUnits(String(FALLBACK_PRIORITY_FEE_GWEI), 'gwei');
  return { maxFeePerGas, maxPriorityFeePerGas };
}
