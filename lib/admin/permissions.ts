// ─── Admin privilege model ───────────────────────────────────────────────────
//
// The app gates admin features by a coarse `role` (user < admin < superadmin <
// superadmin+). The privileges manager layers GRANULAR privileges on top: a
// superadmin+ can grant an individual user a specific privilege (e.g. view
// transaction logs) without elevating their whole role.
//
// Access is granted when EITHER the user's role meets the privilege's `minRole`
// floor OR the user has the privilege key explicitly in their `permissions` array.
// This means existing role-based access is never removed — granular grants only
// ADD access for users below the floor.

// NOTE: the DB column users.role is the Postgres enum `user_role` with labels
// member | admin | superadmin | superadmin+. "member" (not "user") is the base
// role — writing any other string is rejected by the database.
export type AdminRole = "member" | "admin" | "superadmin" | "superadmin+"

export type PrivilegeKey =
  | "manage_classes"
  | "manage_network"
  | "send_notifications"
  | "view_network_visualizer"
  | "manage_academy"
  | "view_financials"
  | "manage_payouts"
  | "manage_direct_bonuses"
  | "view_transaction_logs"
  | "view_flagged_reviews"
  | "manage_users"
  | "manage_privileges"

export interface AdminPrivilege {
  key: PrivilegeKey
  label: string
  description: string
  // Lowest role that implicitly holds this privilege (and every role above it).
  minRole: AdminRole
}

// Roles a superadmin+ may assign as a user's base role, in ascending order.
export const ASSIGNABLE_ROLES: AdminRole[] = ["member", "admin", "superadmin", "superadmin+"]

// Numeric rank for comparing roles.
const ROLE_RANK: Record<AdminRole, number> = {
  member: 0,
  admin: 1,
  superadmin: 2,
  "superadmin+": 3,
}

export function roleRank(role: string | null | undefined): number {
  return ROLE_RANK[(role as AdminRole)] ?? 0
}

// Whether an actor may change the role/permissions of a target whose current
// (or to-be-assigned) role is `targetRole`. superadmin+ (top rank) may manage
// everyone, including peer superadmin+; everyone else must STRICTLY outrank
// the target. Note roleRank maps unknown strings ("member", null) to 0.
export function canManageTarget(
  actorRole: string | null | undefined,
  targetRole: string | null | undefined
): boolean {
  const actorRank = roleRank(actorRole)
  if (actorRank >= roleRank("superadmin+")) return true
  return actorRank > roleRank(targetRole)
}

// The canonical list of grantable admin privileges. The `minRole` values mirror
// today's page/sidebar gating so role-based access is unchanged.
export const ADMIN_PRIVILEGES: AdminPrivilege[] = [
  { key: "manage_classes", label: "Manage Classes", description: "Create and manage academy live classes", minRole: "admin" },
  { key: "manage_network", label: "Manage Network", description: "View and manage the network structure", minRole: "admin" },
  { key: "send_notifications", label: "Send Notifications", description: "Send and configure user notifications", minRole: "superadmin" },
  { key: "view_network_visualizer", label: "Network Visualizer", description: "Explore the full network visualizer", minRole: "superadmin" },
  { key: "manage_academy", label: "Manage Academy", description: "Create and edit academy modules and lessons", minRole: "superadmin" },
  { key: "view_financials", label: "View Financials", description: "View financial dashboards and reports", minRole: "superadmin+" },
  { key: "manage_payouts", label: "Manage Payouts", description: "Create, process, and complete payouts", minRole: "superadmin+" },
  { key: "manage_direct_bonuses", label: "Manage Direct Bonuses", description: "View and manage direct referral bonuses", minRole: "superadmin+" },
  { key: "view_transaction_logs", label: "View Transaction Logs", description: "View the full transaction log", minRole: "superadmin+" },
  { key: "view_flagged_reviews", label: "Flagged Reviews", description: "Review and resolve flagged items", minRole: "superadmin+" },
  { key: "manage_users", label: "Manage Users", description: "Edit users: activation, bypasses, resets, positions", minRole: "superadmin" },
  { key: "manage_privileges", label: "Manage Privileges", description: "Grant admin privileges and edit user roles", minRole: "superadmin+" },
]

export const PRIVILEGE_KEYS: PrivilegeKey[] = ADMIN_PRIVILEGES.map((p) => p.key)

export function isPrivilegeKey(value: unknown): value is PrivilegeKey {
  return typeof value === "string" && (PRIVILEGE_KEYS as string[]).includes(value)
}

export function getPrivilege(key: PrivilegeKey): AdminPrivilege | undefined {
  return ADMIN_PRIVILEGES.find((p) => p.key === key)
}

// Whether a role/permissions pair can access something requiring `privilege`.
// Access = role meets the privilege's floor OR the privilege is explicitly granted.
export function hasPrivilege(
  role: string | null | undefined,
  permissions: string[] | null | undefined,
  privilege: PrivilegeKey
): boolean {
  const priv = getPrivilege(privilege)
  if (!priv) return false
  if (roleRank(role) >= roleRank(priv.minRole)) return true
  return (permissions ?? []).includes(privilege)
}

// Whether `role` implicitly holds the privilege via its rank (used by the UI to
// show role-implied privileges as checked + locked).
export function roleImpliesPrivilege(role: string | null | undefined, privilege: PrivilegeKey): boolean {
  const priv = getPrivilege(privilege)
  if (!priv) return false
  return roleRank(role) >= roleRank(priv.minRole)
}
