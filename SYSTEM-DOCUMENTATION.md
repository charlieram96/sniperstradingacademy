# TradingHub - Complete System Documentation

## Overview

TradingHub (Snipers Trading Academy) is a **Web3-enabled trading education platform** with an MLM (Multi-Level Marketing) referral system. Users pay for membership with USDC cryptocurrency on the Polygon network and earn commissions from their network's activity.

---

## Technology Stack

### Core Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 15.5.3 | React framework with App Router & Turbopack |
| **React** | 19.1.0 | UI library |
| **TypeScript** | 5.x | Type-safe JavaScript |
| **Node.js** | nodejs runtime | Server-side execution |

### Database & Authentication
| Technology | Purpose |
|------------|---------|
| **Supabase PostgreSQL** | Primary database with Row-Level Security (RLS) |
| **Supabase Auth** | User authentication & MFA |
| **NextAuth v5** | OAuth integration (Google) |

### UI & Styling
| Technology | Purpose |
|------------|---------|
| **Tailwind CSS 4** | Utility-first CSS framework |
| **Radix UI** | Accessible component primitives (14+ components) |
| **Lucide React** | Icon library |
| **CVA** | Class variance authority for component variants |

### Payment & Blockchain
| Technology | Purpose |
|------------|---------|
| **Stripe** | Traditional payments & Connect marketplace |
| **Coinbase Server Wallet v2** | Custodial crypto wallet management |
| **Polygon Network** | Layer 2 blockchain for USDC transactions |
| **USDC** | Stablecoin for all platform payments |
| **ethers.js** | Blockchain interaction library |
| **TransFi** | Fiat-to-crypto on-ramp service |

### Communications
| Technology | Purpose |
|------------|---------|
| **Twilio** | SMS notifications & verification |
| **SendGrid** | Transactional email |
| **Upstash Redis** | Serverless queue & rate limiting |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| **Vercel** | Hosting, serverless functions, cron jobs |
| **Alchemy** | Polygon RPC endpoint |

---

## Project Structure

```
/app
├── (auth)/                    # Authentication pages
│   ├── login/
│   ├── register/
│   ├── forgot-password/
│   └── mfa-verify/
│
├── (dashboard)/               # Protected dashboard (requires payment)
│   ├── dashboard/             # Main dashboard
│   ├── academy/               # Trading courses
│   ├── payments/              # Payment management
│   ├── referrals/             # Referral link & stats
│   ├── finance/               # Earnings overview
│   ├── team/                  # Network visualization
│   ├── notifications/         # User notifications
│   ├── settings/              # Account settings
│   └── admin/                 # Admin-only pages
│       ├── payouts/           # Commission payouts
│       ├── network/           # Network management
│       ├── financials/        # Financial reports
│       └── academy-manager/   # Content management
│
├── api/
│   ├── crypto/                # Blockchain operations
│   │   ├── payments/          # Payment intents & processing
│   │   ├── payouts/           # Commission payouts
│   │   ├── withdrawals/       # User withdrawals
│   │   └── on-ramp/           # Fiat-to-crypto
│   ├── referral/              # Referral validation
│   ├── network/               # MLM tree operations
│   ├── admin/                 # Admin endpoints
│   ├── academy/               # Course management
│   ├── notifications/         # Notification preferences
│   ├── webhooks/              # External webhooks
│   └── cron/                  # Scheduled jobs
│
└── ref/[slug]/                # Referral landing pages

/lib
├── supabase/                  # Database clients
├── coinbase/                  # Wallet service
├── polygon/                   # USDC & gas management
├── notifications/             # Email/SMS services
└── network-positions.ts       # MLM tree utilities

/components
├── ui/                        # Reusable UI components
├── admin/                     # Admin components
├── crypto/                    # Crypto widgets
└── team/                      # Network visualization

/supabase
└── migrations/                # Database schema
```

---

## Core Business Logic

### Payment Amounts (USDC)
| Payment Type | Amount | Purpose |
|--------------|--------|---------|
| Initial Unlock | $499.00 | One-time membership activation |
| Monthly Subscription | $199.00 | Recurring monthly access |
| Weekly Subscription | $49.75 | Recurring weekly access |
| Direct Bonus | $249.50 | 50% of initial unlock to referrer |

### User Lifecycle

```
1. REGISTRATION
   └─ User signs up with email/password
   └─ Enters referral code (validates referrer is active)
   └─ Assigned position in ternary tree network

2. INITIAL PAYMENT ($499)
   └─ Creates payment intent (24-hour window)
   └─ Coinbase creates custodial wallet for user
   └─ User sends USDC to wallet address
   └─ System detects funds & processes payment
   └─ Triggers:
      ├─ User becomes ACTIVE
      ├─ $249.50 direct bonus to referrer
      ├─ Network counts updated for all ancestors
      └─ Referral status → 'active'

3. SUBSCRIPTION PAYMENTS ($199 or $49.75)
   └─ Creates payment intent (48-hour window)
   └─ Payment processed same as initial
   └─ Sniper volume distributed to ALL ancestors
   └─ Keeps user ACTIVE status

4. COMMISSION EARNINGS
   └─ Monthly commissions calculated on 1st of month
   └─ Admin creates payout batches
   └─ USDC transferred to user's wallet
```

---

## MLM Network Structure

### Ternary Tree
- Each user has **3 child slots** below them
- **Unlimited depth** - commissions flow to ALL ancestors
- Position format: `L{level}P{position}` (e.g., `L005P0000000190`)
- **Breadth-first placement** - new users fill shallowest available slot

