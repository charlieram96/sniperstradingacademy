-- =============================================
-- Admin-driven password reset: force-change flag
-- Lets a superadmin set a temporary password and
-- require the user to change it on next login.
-- =============================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS force_password_change boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.force_password_change IS
  'When true, user must change their password on next login. Set by admin-driven temporary-password resets.';
