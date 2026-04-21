import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const bodySchema = z.object({
  userId: z.string().uuid(),
  newTreeParentPositionId: z.string().regex(/^L\d{3}P\d{10}$/),
  slot: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  newReferredBy: z.string().uuid().nullish(),
  reason: z.string().max(500).optional().nullable(),
});

const errorCodeToStatus: Record<string, number> = {
  FORBIDDEN: 403,
  SELF_REASSIGN: 400,
  TARGET_NOT_FOUND: 404,
  USER_HAS_DOWNLINE: 409,
  INVALID_SLOT: 400,
  PARENT_NOT_FOUND: 404,
  NOOP: 409,
  SLOT_OCCUPIED: 409,
  SPONSOR_NOT_ANCESTOR: 409,
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminRow } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (adminRow?.role !== 'superadmin+') {
      return NextResponse.json(
        { error: 'Forbidden - superadmin+ required' },
        { status: 403 }
      );
    }

    const parse = bodySchema.safeParse(await req.json());
    if (!parse.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parse.error.flatten() },
        { status: 400 }
      );
    }
    const { userId, newTreeParentPositionId, slot, newReferredBy, reason } = parse.data;

    const service = createServiceRoleClient();
    const { data, error } = await service.rpc('reassign_network_position', {
      p_user_id: userId,
      p_new_tree_parent_position_id: newTreeParentPositionId,
      p_slot: slot,
      p_new_referred_by: newReferredBy ?? null,
      p_admin_id: user.id,
      p_reason: reason ?? null,
    });

    if (error) {
      console.error('[ReassignPositionAPI] RPC error:', error);
      return NextResponse.json(
        { error: 'Reassign failed', details: error.message },
        { status: 500 }
      );
    }

    const result = data as {
      success: boolean;
      error_code?: string;
      new_position_id?: string;
      new_level?: number;
      new_position?: number;
      sponsor_changed?: boolean;
      old_state?: Record<string, unknown>;
      new_state?: Record<string, unknown>;
    };

    if (!result?.success) {
      const code = result?.error_code ?? 'UNKNOWN';
      return NextResponse.json(
        { success: false, error: code },
        { status: errorCodeToStatus[code] ?? 400 }
      );
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('[ReassignPositionAPI] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 }
    );
  }
}
