/**
 * Network Position Utilities
 *
 * This module provides utility functions for working with the global ternary tree
 * network structure in the MLM system.
 *
 * Network Position ID Format: L{level:3digits}P{position:10digits}
 * Example: L000P0000000001 (root), L005P0000000190, etc.
 *
 * Position Formula: Child positions = (parent_position - 1) × 3 + {1, 2, 3}
 */

/**
 * Represents a parsed network position
 */
export interface NetworkPosition {
  level: number
  position: number
  pos?: number // Alias for database compatibility
  positionId: string
}

/**
 * Represents a slot in the tree structure
 */
export interface AvailableSlot {
  level: number
  position: number
  positionId: string
  parentPositionId: string
  relativeLevel: number // Level relative to referrer (1-6)
}

/**
 * Parse a network position ID into its components
 * @param positionId - Network position ID (e.g., "L005P0000000190")
 * @returns Object with level and position
 */
export function parseNetworkPositionId(positionId: string): NetworkPosition {
  if (!positionId || positionId.length !== 15) {
    throw new Error(`Invalid network position ID format: ${positionId}`)
  }

  const level = parseInt(positionId.substring(1, 4), 10)
  const position = parseInt(positionId.substring(5), 10)

  if (isNaN(level) || isNaN(position)) {
    throw new Error(`Invalid network position ID format: ${positionId}`)
  }

  return { level, position, positionId }
}

/**
 * Format a network position ID from level and position
 * @param level - Tree level (0 for root)
 * @param position - Position at that level
 * @returns Formatted network position ID
 */
export function formatNetworkPositionId(level: number, position: number): string {
  if (level < 0 || position < 1) {
    throw new Error(`Invalid level (${level}) or position (${position})`)
  }

  const levelStr = level.toString().padStart(3, '0')
  const positionStr = position.toString().padStart(10, '0')

  return `L${levelStr}P${positionStr}`
}

/**
 * Calculate the three child positions for a given parent position
 * @param parentPosition - The parent's position number
 * @returns Array of three child positions
 */
export function calculateChildPositions(parentPosition: number): [number, number, number] {
  if (parentPosition < 1) {
    throw new Error(`Invalid parent position: ${parentPosition}`)
  }

  const base = (parentPosition - 1) * 3
  return [base + 1, base + 2, base + 3]
}

/**
 * Calculate the parent position from a child position
 * @param childPosition - The child's position number
 * @returns Parent position number
 */
export function getParentPosition(childPosition: number): number {
  if (childPosition < 1) {
    throw new Error(`Invalid child position: ${childPosition}`)
  }

  return Math.floor((childPosition - 1) / 3) + 1
}

/**
 * Get the parent network position ID
 * @param childPositionId - Child's network position ID
 * @returns Parent's network position ID, or null if child is root
 */
export function getParentPositionId(childPositionId: string): string | null {
  const { level, position } = parseNetworkPositionId(childPositionId)

  if (level === 0) {
    return null // Root has no parent
  }

  const parentPosition = getParentPosition(position)
  return formatNetworkPositionId(level - 1, parentPosition)
}

/**
 * Calculate all positions at a specific level relative to a parent
 * @param parentPosition - Parent's position number
 * @param relativeLevel - Level relative to parent (1-6)
 * @returns Array of all positions at that level in parent's subtree
 */
export function getPositionsAtLevel(parentPosition: number, relativeLevel: number): number[] {
  if (relativeLevel < 1) {
    throw new Error(`Relative level must be >= 1, got ${relativeLevel}`)
  }

  const positionsCount = Math.pow(3, relativeLevel)
  const startPosition = (parentPosition - 1) * positionsCount + 1
  const endPosition = startPosition + positionsCount - 1

  const positions: number[] = []
  for (let i = startPosition; i <= endPosition; i++) {
    positions.push(i)
  }

  return positions
}

/**
 * Calculate maximum positions at a given level
 * @param level - Tree level (0 for root)
 * @returns Maximum number of positions at that level
 */
export function getMaxPositionsAtLevel(level: number): number {
  if (level === 0) return 1
  return Math.pow(3, level)
}

/**
 * Calculate which child slot (1, 2, or 3) a position represents
 * @param position - Position number
 * @returns Child slot number (1, 2, or 3)
 */
export function getChildSlotNumber(position: number): 1 | 2 | 3 {
  const remainder = (position - 1) % 3
  return (remainder + 1) as 1 | 2 | 3
}

/**
 * Calculate structure completion (how many 1092-person structures are filled)
 * @param totalNetworkSize - Total number of people in network
 * @returns Object with structure stats
 */
