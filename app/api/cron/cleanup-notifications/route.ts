/**
 * NOTIFICATION CLEANUP - Vercel Cron Job
 *
 * Runs weekly (Sunday 2am UTC) to delete old notification records.
 *
 * Deletes:
 * - Processed notifications from outbox older than 7 days
 * - Notification logs older than 90 days
 *
 * Retention policy:
 * - Outbox: 7 days (shorter because it's just queue state)
 * - Logs: 90 days (longer for audit trail and analytics)
 *
 * Security:
 * - Verifies x-vercel-cron: 1 header
 * - Verifies Authorization: Bearer <CRON_SECRET>
 *
 * Configured in vercel.json:
 *   "crons": [{ "path": "/api/cron/cleanup-notifications", "schedule": "0 2 * * 0" }]
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Use Node runtime (not Edge)
export const runtime = 'nodejs'
export const maxDuration = 60 // 60 seconds
export const dynamic = 'force-dynamic'

// Retention periods
const OUTBOX_RETENTION_DAYS = 7 // Keep processed outbox records for 7 days
const LOGS_RETENTION_DAYS = 90 // Keep notification logs for 90 days

/**
 * Verify this is a legitimate Vercel cron request or authorized manual trigger
 *
 * Accepts requests that meet EITHER condition:
 * 1. x-vercel-cron: 1 header (automatically added by Vercel) - PRIMARY
 * 2. Authorization header or query token matches CRON_SECRET (for manual testing)
 *
 * The x-vercel-cron header can only be set by Vercel infrastructure and is secure.
 */
function verifyCronRequest(request: NextRequest): boolean {
  // Check 1: Vercel cron header (can only be set by Vercel)
  const isCron = request.headers.get('x-vercel-cron') === '1'

  // Check 2: Authorization secret (for manual triggers)
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '') || request.nextUrl.searchParams.get('token')
  const validToken = token === process.env.CRON_SECRET

  // Allow if EITHER condition is met
  return isCron || validToken
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  // Security check
  if (!verifyCronRequest(request)) {
    console.error('❌ Unauthorized cleanup request')
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('🧹 Starting notification cleanup...')

  const supabase = await createClient()

  try {
    // Calculate cutoff dates
    const outboxCutoff = new Date(Date.now() - OUTBOX_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const logsCutoff = new Date(Date.now() - LOGS_RETENTION_DAYS * 24 * 60 * 60 * 1000)

    console.log(`📅 Deleting outbox records processed before: ${outboxCutoff.toISOString()}`)
    console.log(`📅 Deleting logs created before: ${logsCutoff.toISOString()}`)

    // Delete processed outbox records older than 7 days
    // Keep 'failed' records for manual review (don't delete)
    const { count: outboxDeleted, error: outboxError } = await supabase
      .from('notification_outbox')
      .delete({ count: 'exact' })
      .eq('status', 'processed')
      .lt('updated_at', outboxCutoff.toISOString())

    if (outboxError) {
      console.error('❌ Error deleting outbox records:', outboxError)
    } else {
      console.log(`✅ Deleted ${outboxDeleted || 0} processed outbox records`)
    }

    // Delete old notification logs older than 90 days
    // This maintains audit trail for compliance while preventing unbounded growth
    const { count: logsDeleted, error: logsError } = await supabase
      .from('notification_logs')
      .delete({ count: 'exact' })
      .lt('created_at', logsCutoff.toISOString())

    if (logsError) {
      console.error('❌ Error deleting logs:', logsError)
    } else {
      console.log(`✅ Deleted ${logsDeleted || 0} old notification logs`)
    }

    // Get current counts for monitoring
    const { count: outboxPending } = await supabase
      .from('notification_outbox')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    const { count: outboxFailed } = await supabase
      .from('notification_outbox')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')

    const { count: logsTotal } = await supabase
      .from('notification_logs')
      .select('*', { count: 'exact', head: true })

    const duration = Date.now() - startTime

    const result = {
      success: true,
      deleted: {
        outbox: outboxDeleted || 0,
        logs: logsDeleted || 0
      },
      current_counts: {
        outbox_pending: outboxPending || 0,
        outbox_failed: outboxFailed || 0,
        logs_total: logsTotal || 0
      },
      duration_ms: duration
    }

    console.log('🧹 Cleanup complete:', result)

    // Warn if there are many failed notifications
    if ((outboxFailed || 0) > 100) {
      console.warn(`⚠️  High number of failed notifications: ${outboxFailed}. Review failed jobs in admin panel.`)
    }

    return Response.json(result)

  } catch (error) {
    console.error('❌ Cleanup failed:', error)
    return Response.json({
      error: 'Cleanup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
