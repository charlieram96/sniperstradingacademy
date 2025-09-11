export const isTestUser = (userId: string | undefined) => {
  return userId === "test-user-id-123"
}

export const mockDashboardData = {
  user: {
    id: "test-user-id-123",
    email: "test@example.com",
    name: "Demo Trader",
    referral_code: "DEMO1234",
    stripe_customer_id: "cus_test123",
    created_at: new Date().toISOString(),
  },
  subscription: {
    id: "sub_test123",
    user_id: "test-user-id-123",
    stripe_subscription_id: "sub_test123",
    status: "active",
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  totalReferrals: 8,
  activeReferrals: 5,
  totalEarnings: 45000, // $450 in cents
  pendingEarnings: 10000, // $100 in cents
  groupSize: 25,
}

export const mockReferrals = [
  {
    id: "ref1",
    referrer_id: "test-user-id-123",
    referred_id: "user1",
    status: "active",
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    referred: {
      name: "John Smith",
      email: "john@example.com",
      created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
  {
    id: "ref2",
    referrer_id: "test-user-id-123",
    referred_id: "user2",
    status: "active",
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    referred: {
      name: "Sarah Johnson",
      email: "sarah@example.com",
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
  {
    id: "ref3",
    referrer_id: "test-user-id-123",
    referred_id: "user3",
    status: "active",
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    referred: {
      name: "Mike Davis",
      email: "mike@example.com",
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
  {
    id: "ref4",
    referrer_id: "test-user-id-123",
    referred_id: "user4",
    status: "pending",
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    referred: {
      name: "Emily Wilson",
      email: "emily@example.com",
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
  {
    id: "ref5",
    referrer_id: "test-user-id-123",
    referred_id: "user5",
    status: "active",
    created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    referred: {
      name: "Robert Chen",
      email: "robert@example.com",
      created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
]

export const mockPayments = [
  {
    id: "pay1",
    user_id: "test-user-id-123",
    stripe_payment_intent_id: "pi_test1",
    amount: 200,
    currency: "usd",
    status: "succeeded",
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "pay2",
    user_id: "test-user-id-123",
    stripe_payment_intent_id: "pi_test2",
    amount: 200,
    currency: "usd",
    status: "succeeded",
    created_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "pay3",
    user_id: "test-user-id-123",
    stripe_payment_intent_id: "pi_test3",
    amount: 200,
    currency: "usd",
    status: "succeeded",
    created_at: new Date(Date.now() - 61 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

export const mockCommissions = [
  {
    id: "com1",
    referrer_id: "test-user-id-123",
    referred_id: "user1",
    payment_id: "pay1",
    amount: 20,
    status: "paid",
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    referred: {
      name: "John Smith",
      email: "john@example.com",
    },
  },
  {
    id: "com2",
    referrer_id: "test-user-id-123",
    referred_id: "user2",
    payment_id: "pay2",
    amount: 20,
    status: "paid",
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    referred: {
      name: "Sarah Johnson",
      email: "sarah@example.com",
    },
  },
  {
    id: "com3",
    referrer_id: "test-user-id-123",
    referred_id: "user3",
    payment_id: "pay3",
    amount: 20,
    status: "pending",
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    referred: {
      name: "Mike Davis",
      email: "mike@example.com",
    },
  },
  {
    id: "com4",
    referrer_id: "test-user-id-123",
    referred_id: "user5",
    payment_id: "pay4",
    amount: 20,
    status: "pending",
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    referred: {
      name: "Robert Chen",
      email: "robert@example.com",
    },
  },
]

export const mockGroupMembers = [
  {
    id: "user1",
    name: "John Smith",
    email: "john@example.com",
    level: 1,
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    subscription_status: "active",
    referrals_count: 3,
  },
  {
    id: "user2",
    name: "Sarah Johnson",
    email: "sarah@example.com",
    level: 1,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    subscription_status: "active",
    referrals_count: 2,
  },
  {
    id: "user3",
    name: "Mike Davis",
    email: "mike@example.com",
    level: 1,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    subscription_status: "active",
    referrals_count: 0,
  },
  {
    id: "user4",
    name: "Emily Wilson",
    email: "emily@example.com",
    level: 1,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    subscription_status: "inactive",
    referrals_count: 0,
  },
  {
    id: "user5",
    name: "Robert Chen",
    email: "robert@example.com",
    level: 1,
    created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    subscription_status: "active",
    referrals_count: 1,
  },
  // Level 2 members (referrals of referrals)
  {
    id: "user6",
    name: "Alex Thompson",
    email: "alex@example.com",
    level: 2,
    created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    subscription_status: "active",
    referrals_count: 1,
  },
  {
    id: "user7",
    name: "Lisa Martinez",
    email: "lisa@example.com",
    level: 2,
    created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    subscription_status: "active",
    referrals_count: 0,
  },
  {
    id: "user8",
    name: "David Brown",
    email: "david@example.com",
    level: 2,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    subscription_status: "inactive",
    referrals_count: 0,
  },
  // Level 3 members
  {
    id: "user9",
    name: "Jennifer Lee",
    email: "jennifer@example.com",
    level: 3,
    created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    subscription_status: "active",
    referrals_count: 0,
  },
]