export function calculateStructureStats(totalNetworkSize: number): {
  completedStructures: number
  currentStructureProgress: number
  currentStructurePercentage: number
  totalPossibleEarnings: number
  structureNumber: number
} {
  const MEMBERS_PER_STRUCTURE = 1092
  const completedStructures = Math.floor(totalNetworkSize / MEMBERS_PER_STRUCTURE)
  const currentStructureProgress = totalNetworkSize % MEMBERS_PER_STRUCTURE
  const currentStructurePercentage = (currentStructureProgress / MEMBERS_PER_STRUCTURE) * 100
  const structureNumber = completedStructures + 1

  return {
    completedStructures,
    currentStructureProgress,
    currentStructurePercentage,
    totalPossibleEarnings: totalNetworkSize * 199, // $199 per member
    structureNumber: Math.min(structureNumber, 6) // Max 6 structures
  }
}

/**
 * Calculate commission rate based on number of structures
 * @param structureCount - Number of completed structures
 * @returns Commission rate (0.10 - 0.16)
 */
export function getCommissionRate(structureCount: number): number {
  const baseRate = 0.10 // 10% base
  const bonusRate = Math.min(structureCount - 1, 5) * 0.01 // 1% per additional structure, max 5
  return baseRate + bonusRate
}

/**
 * Calculate required direct referrals for withdrawal
 * @param structureCount - Number of structures user has
 * @returns Required number of direct referrals
 */
export function getRequiredDirectReferrals(structureCount: number): number {
  return structureCount * 3
}

/**
 * Check if user can withdraw based on direct referrals
 * @param directReferralCount - Number of direct referrals user has
 * @param completedStructures - Number of completed structures
 * @returns Object with withdrawal eligibility info
 */
export function canWithdrawEarnings(
  directReferralCount: number,
  completedStructures: number
): {
  canWithdraw: boolean
  requiredReferrals: number
  currentReferrals: number
  deficit: number
  message: string
} {
  const requiredReferrals = getRequiredDirectReferrals(completedStructures)
  const canWithdraw = directReferralCount >= requiredReferrals
  const deficit = Math.max(0, requiredReferrals - directReferralCount)

  let message = ''
  if (canWithdraw) {
    message = `You can withdraw earnings from ${completedStructures} structure${completedStructures !== 1 ? 's' : ''}`
  } else {
    message = `Need ${deficit} more direct referral${deficit !== 1 ? 's' : ''} to withdraw from structure ${completedStructures}`
  }

  return {
    canWithdraw,
    requiredReferrals,
    currentReferrals: directReferralCount,
    deficit,
    message
  }
}

/**
 * Get the upline chain (all ancestors) for a position
 * Note: This is a client-side version that calculates positions.
 * For actual user data, use the database function.
 *
 * @param positionId - Starting network position ID
 * @returns Array of network position IDs from child to root
 */
export function getUplineChain(positionId: string): string[] {
  const chain: string[] = []
  let currentId = positionId

  while (currentId) {
    chain.push(currentId)
    const parent = getParentPositionId(currentId)
    if (!parent) break
    currentId = parent
  }

  return chain
}

/**
 * Calculate the depth of a position in the tree
 * @param positionId - Network position ID
 * @returns Depth (0 for root, 1 for level 1, etc.)
 */
export function getDepth(positionId: string): number {
  return parseNetworkPositionId(positionId).level
}

/**
 * Check if position A is an ancestor of position B
 * @param ancestorId - Potential ancestor position ID
 * @param descendantId - Potential descendant position ID
 * @returns True if ancestorId is an ancestor of descendantId
 */
export function isAncestor(ancestorId: string, descendantId: string): boolean {
  const upline = getUplineChain(descendantId)
  return upline.includes(ancestorId)
}

/**
 * Format position ID for display
 * @param positionId - Network position ID
 * @param format - Display format ('full', 'short', 'level-only', 'position-only')
 * @returns Formatted string
 */
export function formatPositionForDisplay(
  positionId: string,
  format: 'full' | 'short' | 'level-only' | 'position-only' = 'full'
): string {
  const { level, position } = parseNetworkPositionId(positionId)

  switch (format) {
    case 'full':
      return positionId
    case 'short':
      return `L${level}P${position}`
    case 'level-only':
      return `Level ${level}`
    case 'position-only':
      return `Position ${position}`
    default:
      return positionId
  }
}

/**
 * Constants
 */
export const NETWORK_CONSTANTS = {
  ROOT_POSITION_ID: 'L000P0000000001',
  MAX_DEPTH: 6, // Max levels below a user
  MEMBERS_PER_STRUCTURE: 1092,
  MAX_STRUCTURES: 6,
  MAX_NETWORK_SIZE: 1092 * 6, // 6,552
  CHILDREN_PER_NODE: 3,
  MONTHLY_CONTRIBUTION: 199,
  BASE_COMMISSION_RATE: 0.10,
  MAX_COMMISSION_RATE: 0.16,
  DIRECT_REFERRALS_PER_STRUCTURE: 3,
  INACTIVE_GRACE_PERIOD_DAYS: 90
} as const
