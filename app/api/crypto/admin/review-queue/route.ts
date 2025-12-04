/**
 * Admin Review Queue API
 * Handles overpayments and other items requiring admin attention
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getAddressesNeedingReview,
  resolveOverpaymentReview,
  weiToUsdc,
} from '@/lib/treasury/treasury-service'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify super admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userData?.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Fetch addresses needing review
    const addresses = await getAddressesNeedingReview()

    // Define type for the address data returned from getAddressesNeedingReview
    interface AddressNeedingReview {
      id: string
      user_id: string
      deposit_address: string
      expected_amount: number | bigint
      received_amount: number | bigint
      overpayment_amount: number | bigint
      is_overpaid: boolean
      is_late: boolean
      created_at: string
    }

    // Get user details for each address
    const addressesWithUsers = await Promise.all(
      (addresses as AddressNeedingReview[]).map(async (addr) => {
        const { data: userData } = await supabase
          .from('users')
          .select('name, email')
          .eq('id', addr.user_id)
          .single()

        return {
          id: addr.id,
          depositAddress: addr.deposit_address,
          userId: addr.user_id,
          userName: userData?.name || 'Unknown',
          userEmail: userData?.email || 'Unknown',
          expectedAmount: weiToUsdc(Number(addr.expected_amount)),
          receivedAmount: weiToUsdc(Number(addr.received_amount)),
          overpaymentAmount: weiToUsdc(Number(addr.overpayment_amount)),
          isOverpaid: addr.is_overpaid,
          isLate: addr.is_late,
          createdAt: addr.created_at,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: addressesWithUsers,
    })
  } catch (error) {
    console.error('[ReviewQueue] Error fetching review queue:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch review queue' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify super admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userData?.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { depositAddressId, resolution, notes } = body

    if (!depositAddressId || !resolution) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!['refunded', 'credited', 'ignored'].includes(resolution)) {
      return NextResponse.json(
        { success: false, error: 'Invalid resolution type' },
        { status: 400 }
      )
    }

    const result = await resolveOverpaymentReview(depositAddressId, resolution, notes)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ReviewQueue] Error resolving review:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to resolve review' },
      { status: 500 }
    )
  }
}
