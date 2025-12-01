# USDC Payment System - Complete Setup Guide

## Installation Commands

```bash
# Core blockchain interaction
npm install ethers@^6.13.0

# Coinbase CDP SDK for custodial wallets
npm install @coinbase/cdp-sdk

# QR Code generation (for wallet addresses)
npm install qrcode
npm install -D @types/qrcode
```

## Full Installation (One Command)

```bash
npm install ethers@^6.13.0 @coinbase/cdp-sdk qrcode && npm install -D @types/qrcode
```

---

## Environment Variables

Create or update `.env.local` with these variables:

```env
# =============================================
# POLYGON NETWORK CONFIGURATION
# =============================================

# Network selection: 'polygon' (mainnet) or 'polygon-testnet' (Amoy)
POLYGON_NETWORK=polygon-testnet

# RPC Provider URLs (get from Alchemy, Infura, or QuickNode)
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY
POLYGON_TESTNET_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY

# =============================================
# COINBASE CDP SDK CREDENTIALS
# Get from: https://portal.cdp.coinbase.com/
# Create an API Key and download credentials
# =============================================

CDP_API_KEY_ID=your_api_key_id
CDP_API_KEY_SECRET=your_api_key_secret
CDP_WALLET_SECRET=your_wallet_secret

# =============================================
# PLATFORM WALLET ADDRESSES
# =============================================

# Treasury wallet (receives all payments)
PLATFORM_TREASURY_WALLET_ADDRESS=0x...
PLATFORM_TREASURY_PRIVATE_KEY=0x...

# Gas wallet (pays transaction fees) - can be same as treasury
PLATFORM_GAS_WALLET_ADDRESS=0x...

# =============================================
# PRICING & SECURITY
# =============================================

# MATIC price in USD (for gas cost estimation)
MATIC_PRICE_USD=0.50

# Cron job authentication secret (generate with: openssl rand -hex 32)
CRON_SECRET=your_random_secret_here

# =============================================
# TRANSFI FIAT ON-RAMP (Credit Card Payments)
# Get from: https://www.transfi.com/
# =============================================

# TransFi uses MID/Username/Password authentication
TRANSFI_MID=your_merchant_id
TRANSFI_USERNAME=your_username
TRANSFI_PASSWORD=your_password
NEXT_PUBLIC_TRANSFI_ENV=sandbox  # or 'production'
TRANSFI_WEBHOOK_SECRET=your_webhook_secret
```

---

## Database Migration

The migration has already been applied. To verify:

```bash
# Check tables exist
npx supabase db query "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'crypto%' OR table_name LIKE 'usdc%' OR table_name LIKE 'payout%';"
```

Expected tables:
- `crypto_wallets`
- `usdc_transactions`
- `payment_intents`
- `payout_batches`
- `gas_usage_log`
- `treasury_snapshots`
- `external_wallet_addresses`
- `on_ramp_sessions`
- `crypto_audit_log`

---

## API Endpoints

### Payment Flow
- `POST /api/crypto/payments/create-intent` - Create payment intent
- `GET /api/crypto/payments/check-status?intentId=xxx` - Check payment status
- `POST /api/crypto/payments/process-payment` - Process confirmed payment

### Payouts (Admin)
- `POST /api/crypto/payouts/create-batch` - Create batch from pending commissions
- `POST /api/crypto/payouts/approve-batch` - Admin approves batch
- `POST /api/crypto/payouts/execute-batch` - Execute batch payouts
- `GET /api/crypto/payouts/batches` - List all batches

### Withdrawals (Users)
- `POST /api/crypto/withdrawals` - Withdraw USDC to external wallet
- `GET /api/crypto/withdrawals` - Get withdrawal history

### Fiat On-Ramp (TransFi)
- `POST /api/crypto/on-ramp/create-session` - Create fiat payment session
- `GET /api/crypto/on-ramp/create-session?sessionId=xxx` - Get session status
- `POST /api/crypto/on-ramp/webhook` - TransFi webhook handler

### Cron Jobs
- `GET /api/cron/monitor-payment-intents` - Monitor for funds (every minute)
- `GET /api/cron/expire-intents` - Expire old intents (every 5 minutes)
- `GET /api/cron/check-gas-tank` - Check gas balance (hourly)
- `GET /api/cron/create-payout-batches` - Create daily batches (midnight)

---

## Testing Checklist

