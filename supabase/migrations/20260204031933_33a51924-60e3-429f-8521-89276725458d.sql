-- Drop existing constraint and add new one with 'submitted' status
ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_status_check;

ALTER TABLE public.requests ADD CONSTRAINT requests_status_check 
CHECK (status = ANY (ARRAY['draft'::text, 'submitted'::text, 'pending_admin_review'::text, 'pending_zone_approval'::text, 'approved_by_zone'::text, 'rejected_by_zone'::text, 'returned'::text, 'final_approved'::text, 'final_rejected'::text]));