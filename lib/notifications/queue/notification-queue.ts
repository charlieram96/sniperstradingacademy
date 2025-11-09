/**
 * NOTIFICATION QUEUE (BullMQ)
 *
 * Queue system for reliable notification delivery with:
 * - Exponential backoff retry logic
 * - Job deduplication
 * - Rate limiting
 * - Dead letter queue for permanently failed jobs
 */

import { Queue, QueueEvents, Worker, Job } from 'bullmq'
import { Redis } from 'ioredis'
import type { SendNotificationParams } from '../notification-types'

/**
 * Upstash Redis Connection Configuration
 *
 * Upstash provides Redis-compatible endpoint for BullMQ.
 * Use UPSTASH_REDIS_REST_URL environment variable or standard REDIS_URL
 *
 * For Upstash, the format is: rediss://default:PASSWORD@HOST:PORT
 * - Extract from your Upstash dashboard: redis-xxxxx.upstash.io
 * - Password is your Upstash Redis password
 * - Use TLS (rediss://) for production
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL || 'redis://localhost:6379'

// Parse Upstash REST URL to Redis connection URL if needed
// Upstash REST URL format: https://xxxxx.upstash.io
// Convert to Redis URL: rediss://default:PASSWORD@xxxxx.upstash.io:PORT
let connectionUrl = REDIS_URL

// If using Upstash REST URL, construct proper Redis connection
if (REDIS_URL.startsWith('https://') && REDIS_URL.includes('upstash.io')) {
  // For Upstash, use separate environment variables
  const upstashHost = new URL(REDIS_URL).hostname
  const upstashPassword = process.env.UPSTASH_REDIS_REST_TOKEN || ''
  const upstashPort = process.env.UPSTASH_REDIS_PORT || '6379'

  connectionUrl = `rediss://default:${upstashPassword}@${upstashHost}:${upstashPort}`
}

// Create Redis connection optimized for Upstash/serverless
const connection = new Redis(connectionUrl, {
  maxRetriesPerRequest: null,  // Required for BullMQ
  enableReadyCheck: false,      // Better for serverless environments
  family: 6,                     // Prefer IPv6 (Upstash supports both)

  // Optimized for Upstash/serverless
  lazyConnect: true,             // Don't connect immediately
  enableOfflineQueue: true,      // Queue commands when disconnected
  retryStrategy: (times) => {
    if (times > 10) return null  // Stop retrying after 10 attempts
    return Math.min(times * 100, 3000)  // Exponential backoff, max 3s
  },

  // TLS for production Upstash
  tls: connectionUrl.startsWith('rediss://') ? {
    rejectUnauthorized: true
  } : undefined,

  // Connection pool settings for serverless
  keepAlive: 30000,              // Keep connections alive
  connectTimeout: 10000,         // 10s connection timeout
  commandTimeout: 5000,          // 5s command timeout
})

// Export Redis connection for use in other modules (e.g., cache invalidation)
export { connection }

// Queue names
export const NOTIFICATION_QUEUE_NAME = 'notifications'
export const DEAD_LETTER_QUEUE_NAME = 'notifications-dlq'

/**
 * Notification Queue
 *
 * Handles queueing of notification jobs with retry logic
 */
export const notificationQueue = new Queue(NOTIFICATION_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 5,  // Max retries
    backoff: {
      type: 'exponential',
      delay: 60000  // Start with 1 minute, then 2min, 4min, 8min, 16min
    },
    removeOnComplete: {
      age: 86400,  // Keep completed jobs for 24 hours
      count: 1000  // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 604800  // Keep failed jobs for 7 days
    }
  }
})

/**
 * Dead Letter Queue
 *
 * Permanently failed jobs go here for manual review
 */
export const deadLetterQueue = new Queue(DEAD_LETTER_QUEUE_NAME, {
  connection
})

/**
 * Queue Events
 *
 * Listen to queue events for monitoring
 */
export const queueEvents = new QueueEvents(NOTIFICATION_QUEUE_NAME, {
  connection
})

// Event listeners for monitoring
queueEvents.on('completed', ({ jobId }) => {
  console.log(`✅ Notification job ${jobId} completed`)
})

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`❌ Notification job ${jobId} failed:`, failedReason)
})

// Note: 'retrying' event is not available in QueueEvents
// Retry logic is handled by BullMQ automatically based on job options

/**
 * Add notification to queue
 *
 * @param params Notification parameters
 * @param options Queue job options
 * @returns Job ID
 */
export async function queueNotification(
  params: SendNotificationParams & {
    idempotencyKey: string
  },
  options?: {
    delay?: number  // Delay in milliseconds (for quiet hours)
    priority?: number  // 1 (highest) to 100 (lowest)
  }
): Promise<string> {
  const job = await notificationQueue.add(
    'send-notification',
    params,
    {
      jobId: params.idempotencyKey,  // Use idempotency key as job ID for deduplication
      delay: options?.delay,
      priority: options?.priority || 50,
      ...notificationQueue.defaultJobOptions
    }
  )

  return job.id || params.idempotencyKey
}

