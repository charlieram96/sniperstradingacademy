/**
 * NOTIFICATION PROCESSOR - Vercel Cron Job
 *
 * Runs every minute to process pending notifications from the outbox.
 *
 * Process:
 * 1. Atomically claim batch of pending notifications (SKIP LOCKED)
 * 2. Check idempotency (skip if already sent)
 * 3. Send via SendGrid/Twilio
 * 4. Log result to notification_logs
 * 5. Update outbox status (processed/failed/retry)
 *
 * Security:
 * - Verifies x-vercel-cron: 1 header
 * - Verifies Authorization: Bearer <CRON_SECRET>
 *
 * Configured in vercel.json:
 *   "crons": [{ "path": "/api/cron/process-notifications", "schedule": "* * * * *" }]
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendNotificationDirectly } from '@/lib/notifications/direct-send'

// IMPORTANT: Use Node runtime (not Edge)
export const runtime = 'nodejs'
export const maxDuration = 60 // 60 seconds max
export const dynamic = 'force-dynamic'

const BATCH_SIZE = 250 // Process 250 notifications per run
const WORKER_ID = `cron-${process.env.VERCEL_REGION || 'local'}-${Date.now()}`

/**
 * Verify this is a legitimate Vercel cron request
 *
 * Checks two things:
 * 1. x-vercel-cron: 1 header (automatically added by Vercel)
 * 2. Authorization header or query token matches CRON_SECRET
 */
function verifyCronRequest(request: NextRequest): boolean {
  // Check 1: Vercel cron header
  const isCron = request.headers.get('x-vercel-cron') === '1'

  // Check 2: Authorization secret
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '') || request.nextUrl.searchParams.get('token')
  const validToken = token === process.env.CRON_SECRET

  return isCron && validToken
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  // Security check
  if (!verifyCronRequest(request)) {
    console.error('❌ Unauthorized cron request')
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log(`🚀 Starting notification processor (worker: ${WORKER_ID})`)

  const supabase = await createClient()

  try {
    // Step 1: Atomically claim batch with SKIP LOCKED
    const { data: claimedJobs, error: claimError } = await supabase.rpc('claim_notification_batch', {
      p_batch_size: BATCH_SIZE,
      p_worker_id: WORKER_ID,
      p_lease_seconds: 60
    })

    if (claimError) {
      console.error('❌ Error claiming batch:', claimError)
      return Response.json({
        error: 'Failed to claim batch',
        details: claimError.message
      }, { status: 500 })
    }

    if (!claimedJobs || claimedJobs.length === 0) {
      console.log('✅ No pending notifications')
      return Response.json({
        success: true,
        processed: 0,
        failed: 0,
        skipped: 0,
        message: 'No pending notifications'
      })
    }

    console.log(`📥 Claimed ${claimedJobs.length} notifications`)

    // Step 2: Process each notification
    let processed = 0
    let failed = 0
    let skipped = 0

    for (const job of claimedJobs) {
      try {
        // Idempotency guard: Check if already sent
        const { data: existing } = await supabase
          .from('notification_logs')
          .select('id')
          .eq('idempotency_key', job.idempotency_key)
          .single()

        if (existing) {
          console.log(`⏭️  Skipping duplicate: ${job.idempotency_key}`)
          skipped++

          // Mark as processed (already sent)
          await supabase
            .from('notification_outbox')
            .update({
              status: 'processed',
              updated_at: new Date().toISOString()
            })
            .eq('id', job.id)

          continue
        }

        // Send notification via existing direct-send logic
        const results = await sendNotificationDirectly(
          {
            userId: job.user_id,
            type: job.notification_type,
            channel: [job.channel],
            data: job.data
          },
          job.idempotency_key
        )

        const success = results.some(r => r.success)

        if (success) {
          // Success: Mark as processed
          await supabase
            .from('notification_outbox')
            .update({
              status: 'processed',
              updated_at: new Date().toISOString()
            })
            .eq('id', job.id)

          processed++
          console.log(`✅ Sent ${job.notification_type} to user ${job.user_id} via ${job.channel}`)
        } else {
          // Failure: Handle retry logic
          const newRetryCount = (job.retry_count || 0) + 1
          const shouldRetry = newRetryCount < (job.max_retries || 5)

          if (shouldRetry) {
            // Exponential backoff: 1min, 2min, 4min, 8min, 16min
            const delayMinutes = Math.pow(2, newRetryCount)
            const nextRetry = new Date(Date.now() + delayMinutes * 60 * 1000)

            await supabase
              .from('notification_outbox')
              .update({
                status: 'pending', // Back to pending for retry
                retry_count: newRetryCount,
                next_retry_at: nextRetry.toISOString(),
                last_error: results[0]?.error || 'Unknown error',
                last_error_at: new Date().toISOString(),
                claimed_at: null,
                claimed_by: null,
                lease_expires_at: null,
                updated_at: new Date().toISOString()
              })
              .eq('id', job.id)

            console.log(`🔄 Retry ${newRetryCount}/${job.max_retries} scheduled for ${job.id} at ${nextRetry.toISOString()}`)
          } else {
            // Max retries exceeded: Mark as failed permanently
            await supabase
              .from('notification_outbox')
              .update({
                status: 'failed',
                last_error: results[0]?.error || 'Max retries exceeded',
                last_error_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', job.id)

            console.error(`❌ Notification ${job.id} failed permanently after ${job.max_retries} attempts`)
          }

          failed++
        }
      } catch (error) {
        console.error(`❌ Error processing notification ${job.id}:`, error)
        failed++

        // On exception, schedule retry with exponential backoff
        const newRetryCount = (job.retry_count || 0) + 1
        const delayMinutes = Math.pow(2, newRetryCount)

        await supabase
          .from('notification_outbox')
          .update({
            status: 'pending',
            retry_count: newRetryCount,
            next_retry_at: new Date(Date.now() + delayMinutes * 60 * 1000).toISOString(),
            last_error: error instanceof Error ? error.message : 'Unknown error',
            last_error_at: new Date().toISOString(),
            claimed_at: null,
            claimed_by: null,
            lease_expires_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id)
      }
    }

    const duration = Date.now() - startTime
    const stats = {
      success: true,
      claimed: claimedJobs.length,
      processed,
      failed,
      skipped,
      duration_ms: duration,
      worker: WORKER_ID
    }

    console.log('✅ Cron run complete:', stats)
    return Response.json(stats)

  } catch (error) {
    console.error('❌ Cron execution failed:', error)
    return Response.json({
      error: 'Cron execution failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
