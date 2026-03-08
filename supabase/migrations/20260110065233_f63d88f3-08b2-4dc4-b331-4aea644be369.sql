-- Fix zones visibility for users who are already authenticated but not approved yet

DROP POLICY IF EXISTS "Approved users can view zones" ON public.zones;

CREATE POLICY "Authenticated users can view zones"
ON public.zones
FOR SELECT
USING (auth.role() = 'authenticated');