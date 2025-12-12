import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

interface TransactionLog {
  id: string;
  direction: 'incoming' | 'outgoing';
  type: string;
  amount: number;
  status: string;
  userName: string | null;
  userEmail: string;
  txHash: string | null;
  createdAt: string;
  paidAt: string | null;
}

/**
 * GET /api/admin/transaction-logs
 * Get unified transaction logs (payments + commissions)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify admin authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!['admin', 'superadmin', 'superadmin+'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const direction = searchParams.get('direction') || 'all'; // all, incoming, outgoing
    const status = searchParams.get('status') || 'all'; // all, completed, pending, failed
    const type = searchParams.get('type') || 'all'; // all, initial, weekly, monthly, direct_bonus, residual
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = (page - 1) * limit;

    const transactions: TransactionLog[] = [];

    // Fetch incoming transactions (payments)
    if (direction === 'all' || direction === 'incoming') {
      let paymentsQuery = supabase
        .from('payments')
        .select(`
          id,
          amount,
          status,
          payment_type,
          created_at,
          users (
            name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      // Apply status filter for payments
      if (status === 'completed') {
        paymentsQuery = paymentsQuery.eq('status', 'succeeded');
      } else if (status === 'pending') {
        paymentsQuery = paymentsQuery.eq('status', 'pending');
      } else if (status === 'failed') {
        paymentsQuery = paymentsQuery.in('status', ['failed', 'disputed', 'refunded']);
      }

      // Apply type filter for payments
      if (type === 'initial') {
        paymentsQuery = paymentsQuery.eq('payment_type', 'initial');
      } else if (type === 'weekly') {
        paymentsQuery = paymentsQuery.eq('payment_type', 'weekly');
      } else if (type === 'monthly') {
        paymentsQuery = paymentsQuery.eq('payment_type', 'monthly');
      } else if (['direct_bonus', 'residual', 'residual_monthly', 'crypto_deposit'].includes(type)) {
        // Skip payments if filtering for commission or crypto types only
      }

      // Only fetch payments if not filtering for commission-only or crypto-only types
      if (!['direct_bonus', 'residual', 'residual_monthly', 'crypto_deposit'].includes(type)) {
        const { data: paymentsData } = await paymentsQuery;

        if (paymentsData) {
          for (const p of paymentsData) {
            const userData = Array.isArray(p.users) ? p.users[0] : p.users;
            transactions.push({
              id: p.id,
              direction: 'incoming',
              type: p.payment_type,
              amount: p.amount,
              status: p.status === 'succeeded' ? 'completed' : p.status,
              userName: userData?.name || null,
              userEmail: userData?.email || '',
              txHash: null,
              createdAt: p.created_at,
              paidAt: null,
            });
          }
        }
      }

      // Also fetch crypto deposits from usdc_transactions
      // Fetch if type is 'all' or 'crypto_deposit', skip if filtering for payments or commissions
      if (!['direct_bonus', 'residual', 'residual_monthly', 'initial', 'weekly', 'monthly'].includes(type)) {
        // Use service role client to bypass RLS
        const serviceSupabase = createServiceRoleClient();
        let cryptoQuery = serviceSupabase
          .from('usdc_transactions')
          .select(`
            id,
            user_id,
            amount,
            status,
            transaction_type,
            polygon_tx_hash,
            created_at,
            confirmed_at,
            user:users!usdc_transactions_user_id_fkey (
              name,
              email
            )
          `)
          .eq('transaction_type', 'deposit')
          .order('created_at', { ascending: false });

        // Apply status filter for crypto transactions
        if (status === 'completed') {
          cryptoQuery = cryptoQuery.eq('status', 'confirmed');
        } else if (status === 'pending') {
          cryptoQuery = cryptoQuery.eq('status', 'pending');
        } else if (status === 'failed') {
          cryptoQuery = cryptoQuery.eq('status', 'failed');
        }

        const { data: cryptoData, error: cryptoError } = await cryptoQuery;

        if (cryptoError) {
          console.error('[TransactionLogsAPI] Crypto query error:', cryptoError);
        }

        if (cryptoData) {
          for (const c of cryptoData) {
            const userData = Array.isArray(c.user) ? c.user[0] : c.user;
            transactions.push({
              id: c.id,
              direction: 'incoming',
              type: 'crypto_deposit',
              amount: parseFloat(c.amount || '0'),
              status: c.status === 'confirmed' ? 'completed' : c.status,
              userName: userData?.name || null,
              userEmail: userData?.email || '',
              txHash: c.polygon_tx_hash,
              createdAt: c.created_at,
              paidAt: c.confirmed_at,
            });
          }
        }
      }
    }

    // Fetch outgoing transactions (commissions)
    if (direction === 'all' || direction === 'outgoing') {
      let commissionsQuery = supabase
        .from('commissions')
        .select(`
          id,
          amount,
          status,
          commission_type,
          created_at,
          paid_at,
          referrer:users!commissions_referrer_id_fkey (
            name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      // Apply status filter for commissions
      if (status === 'completed') {
        commissionsQuery = commissionsQuery.eq('status', 'paid');
      } else if (status === 'pending') {
        commissionsQuery = commissionsQuery.eq('status', 'pending');
      } else if (status === 'failed') {
        commissionsQuery = commissionsQuery.in('status', ['failed', 'cancelled']);
      }

      // Apply type filter for commissions
      if (type === 'direct_bonus') {
        commissionsQuery = commissionsQuery.eq('commission_type', 'direct_bonus');
      } else if (type === 'residual') {
        commissionsQuery = commissionsQuery.eq('commission_type', 'residual');
      } else if (type === 'residual_monthly') {
        commissionsQuery = commissionsQuery.eq('commission_type', 'residual_monthly');
      } else if (['initial', 'weekly', 'monthly'].includes(type)) {
        // Skip commissions if filtering for payment types only
      }

      // Only fetch commissions if not filtering for payment-only types
      if (!['initial', 'weekly', 'monthly'].includes(type)) {
        const { data: commissionsData } = await commissionsQuery;

        if (commissionsData) {
          for (const c of commissionsData) {
            const referrerData = Array.isArray(c.referrer) ? c.referrer[0] : c.referrer;
            transactions.push({
              id: c.id,
              direction: 'outgoing',
              type: c.commission_type,
              amount: c.amount,
              status: c.status === 'paid' ? 'completed' : c.status,
              userName: referrerData?.name || null,
              userEmail: referrerData?.email || '',
              txHash: null, // TODO: Link to usdc_transactions if available
              createdAt: c.created_at,
              paidAt: c.paid_at,
            });
          }
        }
      }
    }

    // Sort combined transactions by date (descending)
    transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Calculate statistics
    const allIncoming = transactions.filter(t => t.direction === 'incoming');
    const allOutgoing = transactions.filter(t => t.direction === 'outgoing');
    const pendingPayouts = transactions.filter(t => t.direction === 'outgoing' && t.status === 'pending');
    const failedTransactions = transactions.filter(t => ['failed', 'cancelled', 'disputed', 'refunded'].includes(t.status));

    const stats = {
      totalIncoming: allIncoming.length,
      totalIncomingAmount: allIncoming.reduce((sum, t) => sum + t.amount, 0),
      totalOutgoing: allOutgoing.length,
      totalOutgoingAmount: allOutgoing.reduce((sum, t) => sum + t.amount, 0),
      pendingPayouts: pendingPayouts.length,
      pendingPayoutsAmount: pendingPayouts.reduce((sum, t) => sum + t.amount, 0),
      failedTransactions: failedTransactions.length,
    };

    // Apply pagination
    const total = transactions.length;
    const paginatedTransactions = transactions.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      transactions: paginatedTransactions,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
    });
  } catch (error: unknown) {
    console.error('[TransactionLogsAPI] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
