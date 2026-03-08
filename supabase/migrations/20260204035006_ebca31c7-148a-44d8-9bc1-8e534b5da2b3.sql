-- Allow requesters to delete their own draft/returned requests
CREATE POLICY "Requesters can delete their own draft/returned requests"
ON public.requests
FOR DELETE
USING (
  requester_id IN (
    SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()
  )
  AND status IN ('draft', 'returned')
);