### Network Statistics
| Metric | Description |
|--------|-------------|
| `total_network_count` | ALL descendants in tree |
| `active_network_count` | Descendants who paid within 33 days |
| `direct_referrals_count` | Users directly referred (not tree placement) |

### Commission Rates (Based on Active Network Size)

| Structure | Active Members | Commission Rate |
|-----------|----------------|-----------------|
| 1 | 0 - 1,091 | 10% |
| 2 | 1,092 - 2,183 | 11% |
| 3 | 2,184 - 3,275 | 12% |
| 4 | 3,276 - 4,367 | 13% |
| 5 | 4,368 - 5,459 | 14% |
| 6 | 5,460 - 6,551 | 15% |
| 7+ | 6,552+ | 16% (max) |

**Earnings Cap:** Maximum 6,552 members counted = $1,303,848/month max volume

### Withdrawal Requirements
- Structure 1: Need 3 direct referrals
- Structure 2: Need 6 direct referrals
- Structure N: Need N × 3 direct referrals

---

## Sniper Volume System

### How Volume Flows
```
User pays $199 subscription
       ↓
sniper_volume_current_month += $199
for ALL ancestors (unlimited depth)
       ↓
[1st of next month]
       ↓
Commission = volume × rate
```

### Monthly Processing (1st of month, 00:01 UTC)
1. Archive `sniper_volume_current_month` → `sniper_volume_previous_month`
2. Create `sniper_volume_history` records
3. Calculate commissions for eligible users
4. Reset `sniper_volume_current_month` = 0

---

## Crypto Infrastructure

### Wallet System
- **Coinbase Server Wallet v2** - Custodial wallets
- **Network:** Polygon PoS (Layer 2)
- **Token:** USDC (`0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`)
- **Gas:** Platform pays 100% of MATIC gas fees

### Payment Intent Flow
```
created → awaiting_funds → processing → completed
                ↓                ↓
             expired         cancelled
```

### Transaction Types
| Type | Description |
|------|-------------|
| `payment_in` | User pays platform |
| `payout` | Commission to user |
| `withdrawal` | User withdraws to external wallet |
| `on_ramp` | Fiat-to-crypto deposit |

---

## Payout System

### Batch Process
1. **Create Batch** - Admin groups pending commissions
2. **Review** - Admin reviews totals and users
3. **Approve** - Superadmin approves batch
4. **Execute** - System transfers USDC to each user
5. **Monitor** - Track successes/failures

### Commission Status Flow
```
pending → in_batch → paid
              ↓
           failed → retry
```

---

## Key Database Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts with network stats |
| `referrals` | Referrer-referred relationships |
| `commissions` | All commission records |
| `crypto_wallets` | Coinbase custodial wallets |
| `usdc_transactions` | Blockchain transaction records |
| `payment_intents` | Pre-payment tracking |
| `payout_batches` | Admin payout groupings |
| `sniper_volume_history` | Monthly volume archives |

---

## Cron Jobs (Vercel)

| Schedule | Endpoint | Purpose |
|----------|----------|---------|
| `* * * * *` | `/api/cron/process-notifications` | Send queued notifications |
| `* * * * *` | `/api/cron/monitor-payment-intents` | Detect incoming payments |
| `*/5 * * * *` | `/api/cron/expire-intents` | Expire old payment intents |
| `0 * * * *` | `/api/cron/check-gas-tank` | Monitor MATIC balance |
| `0 0 * * *` | `/api/cron/create-payout-batches` | Daily batch creation |
| `1 0 1 * *` | `/api/cron/process-monthly-volumes` | Monthly commission calc |

---

## Security Features

- **Row-Level Security (RLS)** on all crypto tables
- **Service role separation** - client vs server access
- **MFA enforcement** for user accounts
- **Webhook signature verification** (Stripe, Twilio, Coinbase)
- **Audit logging** for all crypto operations
- **Rate limiting** via Upstash Redis
- **Cron secret authorization**

---

## Key Business Constants

| Constant | Value |
|----------|-------|
| Initial Unlock | $499 USDC |
| Monthly Subscription | $199 USDC |
| Weekly Subscription | $49.75 USDC |
| Direct Bonus | $249.50 (50% of unlock) |
| Base Commission Rate | 10% |
| Max Commission Rate | 16% |
| Members per Structure | 1,092 |
| Max Earnable Members | 6,552 |
| Active Threshold | 33 days (30 + 3 grace) |
| Payment Intent Expiry | 24-48 hours |
| Min Withdrawal | $10 USDC |
| Max Single Withdrawal | $5,000 USDC |
| Max Daily Withdrawal | $10,000 USDC |

---

## Money Flow Summary

```
USER PAYS $499 INITIAL
        ↓
$249.50 → Referrer (Direct Bonus)
$499 → Platform Treasury
        ↓
User becomes ACTIVE
Network counts updated

USER PAYS $199 SUBSCRIPTION
        ↓
$199 → Platform Treasury
        ↓
sniper_volume += $199 for ALL ancestors
        ↓
[1st of month]
        ↓
Commission = sniper_volume × commission_rate
        ↓
[Admin approves batch]
        ↓
USDC transferred to user wallets
```

---

## Key Insights

1. **Unlimited Depth** - Commissions flow to ALL ancestors, not just 6 levels
2. **Real-time Volume** - Subscription payments immediately boost ancestor potential
3. **Active Status Critical** - Inactive users don't help ancestors earn
4. **Platform Pays Gas** - Users receive full commission amounts
5. **Admin-Controlled Payouts** - No automatic payouts, requires approval
6. **Custodial + Self-Custody** - Users can export wallet keys anytime
