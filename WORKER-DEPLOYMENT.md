# Notification Worker Deployment Guide

This guide explains how to deploy the notification worker as a separate service that runs 24/7 to process queued notification jobs.

## Overview

The notification worker:
- Runs as a standalone Node.js process (separate from your Vercel Next.js app)
- Pulls jobs from Upstash Redis queue continuously
- Processes email and SMS notifications
- Handles retries, rate limiting, and error recovery
- Must run 24/7 to process notifications in real-time

## Architecture

```
Vercel App (Next.js)
       ↓ (queues jobs)
Upstash Redis (Queue)
       ↓ (worker pulls jobs)
Notification Worker (Railway/Render/Fly.io)
       ↓ (sends notifications)
SendGrid (Email) + Twilio (SMS)
```

---

## Prerequisites

Before deploying, ensure you have:
- ✅ Upstash Redis URL (`UPSTASH_REDIS_URL`)
- ✅ SendGrid API key (`SENDGRID_API_KEY`)
- ✅ Twilio credentials (for SMS)
- ✅ Supabase credentials
- ✅ GitHub account (for deployment)

---

## Option 1: Railway (Recommended)

**Why Railway:**
- ✅ Easiest setup (GitHub auto-deploy)
- ✅ Free tier available ($5 credit/month)
- ✅ Excellent logs and monitoring
- ✅ Automatic restarts on crash
- ✅ Simple environment variable management

### Step-by-Step: Railway Deployment

#### 1. Prepare Your Repository

```bash
# Push your code to GitHub (including worker files)
git add .
git commit -m "Add notification worker"
git push origin main
```

#### 2. Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Click "Start a New Project"
3. Choose "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect it as a Node.js project

#### 3. Configure Build & Start Commands

In Railway dashboard:
- **Build Command**: `npm install`
- **Start Command**: `npm run notification-worker`
- **Root Directory**: `/` (leave as default)

Or create a `railway.toml` file in your project root:

```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm run notification-worker"
healthcheckPath = "/"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

#### 4. Add Environment Variables

In Railway dashboard → Variables tab, add:

```bash
# Redis
UPSTASH_REDIS_URL=rediss://default:YOUR_PASSWORD@secure-mongoose-21908.upstash.io:6379

# SendGrid
SENDGRID_API_KEY=SG.your_sendgrid_api_key
SENDGRID_FROM_EMAIL=info@sniperstradingacademy.com
SENDGRID_FROM_NAME="Snipers Trading Academy"

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxx

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Site URL
NEXT_PUBLIC_SITE_URL=https://www.sniperstradingacademy.com

# Node.js DNS fix
NODE_OPTIONS=--dns-result-order=ipv4first

# Environment
NODE_ENV=production
```

💡 **Pro Tip**: Copy these from your Vercel environment variables!

#### 5. Deploy

Railway will automatically deploy when you push to GitHub.

#### 6. Verify It's Running

Check Railway logs for:
```
✅ Notification worker started successfully!
📥 Listening for jobs on queue: "notifications"
```

#### 7. Test the Worker

1. Go to your Vercel app → Admin → Notifications
2. Send a test notification
3. Check Railway logs - you should see:
   ```
   Processing notification: admin_announcement for user xxx via email
   ✅ Job xyz completed successfully
   ```
4. Check SendGrid logs - email should be sent

### Railway Costs

- **Free tier**: $5 credit/month (usually enough for a worker)
- **Hobby plan**: $5/month for additional credits
- **Pro plan**: $20/month (if you need more resources)

For a notification worker, free tier is usually sufficient unless you're sending thousands of notifications daily.

---

## Option 2: Render

**Why Render:**
- ✅ Free tier available
- ✅ Good documentation
- ✅ Simple deployment
- ⚠️ Free tier spins down after 15 minutes of inactivity

### Step-by-Step: Render Deployment

#### 1. Create Render Account

Go to [render.com](https://render.com) and sign up with GitHub.

#### 2. Create New Web Service

1. Dashboard → "New" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `notification-worker`
   - **Environment**: `Node`
   - **Region**: Choose closest to Upstash (usually US East)
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `npm run notification-worker`

#### 3. Choose Plan

- **Free**: Worker spins down after 15 min inactivity (⚠️ not recommended for notifications)
- **Starter ($7/month)**: Always-on worker (✅ recommended)

#### 4. Add Environment Variables

Same as Railway (see above).

#### 5. Deploy

Click "Create Web Service" - Render will build and deploy.

#### 6. Verify

Check logs for the success message (same as Railway).

### Render Costs

- **Free**: Not recommended (spins down)
- **Starter**: $7/month (recommended for always-on worker)

---

## Option 3: Fly.io

**Why Fly.io:**
- ✅ Global edge deployment
- ✅ Free allowance includes 3 shared-cpu VMs
- ✅ Excellent for Docker deployments

### Step-by-Step: Fly.io Deployment

#### 1. Install Fly CLI

```bash
# macOS
brew install flyctl

