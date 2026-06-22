-- Payment-compliance review flags on users.
--
-- These columns already exist in the production database (added out-of-band),
-- so this migration is written idempotently to (a) fix schema drift for other
-- environments and (b) add a supporting index for the admin flagged-reviews
-- queries, which filter/sort on these columns.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS flagged_for_review BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flagged_for_review_at TIMESTAMPTZ;

-- Partial index: the admin UI only ever queries flagged rows, ordered by
-- flagged_for_review_at. Keeps the index small (most users are not flagged).
CREATE INDEX IF NOT EXISTS idx_users_flagged_for_review
  ON public.users (flagged_for_review_at DESC)
  WHERE flagged_for_review;
