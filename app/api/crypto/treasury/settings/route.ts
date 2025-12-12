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
  getPayoutWalletSettings,
  updatePayoutWalletSettings,
  isPayoutWalletConfiguredInDb,
  getTreasurySetting,
  setTreasurySetting,
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

    if (userError || !['superadmin', 'superadmin+'].includes(userData?.role || '')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      );
    }

    // Get treasury settings
    const settings = await getTreasurySettings();
    const isConfigured = await isTreasuryConfigured();

    // Check if xprv is configured (for sweeping)
    const masterXprv = await getTreasurySetting('master_wallet_xprv');
    const hasMasterXprv = !!masterXprv;

    // Get payout wallet settings
    const payoutSettings = await getPayoutWalletSettings();
    const isPayoutConfigured = await isPayoutWalletConfiguredInDb();

    return NextResponse.json({
      success: true,
      data: {
        // Treasury settings
        ...settings,
        isConfigured,
        // Mask the xpub for security (show only first/last chars)
        masterWalletXpub: settings?.masterWalletXpub
          ? `${settings.masterWalletXpub.slice(0, 8)}...${settings.masterWalletXpub.slice(-8)}`
          : '',
        masterWalletXpubFull: settings?.masterWalletXpub || '',
        // Sweep settings (never expose private key)
        hasMasterXprv,
        // Payout wallet settings (never expose private key)
        payoutWalletAddress: payoutSettings?.payoutWalletAddress || '',
        isPayoutWalletConfigured: isPayoutConfigured,
        hasPayoutPrivateKey: !!(payoutSettings?.payoutWalletPrivateKey),
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

    if (userError || !['superadmin', 'superadmin+'].includes(userData?.role || '')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { treasuryWalletAddress, masterWalletXpub, masterWalletXprv, payoutWalletAddress, payoutWalletPrivateKey } = body;

    // Validate at least one field is provided
    if (
      treasuryWalletAddress === undefined &&
      masterWalletXpub === undefined &&
      masterWalletXprv === undefined &&
      payoutWalletAddress === undefined &&
      payoutWalletPrivateKey === undefined
    ) {
      return NextResponse.json(
        { success: false, error: 'At least one setting must be provided' },
        { status: 400 }
      );
    }

    // Update treasury settings if provided
    if (treasuryWalletAddress !== undefined || masterWalletXpub !== undefined) {
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
    }

    // Update master xprv if provided (for sweeping)
    if (masterWalletXprv !== undefined && masterWalletXprv !== '') {
      // Validate xprv format
      if (!masterWalletXprv.startsWith('xprv')) {
        return NextResponse.json(
          { success: false, error: 'Invalid xprv format. Must start with "xprv"' },
          { status: 400 }
        );
      }
      await setTreasurySetting('master_wallet_xprv', masterWalletXprv);
    }

    // Update payout wallet settings if provided
    if (payoutWalletAddress !== undefined || payoutWalletPrivateKey !== undefined) {
      const payoutResult = await updatePayoutWalletSettings(
        {
          payoutWalletAddress,
          payoutWalletPrivateKey,
        },
        user.id
      );

      if (!payoutResult.success) {
        return NextResponse.json(
          { success: false, error: payoutResult.error },
          { status: 400 }
        );
      }
    }

    // Get updated settings
    const settings = await getTreasurySettings();
    const isConfigured = await isTreasuryConfigured();
    const updatedMasterXprv = await getTreasurySetting('master_wallet_xprv');
    const payoutSettings = await getPayoutWalletSettings();
    const isPayoutConfigured = await isPayoutWalletConfiguredInDb();

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      data: {
        ...settings,
        isConfigured,
        masterWalletXpub: settings?.masterWalletXpub
          ? `${settings.masterWalletXpub.slice(0, 8)}...${settings.masterWalletXpub.slice(-8)}`
          : '',
        hasMasterXprv: !!updatedMasterXprv,
        payoutWalletAddress: payoutSettings?.payoutWalletAddress || '',
        isPayoutWalletConfigured: isPayoutConfigured,
        hasPayoutPrivateKey: !!(payoutSettings?.payoutWalletPrivateKey),
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
