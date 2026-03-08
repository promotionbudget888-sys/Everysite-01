-- Add pending budget columns to track reserved amounts
ALTER TABLE public.profiles
ADD COLUMN pending_matching_fund numeric NOT NULL DEFAULT 0,
ADD COLUMN pending_everysite numeric NOT NULL DEFAULT 0;

-- Add comment to explain the columns
COMMENT ON COLUMN public.profiles.pending_matching_fund IS 'จำนวนเงิน Matching Fund ที่กันไว้รอการอนุมัติ';
COMMENT ON COLUMN public.profiles.pending_everysite IS 'จำนวนเงิน Everysite ที่กันไว้รอการอนุมัติ';