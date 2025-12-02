import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

interface UnifiedTransaction {
  id: string;
  type: 'payment' | 'commission' | 'withdrawal' | 'payout' | 'deposit';
  direction: 'in' | 'out';
  amount: string;
  status: string;
  date: string;
  description: string;
  metadata?: {
    txHash?: string;
    referredName?: string;
    paymentType?: string;
    toAddress?: string;
    fromAddress?: string;
  };
}

/**
 * GET /api/user/transactions
 * Returns unified transaction history combining payments, commissions, and USDC transactions
 *
 * Query params:
 * - filter: 'all' | 'payments' | 'commissions' | 'withdrawals' (default: 'all')
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'all';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const transactions: UnifiedTransaction[] = [];

    // Fetch payments (outgoing - user paid for membership/subscription)
    if (filter === 'all' || filter === 'payments') {
      const { data: payments } = await supabase
        .from('payments')
        .select('id, amount, payment_type, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (payments) {
        for (const payment of payments) {
          const paymentTypeLabels: Record<string, string> = {
            initial: 'Initial Unlock',
            monthly: 'Monthly Subscription',
            weekly: 'Weekly Subscription',
          };

          transactions.push({
            id: `payment_${payment.id}`,
            type: 'payment',
            direction: 'out',
            amount: payment.amount,
            status: payment.status === 'succeeded' ? 'completed' : payment.status,
            date: payment.created_at,
            description: paymentTypeLabels[payment.payment_type] || payment.payment_type,
            metadata: {
              paymentType: payment.payment_type,
            },
          });
        }
      }
    }

    // Fetch commissions (incoming - user earned from referrals)
    if (filter === 'all' || filter === 'commissions') {
      const { data: commissions } = await supabase
        .from('commissions')
        .select(`
          id,
          amount,
          commission_type,
          status,
          created_at,
          referred:referred_id (
            name,
            email
          )
        `)
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (commissions) {
        for (const commission of commissions) {
          const commissionTypeLabels: Record<string, string> = {
            direct_bonus: 'Direct Bonus',
            residual_monthly: 'Monthly Residual',
            residual: 'Residual Commission',
          };

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const referred = commission.referred as any;
          const referredName = referred?.name || referred?.email?.split('@')[0] || 'Member';

          transactions.push({
            id: `commission_${commission.id}`,
            type: 'commission',
            direction: 'in',
            amount: commission.amount,
            status: commission.status,
            date: commission.created_at,
            description: commissionTypeLabels[commission.commission_type] || commission.commission_type,
            metadata: {
              referredName,
            },
          });
        }
      }
    }

    // Fetch USDC transactions (withdrawals, payouts, deposits)
    if (filter === 'all' || filter === 'withdrawals') {
      const { data: usdcTxs } = await supabase
        .from('usdc_transactions')
        .select('id, transaction_type, amount, status, created_at, polygon_tx_hash, from_address, to_address')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (usdcTxs) {
        for (const tx of usdcTxs) {
          const txTypeLabels: Record<string, string> = {
            withdrawal: 'Withdrawal',
            payout: 'Commission Payout',
            payment_in: 'Payment Received',
            deposit: 'Deposit',
            on_ramp: 'Card Purchase',
          };

          const direction = ['withdrawal', 'payment_in'].includes(tx.transaction_type) ? 'out' : 'in';
          const type = tx.transaction_type === 'withdrawal' ? 'withdrawal' :
                       tx.transaction_type === 'payout' ? 'payout' : 'deposit';

          transactions.push({
            id: `usdc_${tx.id}`,
            type,
            direction,
            amount: tx.amount,
            status: tx.status,
            date: tx.created_at,
            description: txTypeLabels[tx.transaction_type] || tx.transaction_type,
            metadata: {
              txHash: tx.polygon_tx_hash,
              toAddress: tx.to_address,
              fromAddress: tx.from_address,
            },
          });
        }
      }
    }

    // Sort all transactions by date (most recent first)
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Apply pagination
    const paginatedTransactions = transactions.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      transactions: paginatedTransactions,
      pagination: {
        total: transactions.length,
        limit,
        offset,
        hasMore: offset + limit < transactions.length,
      },
    });
  } catch (error: unknown) {
    console.error('[UserTransactions] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