/**
 * Add campaign notification batch to queue
 *
 * For mass sends with rate limiting
 *
 * @param notifications Array of notification parameters
 * @param rateLimit Max sends per minute
 * @returns Array of job IDs
 */
export async function queueCampaignBatch(
  notifications: Array<SendNotificationParams & { idempotencyKey: string }>,
  rateLimit: number = 100
): Promise<string[]> {
  // Calculate delay between each message to respect rate limit
  const delayBetweenMessages = Math.ceil(60000 / rateLimit)

  const jobs = await Promise.all(
    notifications.map((notification, index) =>
      queueNotification(notification, {
        delay: index * delayBetweenMessages,  // Stagger sends
        priority: 70  // Lower priority than individual notifications
      })
    )
  )

  return jobs
}

/**
 * Get queue metrics
 *
 * @returns Queue statistics
 */
export async function getQueueMetrics() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    notificationQueue.getWaitingCount(),
    notificationQueue.getActiveCount(),
    notificationQueue.getCompletedCount(),
    notificationQueue.getFailedCount(),
    notificationQueue.getDelayedCount()
  ])

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed
  }
}

/**
 * Get failed jobs for review
 *
 * @param limit Max number of failed jobs to return
 * @returns Array of failed jobs
 */
export async function getFailedJobs(limit: number = 50): Promise<Job[]> {
  return notificationQueue.getFailed(0, limit)
}

/**
 * Retry a failed job
 *
 * @param jobId Job ID to retry
 * @returns True if successfully retried
 */
export async function retryFailedJob(jobId: string): Promise<boolean> {
  try {
    const job = await notificationQueue.getJob(jobId)
    if (job) {
      await job.retry()
      return true
    }
    return false
  } catch (error) {
    console.error('Error retrying job:', error)
    return false
  }
}

/**
 * Move permanently failed job to dead letter queue
 *
 * @param jobId Job ID
 * @param reason Reason for permanent failure
 */
export async function moveToDeadLetterQueue(
  jobId: string,
  reason: string
): Promise<void> {
  try {
    const job = await notificationQueue.getJob(jobId)
    if (job) {
      await deadLetterQueue.add(
        'permanently-failed',
        {
          originalJob: job.data,
          failureReason: reason,
          attempts: job.attemptsMade,
          failedAt: new Date().toISOString()
        }
      )

      await job.remove()
      console.log(`Moved job ${jobId} to dead letter queue:`, reason)
    }
  } catch (error) {
    console.error('Error moving to dead letter queue:', error)
  }
}

/**
 * Clean old jobs from queue
 *
 * @param maxAge Max age in milliseconds (default 7 days)
 * @returns Number of jobs cleaned
 */
export async function cleanOldJobs(maxAge: number = 604800000): Promise<number> {
  const cleaned = await notificationQueue.clean(maxAge, 100, 'completed')
  console.log(`Cleaned ${cleaned.length} old jobs from queue`)
  return cleaned.length
}

/**
 * Pause queue processing
 *
 * Useful for maintenance or emergencies
 */
export async function pauseQueue(): Promise<void> {
  await notificationQueue.pause()
  console.log('Notification queue paused')
}

/**
 * Resume queue processing
 */
export async function resumeQueue(): Promise<void> {
  await notificationQueue.resume()
  console.log('Notification queue resumed')
}

/**
 * Drain queue (wait for all active jobs to complete)
 */
export async function drainQueue(): Promise<void> {
  await notificationQueue.drain()
  console.log('Notification queue drained')
}

/**
 * Obliterate queue (remove all jobs - use with caution!)
 */
export async function obliterateQueue(): Promise<void> {
  await notificationQueue.obliterate({ force: true })
  console.log('Notification queue obliterated')
}

/**
 * Get job by ID
 *
 * @param jobId Job ID
 * @returns Job or null
 */
export async function getJob(jobId: string): Promise<Job | undefined> {
  return notificationQueue.getJob(jobId)
}

/**
 * Check if queue is healthy
 *
 * @returns Health status
 */
export async function checkQueueHealth(): Promise<{
  healthy: boolean
  error?: string
  metrics?: Awaited<ReturnType<typeof getQueueMetrics>>
}> {
  try {
    const metrics = await getQueueMetrics()

    // Check if there's a backlog
    const backlog = metrics.waiting + metrics.delayed
    const maxBacklog = 10000

    if (backlog > maxBacklog) {
      return {
        healthy: false,
        error: `Queue backlog too high: ${backlog} jobs`,
        metrics
      }
    }

    return {
      healthy: true,
      metrics
    }
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
