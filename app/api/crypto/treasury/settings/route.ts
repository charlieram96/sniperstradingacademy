/**
 * Treasury Settings API
 * Admin endpoint for managing treasury wallet configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getTreasurySettings,
  updateTreasurySettings,
  isTreasuryConfigured,
} from '@/lib/treasury/treasury-service';

/**
 * GET /api/crypto/treasury/settings
 * Get current treasury settings (superadmin only)
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is superadmin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || userData?.role !== 'superadmin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      );
    }

    // Get treasury settings
    const settings = await getTreasurySettings();
    const isConfigured = await isTreasuryConfigured();

    return NextResponse.json({
      success: true,
      data: {
        ...settings,
        isConfigured,
        // Mask the xpub for security (show only first/last chars)
        masterWalletXpub: settings?.masterWalletXpub
          ? `${settings.masterWalletXpub.slice(0, 8)}...${settings.masterWalletXpub.slice(-8)}`
          : '',
        masterWalletXpubFull: settings?.masterWalletXpub || '',
      },
    });
  } catch (error) {
    console.error('[TreasurySettingsAPI] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/crypto/treasury/settings
 * Update treasury settings (superadmin only)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is superadmin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || userData?.role !== 'superadmin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { treasuryWalletAddress, masterWalletXpub } = body;

    // Validate at least one field is provided
    if (treasuryWalletAddress === undefined && masterWalletXpub === undefined) {
      return NextResponse.json(
        { success: false, error: 'At least one setting must be provided' },
        { status: 400 }
      );
    }

    // Update settings
    const result = await updateTreasurySettings(
      {
        treasuryWalletAddress,
        masterWalletXpub,
      },
      user.id
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Get updated settings
    const settings = await getTreasurySettings();
    const isConfigured = await isTreasuryConfigured();

    return NextResponse.json({
      success: true,
      message: 'Treasury settings updated successfully',
      data: {
        ...settings,
        isConfigured,
        masterWalletXpub: settings?.masterWalletXpub
          ? `${settings.masterWalletXpub.slice(0, 8)}...${settings.masterWalletXpub.slice(-8)}`
          : '',
      },
    });
  } catch (error) {
    console.error('[TreasurySettingsAPI] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
