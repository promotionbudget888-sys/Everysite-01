-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Zone approvers can view profiles in their zone" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Create a security definer function to check user role without recursion
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Create a security definer function to check user status
CREATE OR REPLACE FUNCTION public.get_my_status()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Recreate policies using the helper functions to avoid recursion
CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
USING (
  public.get_my_role() = 'admin' AND public.get_my_status() = 'approved'
);

CREATE POLICY "Zone approvers can view profiles in their zone"
ON profiles FOR SELECT
USING (
  public.get_my_role() = 'zone_approver' AND public.get_my_status() = 'approved'
);

CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can update all profiles"
ON profiles FOR UPDATE
USING (
  public.get_my_role() = 'admin' AND public.get_my_status() = 'approved'
);