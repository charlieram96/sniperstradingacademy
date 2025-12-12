/**
 * Admin API: Sync Deposit Addresses with Alchemy
 * Bulk registers all existing user deposit addresses with Alchemy webhook
 * Run this once after setting up Alchemy integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import {
  registerMultipleAddressesWithAlchemy,
  isAlchemyNotifyConfigured,
} from '@/lib/alchemy/notify-service';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/admin/alchemy/sync-addresses
 * Bulk register all existing deposit addresses with Alchemy
 * Requires admin authentication
 */
export async function POST(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin check
    const serviceSupabase = createServiceRoleClient();
    const { data: userData, error: userError } = await serviceSupabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !['admin', 'superadmin', 'superadmin+'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Check if Alchemy is configured
    if (!isAlchemyNotifyConfigured()) {
      return NextResponse.json(
        {
          error: 'Alchemy Notify not configured',
          message: 'Please set ALCHEMY_AUTH_TOKEN and ALCHEMY_WEBHOOK_ID environment variables',
        },
        { status: 503 }
      );
    }

    // Get all user deposit addresses
    const { data: users, error: queryError } = await serviceSupabase
      .from('users')
      .select('id, email, crypto_deposit_address')
      .not('crypto_deposit_address', 'is', null);

    if (queryError) {
      console.error('[AlchemySync] Failed to fetch users:', queryError);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No deposit addresses to sync',
        total: 0,
        registered: 0,
        failed: 0,
      });
    }

    const addresses = users
      .map(u => u.crypto_deposit_address)
      .filter((addr): addr is string => !!addr);

    console.log(`[AlchemySync] Syncing ${addresses.length} addresses with Alchemy`);

    // Register all addresses with Alchemy
    const result = await registerMultipleAddressesWithAlchemy(addresses);

    // Log audit event
    await serviceSupabase.from('crypto_audit_log').insert({
      event_type: 'alchemy_bulk_sync',
      admin_id: user.id,
      entity_type: 'system',
      details: {
        total_addresses: addresses.length,
        registered: result.registered,
        failed: result.failed,
        success: result.success,
        error: result.error,
      },
    });

    return NextResponse.json({
      success: result.success,
      message: result.success
        ? `Successfully registered ${result.registered} addresses with Alchemy`
        : `Failed to register addresses: ${result.error}`,
      total: addresses.length,
      registered: result.registered,
      failed: result.failed,
      error: result.error,
    });
  } catch (error) {
    console.error('[AlchemySync] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/alchemy/sync-addresses
 * Check Alchemy configuration status
 */
export async function GET(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin check
    const serviceSupabase = createServiceRoleClient();
    const { data: userData } = await serviceSupabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!['admin', 'superadmin', 'superadmin+'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Check configuration
    const configured = isAlchemyNotifyConfigured();

    // Get count of addresses
    const { count } = await serviceSupabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .not('crypto_deposit_address', 'is', null);

    return NextResponse.json({
      configured,
      missingEnvVars: configured ? [] : [
        !process.env.ALCHEMY_AUTH_TOKEN && 'ALCHEMY_AUTH_TOKEN',
        !process.env.ALCHEMY_WEBHOOK_ID && 'ALCHEMY_WEBHOOK_ID',
      ].filter(Boolean),
      addressCount: count || 0,
      message: configured
        ? `Ready to sync ${count || 0} addresses`
        : 'Please configure ALCHEMY_AUTH_TOKEN and ALCHEMY_WEBHOOK_ID',
    });
  } catch (error) {
    console.error('[AlchemySync] Status check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
