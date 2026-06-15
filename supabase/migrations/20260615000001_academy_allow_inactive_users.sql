-- Allow individual academy modules to be viewable by inactive users.
-- When true, inactive users (no active subscription) can open this module's lessons;
-- otherwise the module is locked for them.
ALTER TABLE public.academy_modules
  ADD COLUMN IF NOT EXISTS allow_inactive_users BOOLEAN NOT NULL DEFAULT false;
