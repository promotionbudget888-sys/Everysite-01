-- Allow anyone to view zones (needed for registration)
CREATE POLICY "Anyone can view zones for registration" 
ON public.zones 
FOR SELECT 
USING (true);