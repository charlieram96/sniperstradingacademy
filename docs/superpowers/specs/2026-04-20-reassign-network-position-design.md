# Reassign Network Position — Admin Feature (Design)

## Context

The app places every user in a 3×3 network tree. Until now, the only way to fix a misplaced user was direct SQL against production — no audit trail, no consistency checks, high risk of counter drift. This feature gives `superadmin+` users a safe, in-app way to reassign the network position of a **leaf user** (zero downline), with atomic counter maintenance and a permanent audit record. Moving a subtree is explicitly out of scope — leaf-only keeps the change deterministic (±1 on every affected counter).

## Decisions

| Topic | Decision |
|---|---|
| Eligibility | Target must have zero direct children **and** `total_network_count = 0` |
| Caller role | `superadmin+` only (not `superadmin`) |
| Entry point | Inside the existing node-click Dialog at `app/(dashboard)/admin/network-visualizer/network-visualizer-client.tsx` |
| Destination parent | Admin searches by name/email |
| Destination slot | Admin explicitly picks 1 / 2 / 3; occupied slots disabled |
| Sponsor (`referred_by`) | Optional — may remain unchanged, OR be set to any ancestor of the new position (from the new parent up through root) |
| Confirmation | Admin must type `REASSIGN` before submit enables |
| Audit | Dedicated table `network_position_reassignments` — written atomically inside the same RPC |
| Pre-existing drift | Not corrected by this feature |

## Architecture

Three layers, atomic as a unit via one Postgres RPC call:

1. **UI** — `components/admin/reassign-position-dialog.tsx`, rendered from the existing user Dialog in `network-visualizer-client.tsx`. Button only visible to `superadmin+`; disabled when the selected user has downline.
2. **API route** — `POST /api/admin/users/reassign-position/route.ts`. Thin: auth check, zod validation, RPC call via service-role client, map error codes to HTTP status codes. Sibling endpoint `GET /api/admin/network/ancestors?positionId=...` populates the sponsor dropdown.
3. **Postgres RPC** — `reassign_network_position(p_user_id, p_new_tree_parent_position_id, p_slot, p_new_referred_by, p_admin_id, p_reason)`. All preconditions, mutations, counter recomputation, and audit write happen inside this `SECURITY DEFINER` function.

## RPC contract

```
reassign_network_position(
  p_user_id                       uuid,
  p_new_tree_parent_position_id   text,     -- e.g. 'L008P0000004503'
  p_slot                          int,      -- 1, 2, or 3
  p_new_referred_by               uuid,     -- nullable; null = leave unchanged
  p_admin_id                      uuid,
  p_reason                        text      -- nullable
) returns jsonb
```

### Error codes

| Code | Meaning |
|---|---|
| `FORBIDDEN` | Admin role is not `superadmin+` |
| `SELF_REASSIGN` | `p_user_id = p_admin_id` |
| `TARGET_NOT_FOUND` | User does not exist |
| `USER_HAS_DOWNLINE` | Target has direct children or non-zero `total_network_count` |
| `INVALID_SLOT` | Slot not in {1, 2, 3} |
| `PARENT_NOT_FOUND` | No user at `p_new_tree_parent_position_id` |
| `NOOP` | Computed new position equals current position |
| `SLOT_OCCUPIED` | Target slot is already held by another user |
| `SPONSOR_NOT_ANCESTOR` | New sponsor is not on the ancestor chain of the new position |

The NOOP check runs **before** the slot-occupancy check (otherwise the "occupant" at the target would be the user themselves, returning the wrong error).

### Atomic operations (all-or-nothing)

1. Snapshot old state.
2. Compute new position: `new_level = parent.level + 1`; `new_position = (parent.position - 1) * 3 + slot`.
3. Decrement counters on the old upline chain — for each ancestor: `total_network_count -= 1`; if moved user `is_active`, `active_network_count -= 1`.
4. `UPDATE users` on the moved row: position + (optional) `referred_by`.
5. Increment counters on the new upline chain — mirror of step 3.
6. If sponsor changed: `direct_referrals_count` and (if target is active) `active_direct_referrals_count` are decremented on the old sponsor and incremented on the new sponsor. `check_qualification_status` is called on both.
7. Insert audit row into `network_position_reassignments`.

