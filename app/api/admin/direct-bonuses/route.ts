import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/admin/direct-bonuses
 * Fetch $499 initial payments with referrer info and associated bonus status
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify superadmin access
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!['superadmin', 'superadmin+'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized - superadmin only' }, { status: 403 })
    }

    // Fetch recent $499 initial payments (last 90 days)
    // Join with users to get payer info and referrer info
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select(`
        id,
        user_id,
        amount,
        status,
        payment_type,
        created_at,
        payer:users!payments_user_id_fkey (
          id,
          name,
          email,
          referred_by
        )
      `)
      .eq('payment_type', 'initial')
      .eq('status', 'succeeded')
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(100)

    if (paymentsError) {
      console.error('Error fetching initial payments:', paymentsError)
      return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
    }

    // Get referrer details for each payment
    const referrerIds = payments
      ?.map(p => {
        const payer = Array.isArray(p.payer) ? p.payer[0] : p.payer
        return payer?.referred_by
      })
      .filter(Boolean) as string[]

    const uniqueReferrerIds = [...new Set(referrerIds)]

    let referrers: Record<string, { id: string; name: string | null; email: string; payout_wallet_address: string | null }> = {}

    if (uniqueReferrerIds.length > 0) {
      const { data: referrerData } = await supabase
        .from('users')
        .select('id, name, email, payout_wallet_address')
        .in('id', uniqueReferrerIds)

      if (referrerData) {
        referrers = referrerData.reduce((acc, r) => {
          acc[r.id] = r
          return acc
        }, {} as Record<string, { id: string; name: string | null; email: string; payout_wallet_address: string | null }>)
      }
    }

    // Get existing commissions for these payments (to check bonus status)
    const payerIds = payments?.map(p => {
      const payer = Array.isArray(p.payer) ? p.payer[0] : p.payer
      return payer?.id
    }).filter(Boolean) as string[]

    let commissions: Record<string, { id: string; status: string; amount: number; paid_at: string | null }> = {}

    if (payerIds.length > 0) {
      const { data: commissionData } = await supabase
        .from('commissions')
        .select('id, referred_id, status, amount, paid_at')
        .eq('commission_type', 'direct_bonus')
        .in('referred_id', payerIds)

      if (commissionData) {
        commissions = commissionData.reduce((acc, c) => {
          acc[c.referred_id] = {
            id: c.id,
            status: c.status,
            amount: c.amount,
            paid_at: c.paid_at
          }
          return acc
        }, {} as Record<string, { id: string; status: string; amount: number; paid_at: string | null }>)
      }
    }

    // Format response
    const formattedPayments = payments?.map(p => {
      const payer = Array.isArray(p.payer) ? p.payer[0] : p.payer
      const referrerId = payer?.referred_by
      const referrer = referrerId ? referrers[referrerId] : null
      const commission = payer?.id ? commissions[payer.id] : null

      return {
        id: p.id,
        amount: p.amount,
        createdAt: p.created_at,
        payer: {
          id: payer?.id,
          name: payer?.name || 'Unknown',
          email: payer?.email || 'Unknown'
        },
        referrer: referrer ? {
          id: referrer.id,
          name: referrer.name || 'Unknown',
          email: referrer.email,
          hasWallet: !!referrer.payout_wallet_address,
          payoutWallet: referrer.payout_wallet_address || null
        } : null,
        bonus: commission ? {
          id: commission.id,
          status: commission.status,
          amount: commission.amount,
          paidAt: commission.paid_at
        } : null
      }
    }) || []

    // Calculate summary stats
    const totalPayments = formattedPayments.length
    const paymentsWithReferrers = formattedPayments.filter(p => p.referrer).length
    const pendingBonuses = formattedPayments.filter(p => p.bonus?.status === 'pending').length
    const paidBonuses = formattedPayments.filter(p => p.bonus?.status === 'paid').length
    const noBonusYet = formattedPayments.filter(p => p.referrer && !p.bonus).length

    return NextResponse.json({
      success: true,
      payments: formattedPayments,
      summary: {
        totalPayments,
        paymentsWithReferrers,
        pendingBonuses,
        paidBonuses,
        noBonusYet
      }
    })
  } catch (error) {
    console.error('Error in direct-bonuses API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/direct-bonuses
 * Manually create a direct bonus commission for a $499 payment
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify superadmin access
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!['superadmin', 'superadmin+'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized - superadmin only' }, { status: 403 })
    }

    const body = await req.json()
    const { paymentId, referrerId, referredId, amount = 249 } = body

    if (!paymentId || !referrerId || !referredId) {
      return NextResponse.json({
        error: 'Missing required fields: paymentId, referrerId, referredId'
      }, { status: 400 })
    }

    // Check if commission already exists
    const { data: existingCommission } = await supabase
      .from('commissions')
      .select('id, status')
      .eq('commission_type', 'direct_bonus')
      .eq('referred_id', referredId)
      .single()

    if (existingCommission) {
      return NextResponse.json({
        error: 'A direct bonus commission already exists for this payment',
        existingCommission
      }, { status: 409 })
    }

    // Create the commission
    const { data: commission, error: createError } = await supabase
      .from('commissions')
      .insert({
        referrer_id: referrerId,
        referred_id: referredId,
        amount: amount,
        commission_type: 'direct_bonus',
        status: 'pending',
        net_amount_usdc: amount,
        description: `Manual direct bonus for payment ${paymentId}`,
        created_by_admin_id: user.id
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating commission:', createError)
      return NextResponse.json({ error: 'Failed to create commission' }, { status: 500 })
    }

    // Log the action
    await supabase.from('crypto_audit_log').insert({
      event_type: 'commission_created_manual',
      user_id: referrerId,
      admin_id: user.id,
      entity_type: 'commission',
      entity_id: commission.id,
      details: {
        payment_id: paymentId,
        referred_id: referredId,
        amount: amount,
        commission_type: 'direct_bonus'
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      user_agent: req.headers.get('user-agent'),
    })

    return NextResponse.json({
      success: true,
      commission: {
        id: commission.id,
        amount: commission.amount,
        status: commission.status
      }
    })
  } catch (error) {
    console.error('Error creating direct bonus:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
