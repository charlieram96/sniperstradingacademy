/**
 * Alchemy Registration Reconciliation Cron
 *
 * Self-healing pass for deposit-address webhook registrations. When a user's
 * deposit address fails to register with Alchemy (logged as
 * `alchemy_registration_failed`), it would previously stay unmonitored forever —
 * meaning real-time deposit detection never fired for that user. This cron finds
 * every address whose latest registration attempt failed (with no later recovery)
 * and re-registers it, logging `alchemy_registration_recovered` on success.
 *
 * Run frequency: every ~30 minutes via Vercel cron.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { registerAddressWithAlchemy, isAlchemyNotifyConfigured } from '@/lib/alchemy/notify-service';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Cap how many addresses we attempt to re-register per run.
const MAX_PER_RUN = 50;

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}

async function run(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isAlchemyNotifyConfigured()) {
      return NextResponse.json({
        success: false,
        message: 'Alchemy Notify not configured (ALCHEMY_AUTH_TOKEN / ALCHEMY_WEBHOOK_ID)',
      });
    }

    const supabase = createServiceRoleClient();

    // Latest failed registration per user.
    const { data: failedEvents, error: failedErr } = await supabase
      .from('crypto_audit_log')
      .select('user_id, created_at')
      .eq('event_type', 'alchemy_registration_failed')
      .not('user_id', 'is', null)
      .order('created_at', { ascending: false });

    if (failedErr) {
      console.error('[ReconcileAlchemy] Failed to query failures:', failedErr);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const latestFailed = new Map<string, string>();
    for (const e of failedEvents || []) {
      if (e.user_id && !latestFailed.has(e.user_id)) latestFailed.set(e.user_id, e.created_at);
    }

    if (latestFailed.size === 0) {
      return NextResponse.json({ success: true, message: 'No failed registrations', stats: { candidates: 0, recovered: 0, stillFailing: 0 } });
    }

    // Latest recovery per user (to skip addresses already healed).
    const { data: recoveredEvents } = await supabase
      .from('crypto_audit_log')
      .select('user_id, created_at')
      .eq('event_type', 'alchemy_registration_recovered')
      .not('user_id', 'is', null)
      .order('created_at', { ascending: false });

    const latestRecovered = new Map<string, string>();
    for (const e of recoveredEvents || []) {
      if (e.user_id && !latestRecovered.has(e.user_id)) latestRecovered.set(e.user_id, e.created_at);
    }

    // Candidates: failed with no later recovery.
    const candidateIds: string[] = [];
    for (const [userId, failedAt] of latestFailed) {
      const recoveredAt = latestRecovered.get(userId);
      if (!recoveredAt || new Date(recoveredAt) < new Date(failedAt)) {
        candidateIds.push(userId);
      }
    }

    if (candidateIds.length === 0) {
      return NextResponse.json({ success: true, message: 'All failed registrations already recovered', stats: { candidates: 0, recovered: 0, stillFailing: 0 } });
    }

    // Pull current deposit addresses (source of truth) for the candidates.
    const { data: users } = await supabase
      .from('users')
      .select('id, email, crypto_deposit_address')
      .in('id', candidateIds.slice(0, MAX_PER_RUN))
      .not('crypto_deposit_address', 'is', null);

    let recovered = 0;
    let stillFailing = 0;

    for (const user of users || []) {
      const result = await registerAddressWithAlchemy(user.crypto_deposit_address);
      if (result.success) {
        recovered++;
        await supabase.from('crypto_audit_log').insert({
          event_type: 'alchemy_registration_recovered',
          user_id: user.id,
          entity_type: 'user',
          entity_id: user.id,
          details: {
            source: 'reconcile_alchemy_cron',
            address: user.crypto_deposit_address,
            attempts: result.attempts ?? null,
          },
        });
        console.log(`[ReconcileAlchemy] Recovered registration for ${user.email}`);
      } else {
        stillFailing++;
        console.warn(`[ReconcileAlchemy] Still failing for ${user.email}: ${result.error}`);
      }
    }

    return NextResponse.json({
      success: true,
      stats: { candidates: candidateIds.length, attempted: (users || []).length, recovered, stillFailing },
    });
  } catch (error) {
    console.error('[ReconcileAlchemy] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