# Windows
curl -L https://fly.io/install.sh | sh

# Linux
curl -L https://fly.io/install.sh | sh
```

#### 2. Login to Fly.io

```bash
fly auth login
```

#### 3. Create fly.toml

Create `fly.toml` in project root:

```toml
app = "notification-worker"
primary_region = "iad"  # Choose closest to your users

[build]
  dockerfile = "Dockerfile.worker"

[env]
  NODE_ENV = "production"

[[services]]
  internal_port = 3001
  protocol = "tcp"

  [[services.ports]]
    port = 80

[http_service]
  internal_port = 3001
  force_https = true
  auto_stop_machines = false  # Keep worker always running
  auto_start_machines = true
  min_machines_running = 1
```

#### 4. Initialize App

```bash
fly launch --no-deploy
```

#### 5. Set Environment Variables

```bash
# Redis
fly secrets set UPSTASH_REDIS_URL="rediss://default:PASSWORD@secure-mongoose-21908.upstash.io:6379"

# SendGrid
fly secrets set SENDGRID_API_KEY="SG.your_key"
fly secrets set SENDGRID_FROM_EMAIL="info@sniperstradingacademy.com"
fly secrets set SENDGRID_FROM_NAME="Snipers Trading Academy"

# Twilio
fly secrets set TWILIO_ACCOUNT_SID="ACxxx"
fly secrets set TWILIO_AUTH_TOKEN="your_token"
fly secrets set TWILIO_MESSAGING_SERVICE_SID="MGxxx"

# Supabase
fly secrets set NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
fly secrets set NEXT_PUBLIC_SUPABASE_ANON_KEY="your_key"
fly secrets set SUPABASE_SERVICE_ROLE_KEY="your_key"

# Site
fly secrets set NEXT_PUBLIC_SITE_URL="https://www.sniperstradingacademy.com"

# Node
fly secrets set NODE_OPTIONS="--dns-result-order=ipv4first"
```

#### 6. Deploy

```bash
fly deploy
```

#### 7. Verify

```bash
# Check status
fly status

# View logs
fly logs
```

### Fly.io Costs

- **Free allowance**: 3 shared-cpu VMs (enough for 1 worker)
- **Paid**: ~$2-5/month for dedicated CPU if needed

---

## Testing Your Worker

### 1. Check Worker Logs

**Railway**: Dashboard → Logs tab
**Render**: Dashboard → Logs
**Fly.io**: `fly logs`

Look for:
```
✅ Notification worker started successfully!
📥 Listening for jobs on queue: "notifications"
```

### 2. Send Test Notification

From your Vercel app:
1. Navigate to `/admin/notifications`
2. Select a test user
3. Enter subject and message
4. Click "Send"

### 3. Verify in Worker Logs

You should see:
```
Processing notification: admin_announcement for user f679c646... via email
No email template found for admin_announcement
✅ Job eaa4a54f... completed successfully
```

### 4. Check SendGrid Dashboard

- Log into SendGrid
- Go to Activity
- You should see the email sent

### 5. Check Upstash Redis

- Log into Upstash dashboard
- Go to Data Browser
- Search for keys starting with `bull:notifications:`
- You should see queue metrics (completed, failed, etc.)

---

## Monitoring & Maintenance

### View Queue Metrics

You can check queue health via Upstash dashboard or create an admin endpoint:

```typescript
// app/api/admin/queue/metrics/route.ts
import { getQueueMetrics } from '@/lib/notifications/queue/notification-queue'

