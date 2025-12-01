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
# OPTIONAL: TRANSFI ON-RAMP
# =============================================

# NEXT_PUBLIC_TRANSFI_API_KEY=xxx
# TRANSFI_PROJECT_ID=xxx
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

**Last Updated:** November 29, 2025