### 1. Testnet Setup
- [ ] Get Coinbase CDP sandbox credentials
- [ ] Get test MATIC from [Polygon Amoy Faucet](https://faucet.polygon.technology/)
- [ ] Get test USDC (or use a USDC faucet/DEX on testnet)

### 2. Wallet Creation Test
```bash
curl -X POST http://localhost:3000/api/crypto/payments/create-intent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{"intentType": "initial_unlock"}'
```

### 3. Payment Flow Test
1. Create payment intent
2. Send test USDC to the returned wallet address
3. Watch cron job detect funds
4. Verify payment processed

### 4. Payout Test (Admin)
1. Create test commissions in database
2. Create payout batch
3. Approve batch
4. Execute batch
5. Verify transactions on block explorer

---

## Production Deployment

### 1. Switch to Mainnet
```env
POLYGON_NETWORK=polygon
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
```

### 2. Secure Keys
- Use a secret manager (AWS KMS, Vercel secrets) for private keys
- Never commit `.env.local` to git
- Rotate CRON_SECRET periodically

### 3. Fund Gas Wallet
- Send 200+ MATIC to gas wallet
- Monitor via `/api/cron/check-gas-tank`

### 4. Enable Crons
Crons are configured in `vercel.json`. They'll run automatically on Vercel deployment.

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Payment endpoints | 10 | per hour |
| Wallet operations | 20 | per hour |
| General API | 100 | per minute |
| Admin endpoints | 200 | per minute |

---

## Withdrawal Limits

| Type | Limit |
|------|-------|
| Minimum withdrawal | $10 USDC |
| Single transaction max | $5,000 USDC |
| Daily max | $10,000 USDC |

---

## Troubleshooting

### "Coinbase CDP API credentials not configured"
- Verify `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, and `CDP_WALLET_SECRET` are set
- Get these from https://portal.cdp.coinbase.com/ by creating a new API key

### "Transfer failed"
- Check gas wallet has enough MATIC
- Verify RPC endpoint is responsive
- Check USDC balance is sufficient

### "Rate limit exceeded"
- Wait for the specified retry-after time
- Or increase limits in `lib/middleware/rate-limit.ts`

### Cron jobs not running
- Verify `CRON_SECRET` is set
- Check Vercel deployment logs
- Test manually with curl:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-site.vercel.app/api/cron/monitor-payment-intents
```

---

## TransFi Fiat On-Ramp Setup

### 1. Create TransFi Account
1. Go to https://www.transfi.com/
2. Sign up for a business account
3. Complete KYB (Know Your Business) verification
4. Wait for approval (may take 1-3 business days)

### 2. Get API Credentials
1. Log into TransFi dashboard
2. Navigate to "API Authentication" section
3. You'll receive:
   - **MID** (Merchant ID)
   - **Username**
   - **Password**
4. Configure webhook to get the webhook secret

### 3. Configure Webhook
1. In TransFi dashboard, go to "Webhooks" settings
2. Add webhook URL: `https://your-domain.com/api/crypto/on-ramp/webhook`
3. Select events: `order.created`, `order.processing`, `order.completed`, `order.failed`, `order.cancelled`
4. Save the webhook secret

### 4. Test with Sandbox
1. Use sandbox credentials first
2. TransFi provides test card numbers for sandbox testing
3. Verify webhooks are being received

### 5. Switch to Production
```env
NEXT_PUBLIC_TRANSFI_ENV=production
```

### TransFi User Flow
1. User creates payment intent (existing flow)
2. User clicks "Pay with Card" button
3. TransFi widget opens in dialog
4. User enters card details and completes KYC
5. TransFi processes fiat payment
6. TransFi converts to USDC and sends to user's wallet
7. System detects funds via existing cron job
8. Payment is completed

---

## Troubleshooting

### "TransFi not configured"
- Verify `TRANSFI_MID`, `TRANSFI_USERNAME`, and `TRANSFI_PASSWORD` are set
- Check `NEXT_PUBLIC_TRANSFI_ENV` is set to `sandbox` or `production`

### "Fiat payment not available"
- TransFi integration may not be fully configured
- Check API key permissions in TransFi dashboard

### "Webhook not receiving events"
- Verify webhook URL is publicly accessible
- Check `TRANSFI_WEBHOOK_SECRET` matches TransFi dashboard
- Review Vercel function logs for errors

---

**Last Updated:** December 1, 2025
