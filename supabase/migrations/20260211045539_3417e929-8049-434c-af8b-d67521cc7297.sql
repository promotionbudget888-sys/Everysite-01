
-- Drop and recreate the view WITHOUT security_invoker so anon can read it
DROP VIEW IF EXISTS public.zones_public;

CREATE VIEW public.zones_public AS
SELECT id, name, description, sort_order FROM public.zones;

-- Grant SELECT on the view to anon and authenticated roles
GRANT SELECT ON public.zones_public TO anon;
GRANT SELECT ON public.zones_public TO authenticated;
