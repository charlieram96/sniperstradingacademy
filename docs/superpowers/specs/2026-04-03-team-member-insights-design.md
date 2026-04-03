# Team Member Insights — Design Spec

## Purpose

Give team leaders actionable visibility into their downline members' payment and membership status directly on the My Team page. Leaders should be able to see who's at risk of lapsing, who recently went inactive, and the full payment history of any member — enabling proactive team management.

## Scope

- New "Member Insights" section on the existing My Team page (`app/(dashboard)/team/page.tsx`)
- Covers the **full downline** (all members in the user's network tree)
- New reusable component: `components/team/member-insights.tsx`
- Enhanced member detail dialog with payment history
- New API endpoint for fetching downline payment data

## Data Requirements

### Upfront Data (fetched on page load)

For all downline members (IDs come from existing `get_downline_contributors` RPC):

**From `users` table** — add to the existing downline member query:
- `last_payment_date` (TIMESTAMPTZ) — most recent subscription payment
- `next_payment_due_date` (TIMESTAMPTZ) — when next payment is due
- `payment_schedule` (VARCHAR) — 'weekly' or 'monthly'
- `initial_payment_completed` (BOOLEAN)
- `initial_payment_date` (TIMESTAMPTZ)
- `inactive_since` (TIMESTAMPTZ) — when they went inactive (null if active)

**Computed from `payments` table** — aggregate query for activity feed and revenue:
- Recent payments across all downline members (last 50, for activity feed)
- Sum of completed payments this month (for revenue card)

### On-Demand Data (fetched when clicking a member)

**From `payments` table:**
- Full payment history for the selected member: `amount`, `payment_type`, `status`, `created_at`
- Ordered by `created_at DESC`

### At-Risk Classification Logic

| Category | Condition | Sort Priority |
|----------|-----------|---------------|
| Overdue | `is_active = true` AND `next_payment_due_date < now()` | 1 (most urgent) |
| Due Soon | `is_active = true` AND `next_payment_due_date` within 7 days | 2, ascending by days remaining |
| Recently Lapsed | `is_active = false` AND `inactive_since` within last 30 days | 3, descending by recency |

## API

### New endpoint: `GET /api/team/member-payments`

**Query params:**
- `userId` (required) — the team leader's user ID
- `memberId` (optional) — if provided, returns full payment history for that member

**Without `memberId`** — returns aggregate data:
```json
{
  "members": [
    {
      "id": "uuid",
      "name": "string",
      "email": "string",
      "is_active": true,
      "last_payment_date": "2026-03-15T...",
      "next_payment_due_date": "2026-04-15T...",
      "payment_schedule": "monthly",
      "initial_payment_completed": true,
      "initial_payment_date": "2025-12-01T...",
      "inactive_since": null,
      "created_at": "2025-12-01T..."
    }
  ],
  "recentPayments": [
    {
      "user_id": "uuid",
      "user_name": "string",
      "amount": 199,
      "payment_type": "monthly",
      "status": "completed",
      "created_at": "2026-04-01T..."
    }
  ],
  "stats": {
    "totalMembers": 92,
    "activeMembers": 66,
    "atRiskCount": 5,
    "recentlyLapsedCount": 3,
    "revenueThisMonth": 8955
  }
}
```

**With `memberId`** — returns that member's payment history:
```json
{
  "member": { /* same shape as above */ },
  "payments": [
    {
      "id": "uuid",
      "amount": 199,
      "payment_type": "monthly",
      "status": "completed",
      "created_at": "2026-04-01T..."
    }
  ]
}
```

**Authorization:** The endpoint must verify that the requested `memberId` is actually in the caller's downline (using the position-range math from `get_downline_contributors`).

## UI Components

### Placement

The Member Insights section goes **after the Direct Referrals card** and **before the Current Structure + Structure Overview cards** on the My Team page.

### Summary Cards Row

4 cards displayed in a responsive grid (`grid-cols-2 lg:grid-cols-4`), always visible above the tabs:

| Card | Value | Icon | Accent |
|------|-------|------|--------|
| Active Members | `{active} / {total}` | Users | Green (primary) |
| At Risk | count of overdue + due-soon | AlertCircle | Amber |
| Recently Lapsed | count inactive < 30 days | XCircle | Red |
| Revenue This Month | `${sum}` formatted | DollarSign | Gold ([#D4A853]) |

### Tabbed Content

Uses existing `Tabs` / `TabsList` / `TabsContent` from the project's UI library.

#### Tab 1: "At Risk"

- Default/first tab
- List of at-risk members sorted by urgency (overdue first, then due-soon by days ascending, then recently-lapsed)
- Each row:
  - Member name
  - Status badge: `Overdue` (red), `Due in X days` (amber), `Lapsed X days ago` (gray)
  - Last payment date
  - Payment schedule badge (Weekly/Monthly)
  - Click → opens enhanced member detail dialog
- Empty state: CheckCircle icon + "All members are in good standing"

#### Tab 2: "All Members"

- Searchable by name or email (text input)
- Filterable by status: All / Active / Inactive (select dropdown)
- Paginated table, 25 rows per page
- Columns: Name, Status (badge), Last Paid, Next Due, Schedule, Joined
- Sortable by clicking column headers
- Click row → opens enhanced member detail dialog

#### Tab 3: "Activity Feed"

- Chronological list of recent payment events (most recent 50)
- Each entry: green/red dot + "{Name} paid ${amount} — {type} — {relative time}"
- Payment types displayed as: "Initial Unlock", "Monthly Subscription", "Weekly Subscription"
- Failed payments shown with red dot and "Failed" label
- Compact list, no pagination (capped at 50)

### Enhanced Member Detail Dialog

Extends the existing member detail dialog (`Dialog` component, lines ~521-610 of team page). Adds a new section **below** the existing "Qualification Status" box:

#### New "Payment Status" section:
- **Next Payment Due**: date + "in X days" or "overdue by X days" with color coding
- **Payment Schedule**: Weekly/Monthly badge
- **Member Since**: initial payment date

#### New "Payment History" section:
- Scrollable list (max-height with ScrollArea)
- Each entry: Date (formatted), Amount ($), Type badge, Status badge
- Types: `Initial Unlock` / `Monthly` / `Weekly`
- Statuses: `Completed` (green) / `Failed` (red) / `Pending` (amber)
- Empty state if no payments found

## Component Architecture

```
app/(dashboard)/team/page.tsx
  └── New section: Member Insights
        └── components/team/member-insights.tsx (new)
              ├── Summary cards (inline)
              ├── Tab: AtRiskList (inline)
              ├── Tab: AllMembersTable (inline)
              ├── Tab: ActivityFeed (inline)
              └── MemberPaymentDialog (inline or extracted if large)

app/api/team/member-payments/route.ts (new)
  └── GET handler with userId + optional memberId
```

The `member-insights.tsx` component receives the team leader's `userId` as a prop and handles its own data fetching via the new API endpoint. This keeps it decoupled from the parent page's data flow.

## Existing Patterns to Follow

- Use `Card`, `CardHeader`, `CardContent`, `Badge`, `Tabs`, `TabsList`, `TabsContent`, `Dialog`, `ScrollArea`, `Input`, `Select` from the project's UI library
- Use `motion` variants from `framer-motion` with `staggerContainer` / `staggerItem` for animations (matches existing page)
- Use the gold accent color `#D4A853` for primary highlights (matches existing design)
- Use `createClient` from `@/lib/supabase/client` for client-side queries
- Use `useTranslation` hook for any user-facing strings (add translation keys)
- Use `AnimatedNumber` component for the summary card values

## Error Handling

- API endpoint returns 400 if `userId` missing, 403 if `memberId` not in caller's downline
- Client shows a toast or inline error if the API call fails
- Empty states for each tab when no data matches

## Performance Considerations

- The downline member IDs are already fetched by the existing `get_downline_contributors` call — reuse those IDs
- Payment history for individual members is fetched on-demand (not upfront) to avoid loading thousands of payment records
- Activity feed is capped at 50 entries
- All Members table is paginated at 25 rows
- The summary stats (`atRiskCount`, `recentlyLapsedCount`, `revenueThisMonth`) are computed server-side in the API endpoint
