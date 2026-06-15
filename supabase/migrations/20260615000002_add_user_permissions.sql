-- Granular admin privileges. A superadmin+ can grant individual privilege keys
-- (see lib/admin/permissions.ts) to any user without changing their base role.
-- Access is granted when the user's role meets a privilege's floor OR the key is
-- present in this array.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}';
