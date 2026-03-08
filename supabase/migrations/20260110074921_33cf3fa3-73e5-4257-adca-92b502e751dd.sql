-- Add per-user budget columns for Matching Fund and Everysite
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS budget_matching_fund numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS budget_everysite numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS used_matching_fund numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS used_everysite numeric NOT NULL DEFAULT 0;