import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getOrCreateUserDepositAddress } from '@/lib/treasury/treasury-service';

export const runtime = 'nodejs';

const PAYMENT_AMOUNTS = {
  weekly: 49.75,
  monthly: 199.00,
  initial: 499.00
};

/**
 * POST /api/admin/users/payment-address
 * Get a user's deposit address for making payment on their behalf
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify superadmin authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!['superadmin', 'superadmin+'].includes(adminData?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized - Superadmin required' }, { status: 401 });
    }

    // Parse request body
    const { userId, paymentType } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (!['weekly', 'monthly', 'initial'].includes(paymentType)) {
      return NextResponse.json({ error: 'paymentType must be weekly, monthly, or initial' }, { status: 400 });
    }

    // Use service role to get user data
    const serviceSupabase = createServiceRoleClient();

    // Get the target user
    const { data: targetUser, error: userError } = await serviceSupabase
      .from('users')
      .select(`
        id,
        name,
        email,
        crypto_deposit_address,
        crypto_address_index,
        initial_payment_completed,
        payment_schedule,
        previous_payment_due_date,
        next_payment_due_date
      `)
      .eq('id', userId)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Determine if payment type is valid for this user
    if (paymentType === 'initial' && targetUser.initial_payment_completed) {
      return NextResponse.json(
        { error: 'User has already completed initial payment' },
        { status: 400 }
      );
    }

    if (['weekly', 'monthly'].includes(paymentType) && !targetUser.initial_payment_completed) {
      return NextResponse.json(
        { error: 'User must complete initial payment first' },
        { status: 400 }
      );
    }

    // Get or create deposit address
    let depositAddress = targetUser.crypto_deposit_address;

    if (!depositAddress) {
      const addressResult = await getOrCreateUserDepositAddress(userId);
      if (!addressResult.success || !addressResult.data?.address) {
        return NextResponse.json(
          { error: 'Failed to generate deposit address' },
          { status: 500 }
        );
      }
      depositAddress = addressResult.data.address;
    }

    // Calculate expected amount
    const expectedAmount = PAYMENT_AMOUNTS[paymentType as keyof typeof PAYMENT_AMOUNTS];

    // Get current period payment status if subscription
    let paidThisPeriod = 0;
    if (['weekly', 'monthly'].includes(paymentType) && targetUser.previous_payment_due_date) {
      const { data: periodPayments } = await serviceSupabase
        .from('usdc_transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('status', 'confirmed')
        .eq('transaction_type', 'deposit')
        .gte('created_at', targetUser.previous_payment_due_date);

      if (periodPayments) {
        paidThisPeriod = periodPayments.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);
      }
    }

    const remainingAmount = Math.max(0, expectedAmount - paidThisPeriod);

    return NextResponse.json({
      success: true,
      userId: targetUser.id,
      userName: targetUser.name,
      userEmail: targetUser.email,
      depositAddress,
      paymentType,
      expectedAmount,
      paidThisPeriod,
      remainingAmount,
      nextDueDate: targetUser.next_payment_due_date
    });
  } catch (error: unknown) {
    console.error('[PaymentAddressAPI] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
