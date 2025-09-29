# Cron Job Setup Documentation

## Overview
The application uses Vercel Cron Jobs to automatically process monthly commission payouts on the 1st of each month.

## Configuration

### 1. Cron Schedule
The cron job is configured in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/monthly-commissions",
      "schedule": "0 0 1 * *"
    }
  ]
}
```

**Schedule Breakdown:** `0 0 1 * *`
- Minute: 0 (00:00)
- Hour: 0 (midnight)
- Day of Month: 1 (first day)
- Month: * (every month)
- Day of Week: * (any day)

**Result:** Runs at 00:00 UTC on the 1st day of every month

## Environment Variables

### Required for Production
Add these to your Vercel project settings:

```env
# Generate a secure secret for cron authentication
CRON_SECRET=<your-generated-secret>

# Optional: Admin email for notifications
ADMIN_EMAIL=admin@sniperstradingacademy.com
```

To generate a new CRON_SECRET:
```bash
openssl rand -base64 32
```

## API Endpoints

### 1. Monthly Commission Processing
**Path:** `/api/cron/monthly-commissions`
**Method:** GET (Vercel Cron) / POST (Manual trigger)
**Authentication:** Bearer token with CRON_SECRET

**What it does:**
1. Finds all users with active subscriptions and connected Stripe accounts
2. Calculates each user's team pool and commission (10-16% based on rank)
3. Creates Stripe transfers to connected accounts
4. Records commissions in database
5. Logs results for monitoring

### 2. Test Endpoint
**Path:** `/api/cron/test`
**Method:** GET
**Purpose:** Verify cron configuration and authentication

## Testing

### Local Testing
1. Run the development server:
```bash
npm run dev
```

2. Test the cron endpoint manually:
```bash
# Without auth (should fail)
curl http://localhost:3000/api/cron/monthly-commissions

# With auth (should work)
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/monthly-commissions
```

3. Test the simplified test endpoint:
```bash
curl http://localhost:3000/api/cron/test
```

### Production Testing
After deployment, Vercel will automatically register the cron job. You can:
1. Check Vercel dashboard for cron job status
2. View logs in Vercel Functions tab
3. Manually trigger using POST with proper authentication

## Monitoring

### Vercel Dashboard
- Navigate to your project → Functions → Cron
- View execution history and logs
- Monitor success/failure rates

### Logs
The cron job logs detailed information:
- `[CRON]` prefix for easy filtering
- User processing details
- Commission amounts
- Success/failure counts
- Error messages for debugging

## Important Notes

### Vercel Plan Limits
- **Hobby:** 2 cron jobs, runs once per day max
- **Pro:** 40 cron jobs, no daily limit
- **Enterprise:** Unlimited

### Security
- CRON_SECRET is automatically added by Vercel as Bearer token
- Only Vercel's infrastructure can access the cron endpoints
- Manual triggering requires the same secret

### Timezone
- Cron runs in UTC timezone
- 00:00 UTC = 7:00 PM EST (previous day)
- 00:00 UTC = 4:00 PM PST (previous day)

### Error Handling
- Failed transfers are logged but don't stop the process
- Each user is processed independently
- Admin notification on critical failures (if ADMIN_EMAIL is set)

## Troubleshooting

### Cron not running
1. Check vercel.json is properly formatted
2. Verify deployment succeeded
3. Check Vercel dashboard for cron registration

### Authentication failures
1. Ensure CRON_SECRET is set in Vercel environment
2. Check logs for authorization headers
3. Use test endpoint to verify setup

### Payment failures
1. Check user has connected Stripe account
2. Verify payouts are enabled on account
3. Check Stripe dashboard for transfer status
4. Review logs for specific error messages

## Manual Execution
If you need to run the monthly process manually:

```bash
# Production
curl -X POST \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.vercel.app/api/cron/monthly-commissions

# Response will include:
# - Number of users processed
# - Success/failure counts
# - Total commissions paid
```