## Audit table

```sql
create table public.network_position_reassignments (
  id                              uuid primary key default gen_random_uuid(),
  user_id                         uuid not null references public.users(id),
  admin_id                        uuid not null references public.users(id),
  old_position_id                 text not null,
  new_position_id                 text not null,
  old_tree_parent_position_id     text,
  new_tree_parent_position_id     text not null,
  old_referred_by                 uuid references public.users(id),
  new_referred_by                 uuid references public.users(id),
  reason                          text,
  created_at                      timestamptz not null default now()
);
```

RLS: enabled. SELECT policy = `role in ('superadmin', 'superadmin+')`. No INSERT/UPDATE/DELETE policies — only the SECURITY DEFINER RPC writes here.

## API route

`POST /api/admin/users/reassign-position`

Body (zod):
```ts
{
  userId: uuid,
  newTreeParentPositionId: /^L\d{3}P\d{10}$/,
  slot: 1 | 2 | 3,
  newReferredBy?: uuid | null,
  reason?: string (<= 500)
}
```

HTTP mapping: `FORBIDDEN→403`, `TARGET_NOT_FOUND/PARENT_NOT_FOUND→404`, `USER_HAS_DOWNLINE/SLOT_OCCUPIED/SPONSOR_NOT_ANCESTOR/NOOP→409`, other validation→400.

`GET /api/admin/network/ancestors?positionId=...` — returns ancestor users from the given position up through root (inclusive of the position's own occupant), used to populate the sponsor dropdown.

## Counter semantics (summary)

Subtree size = 1 (zero-downline rule), so all deltas are ±1.

| Field | Old upline chain | New upline chain | Condition |
|---|---|---|---|
| `total_network_count` | −1 each | +1 each | always |
| `active_network_count` | −1 each | +1 each | only if target `is_active = true` |
| `direct_referrals_count` | −1 on old sponsor | +1 on new sponsor | only if `referred_by` changed |
| `active_direct_referrals_count` | −1 on old sponsor | +1 on new sponsor | only if `referred_by` changed AND target active |
| `current_structure_number` / `current_commission_rate` | — | — | computed per-request, not stored |
| `last_referral_branch` | — | — | historical; not touched |

## Reused code

- `lib/network-positions.ts` — `parseNetworkPositionId`, `formatNetworkPositionId`, `calculateChildPositions`, `getParentPosition`, `getParentPositionId`.
- Postgres helpers — `format_network_position_id`, `get_parent_position`, `is_position_occupied`, `get_upline_chain`, `check_qualification_status`.
- `GET /api/admin/network/children?positionId=...` — existing endpoint, reused to label the slot radio.
- Admin auth pattern from `app/api/admin/users/toggle-active/route.ts`.
- Trigger `trigger_update_active_direct_referrals` auto-maintains `active_direct_referrals_count` on `is_active` changes (but not `referred_by` changes — those are handled manually in the RPC).

## Verification

### DB-level

1. 9 negative-path error codes (FORBIDDEN, SELF_REASSIGN, TARGET_NOT_FOUND, USER_HAS_DOWNLINE, INVALID_SLOT, PARENT_NOT_FOUND, NOOP, SLOT_OCCUPIED, SPONSOR_NOT_ANCESTOR) each covered.
2. Positive path: pick a leaf user, snapshot counters, call RPC, assert new row state + per-ancestor counter deltas + audit row. Reassign back and confirm net-zero drift.

### UI

1. `superadmin+` sees "Reassign Position" button inside the user Dialog. Other roles don't.
2. Button is disabled when selected user has downline; enabled otherwise.
3. Happy path: search parent → pick slot → optional sponsor → type `REASSIGN` → submit → success toast + tree re-renders.
4. Each error case maps to a user-friendly toast; dialog stays open for correction.

## Out of scope

- Moving users who have downline (subtree moves).
- Backfilling pre-existing counter drift.
- Retroactively recomputing historical commissions.
- A dedicated browse UI for the audit table (table is queryable; UI is a future addition).
