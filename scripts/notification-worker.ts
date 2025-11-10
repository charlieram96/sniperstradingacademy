/**
 * NOTIFICATION WORKER - Standalone Service
 *
 * This worker runs as a separate Node.js process (not on Vercel).
 * Deploy to Railway, Render, Fly.io, or any Node.js hosting platform.
 *
 * Purpose:
 * - Pulls jobs from Upstash Redis queue (BullMQ)
 * - Processes notification jobs (emails, SMS)
 * - Runs 24/7 to process queued notifications
 * - Handles retries, rate limiting, and error recovery
 *
 * Environment Variables Required:
 * - UPSTASH_REDIS_URL - Redis connection URL
 * - SENDGRID_API_KEY - SendGrid API key
 * - SENDGRID_FROM_EMAIL - From email address
 * - SENDGRID_FROM_NAME - From name
 * - TWILIO_ACCOUNT_SID - Twilio account SID
 * - TWILIO_AUTH_TOKEN - Twilio auth token
 * - TWILIO_MESSAGING_SERVICE_SID - Twilio messaging service
 * - NEXT_PUBLIC_SUPABASE_URL - Supabase URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY - Supabase anon key
 * - SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
 * - NEXT_PUBLIC_SITE_URL - Site URL for links
 * - NODE_OPTIONS=--dns-result-order=ipv4first - DNS IPv4 preference
 */

import { createNotificationWorker } from '../lib/notifications/queue/workers/notification-worker'

console.log('🚀 Starting Notification Worker...')
console.log(`📅 Started at: ${new Date().toISOString()}`)
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
console.log(`📍 Redis URL: ${process.env.UPSTASH_REDIS_URL ? '✅ Configured' : '❌ Missing'}`)
console.log(`📧 SendGrid: ${process.env.SENDGRID_API_KEY ? '✅ Configured' : '❌ Missing'}`)
console.log(`📱 Twilio: ${process.env.TWILIO_ACCOUNT_SID ? '✅ Configured' : '❌ Missing'}`)
console.log(`🗄️  Supabase: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Configured' : '❌ Missing'}`)

// Validate required environment variables
const requiredEnvVars = [
  'UPSTASH_REDIS_URL',
  'SENDGRID_API_KEY',
  'SENDGRID_FROM_EMAIL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
]

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName])

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:')
  missingEnvVars.forEach(varName => {
    console.error(`   - ${varName}`)
  })
  console.error('\n💡 Make sure to set these in your deployment platform (Railway/Render/Fly.io)')
  process.exit(1)
}

// Create and start the worker
let worker: ReturnType<typeof createNotificationWorker> = null

try {
  worker = createNotificationWorker()

  if (!worker) {
    console.error('❌ Failed to create notification worker (Redis connection may be unavailable)')
    console.error('   Check that UPSTASH_REDIS_URL is correct and Upstash is accessible')
    process.exit(1)
  }

  console.log('✅ Notification worker started successfully!')
  console.log('📥 Listening for jobs on queue: "notifications"')
  console.log('⚙️  Worker settings:')
  console.log('   - Concurrency: 10 jobs at once')
  console.log('   - Rate limit: 100 jobs per minute')
  console.log('   - Max retries: 5 attempts with exponential backoff')
  console.log('\n📊 Worker is now running. Press Ctrl+C to stop.')

} catch (error) {
  console.error('❌ Error starting notification worker:', error)
  process.exit(1)
}

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('\n⚠️  SIGTERM received, shutting down gracefully...')
  if (worker) {
    try {
      await worker.close()
      console.log('✅ Worker closed successfully')
    } catch (error) {
      console.error('❌ Error closing worker:', error)
    }
  }
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('\n⚠️  SIGINT received, shutting down gracefully...')
  if (worker) {
    try {
      await worker.close()
      console.log('✅ Worker closed successfully')
    } catch (error) {
      console.error('❌ Error closing worker:', error)
    }
  }
  process.exit(0)
})

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Keep the process alive
process.stdin.resume()
