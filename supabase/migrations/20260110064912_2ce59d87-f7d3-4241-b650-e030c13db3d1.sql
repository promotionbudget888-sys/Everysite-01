-- Fix infinite recursion: avoid referencing profiles with RLS from zones policies

-- 1) Security definer helper to check approval without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_approved_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = _user_id
      AND p.status = 'approved'
  );
$$;

-- 2) Replace zones SELECT policies
DROP POLICY IF EXISTS "All approved users can view zones" ON public.zones;
DROP POLICY IF EXISTS "Anyone can view zones for registration" ON public.zones;

-- Allow unauthenticated users to read zones (needed for /register dropdown)
CREATE POLICY "Anon can view zones (registration)"
ON public.zones
FOR SELECT
USING (auth.role() = 'anon');

-- Allow approved, authenticated users to read zones
CREATE POLICY "Approved users can view zones"
ON public.zones
FOR SELECT
USING (auth.role() = 'authenticated' AND public.is_approved_user(auth.uid()));