export async function GET() {
  const metrics = await getQueueMetrics()
  return Response.json(metrics)
}
```

### Common Issues

#### Worker Not Processing Jobs

1. **Check Redis connection**: Verify `UPSTASH_REDIS_URL` is correct
2. **Check worker logs**: Look for connection errors
3. **Check Upstash dashboard**: Verify Redis is accessible

#### Emails Not Sending

1. **Check SendGrid API key**: Verify it's correct
2. **Check SendGrid dashboard**: Look for errors/blocks
3. **Check email templates**: Verify templates exist in database
4. **Check worker logs**: Look for SendGrid errors

#### High Memory Usage

If worker uses too much memory:
1. Reduce concurrency in `notification-worker.ts` (default: 10)
2. Add memory limits in deployment platform
3. Scale to multiple workers

### Scaling

If you need to handle more notifications:

**Railway/Render**: Increase plan tier for more CPU/memory

**Fly.io**: Scale to multiple machines:
```bash
fly scale count 2  # Run 2 worker instances
```

**Multiple workers**: BullMQ supports multiple workers reading from same queue automatically.

---

## Cost Comparison

| Platform | Free Tier | Paid (Always-On) | Pros | Cons |
|----------|-----------|------------------|------|------|
| **Railway** | $5 credit/month | $5/month | Easiest setup, best DX | No permanent free tier |
| **Render** | 15-min spin down | $7/month | Simple, good docs | Free tier not suitable |
| **Fly.io** | 3 shared VMs | $2-5/month | Global edge, Docker | Slightly more complex |

**Recommendation**: Start with **Railway** for easiest setup, move to Fly.io if you need to optimize costs later.

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `UPSTASH_REDIS_URL` | ✅ Yes | Redis connection URL (rediss://...) |
| `SENDGRID_API_KEY` | ✅ Yes | SendGrid API key for emails |
| `SENDGRID_FROM_EMAIL` | ✅ Yes | From email address |
| `SENDGRID_FROM_NAME` | ⚠️ Optional | From name (default: "Trading Hub") |
| `TWILIO_ACCOUNT_SID` | ⚠️ Optional | Twilio SID (required for SMS) |
| `TWILIO_AUTH_TOKEN` | ⚠️ Optional | Twilio auth token (required for SMS) |
| `TWILIO_MESSAGING_SERVICE_SID` | ⚠️ Optional | Twilio messaging service (required for SMS) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes | Supabase service role key |
| `NEXT_PUBLIC_SITE_URL` | ✅ Yes | Your website URL |
| `NODE_OPTIONS` | ✅ Yes | Set to `--dns-result-order=ipv4first` |
| `NODE_ENV` | ⚠️ Optional | Set to `production` |

---

## Next Steps

After deploying your worker:

1. ✅ **Test thoroughly**: Send test notifications and verify they arrive
2. ✅ **Monitor logs**: Check worker logs for any errors
3. ✅ **Set up alerts**: Configure alerts for worker downtime
4. ✅ **Create notification templates**: Add templates to database for all notification types
5. ✅ **Update Vercel app**: Ensure it's queueing notifications properly

---

## Getting Help

If you encounter issues:

1. **Check worker logs**: Most issues show up in logs
2. **Verify environment variables**: Double-check all required vars are set
3. **Test Redis connection**: Use Upstash CLI or dashboard to verify access
4. **Check Railway/Render/Fly.io status**: Sometimes platform issues occur

---

## Local Development

To test the worker locally:

```bash
# Install dependencies
npm install

# Make sure .env.local has all required variables
cp .env.local .env  # or use dotenv

# Run the worker
npm run notification-worker
```

The worker will connect to your Upstash Redis and start processing jobs.

To test:
1. Keep worker running in one terminal
2. In another terminal, start your Next.js app: `npm run dev`
3. Go to `/admin/notifications` and send a test notification
4. Watch the worker terminal - you should see it process the job

---

**🎉 Congratulations!** Your notification worker is now running 24/7 and processing queued notifications reliably.
