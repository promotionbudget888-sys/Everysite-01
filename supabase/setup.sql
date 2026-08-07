-- ============================================================================
-- Everysite — Supabase schema (สถานะสุดท้าย) สำหรับ project ใหม่ที่ยังว่างเปล่า
-- paste ทั้งไฟล์นี้ใน Supabase → SQL Editor → Run  (ครั้งเดียวจบ)
--
-- รวม base schema ของ Lovable + การปรับให้ตรง GAS/ชีตจริง + แก้ RLS recursion
-- ด้วย SECURITY DEFINER helper functions
-- idempotent พอสมควร (ใช้ IF NOT EXISTS / DROP ... IF EXISTS)
-- ============================================================================

-- ── TABLES ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  full_name   text NOT NULL,
  first_name  text,
  last_name   text,
  role        text NOT NULL DEFAULT 'requester'
              CHECK (role IN ('requester','zone_approver','zone_approver_1','zone_approver_2','admin')),
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','approved','rejected')),
  zone_id     text,
  phone       text,
  affiliation text,
  department  text,
  branch      text,
  line_id     text,
  budget_matching_fund  numeric NOT NULL DEFAULT 0,
  budget_everysite      numeric NOT NULL DEFAULT 0,
  used_matching_fund    numeric NOT NULL DEFAULT 0,
  used_everysite        numeric NOT NULL DEFAULT 0,
  pending_matching_fund numeric NOT NULL DEFAULT 0,
  pending_everysite     numeric NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.zones (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  description text,
  sort_order  integer,
  total_budget     numeric NOT NULL DEFAULT 0,
  used_budget      numeric NOT NULL DEFAULT 0,
  remaining_budget numeric GENERATED ALWAYS AS (total_budget - used_budget) STORED,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.requests (
  id           uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  zone_id      text,
  title        text NOT NULL,
  description  text,
  amount       numeric NOT NULL DEFAULT 0,
  status       text NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','submitted','zone_review_1','zone_review_2',
                                 'admin_finalize','approved','competing','paid','rejected','returned')),
  request_type text,
  size         text,
  size_code    text,
  requester_name  text,
  requester_email text,
  department   text,
  branch       text,
  affiliation  text,
  admin_notes         text,
  zone_approver_notes text,
  final_notes  text,
  rejected_reason text,
  pdf_url      text,
  admin_at     timestamptz,
  zone1_at     timestamptz,
  zone2_at     timestamptz,
  final_at     timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.request_attachments (
  id         uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  file_name  text NOT NULL,
  file_url   text NOT NULL,
  file_type  text,
  file_size  integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name  text NOT NULL,
  actor_role  text NOT NULL,
  action      text NOT NULL,
  target_type text NOT NULL,
  target_id   uuid,
  detail      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requests_requester ON public.requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_requests_status    ON public.requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_zone      ON public.requests(zone_id);
CREATE INDEX IF NOT EXISTS idx_attach_request     ON public.request_attachments(request_id);

-- seed zones "1".."16"
INSERT INTO public.zones (id, name, sort_order)
SELECT g::text, 'โซน ' || g, g FROM generate_series(1, 16) AS g
ON CONFLICT (id) DO NOTHING;

-- ── FUNCTIONS ───────────────────────────────────────────────────────────────

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_zones_updated ON public.zones;
CREATE TRIGGER trg_zones_updated BEFORE UPDATE ON public.zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_requests_updated ON public.requests;
CREATE TRIGGER trg_requests_updated BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- size code generator (T00001, T00002, ...)
CREATE SEQUENCE IF NOT EXISTS public.size_code_seq START WITH 1 INCREMENT BY 1;
CREATE OR REPLACE FUNCTION public.generate_size_code()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RETURN 'T' || LPAD(nextval('size_code_seq')::text, 5, '0'); END; $$;

-- ── RLS helper functions (SECURITY DEFINER → อ่าน profiles โดยไม่วน RLS) ──────
CREATE OR REPLACE FUNCTION public.my_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.my_status()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT status FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.my_profile_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.my_zone()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT zone_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles
                 WHERE user_id = auth.uid() AND role = 'admin' AND status = 'approved');
$$;
CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles
                 WHERE user_id = auth.uid() AND status = 'approved');
$$;
CREATE OR REPLACE FUNCTION public.is_approver()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles
                 WHERE user_id = auth.uid() AND status = 'approved'
                   AND role IN ('zone_approver','zone_approver_1','zone_approver_2'));
$$;

-- transfer budget Matching Fund → Everysite (ของผู้ใช้ที่ระบุ)
CREATE OR REPLACE FUNCTION public.transfer_matching_to_everysite(p_amount numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid; v_b numeric; v_u numeric; v_p numeric; v_remain numeric;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'กรุณาเข้าสู่ระบบใหม่'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'จำนวนเงินต้องมากกว่า 0'; END IF;
  SELECT budget_matching_fund, used_matching_fund, pending_matching_fund
    INTO v_b, v_u, v_p FROM public.profiles WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ไม่พบข้อมูลผู้ใช้'; END IF;
  v_remain := v_b - v_u - v_p;
  IF v_remain < p_amount THEN RAISE EXCEPTION 'งบ Matching Fund คงเหลือไม่พอ (เหลือ %)', v_remain; END IF;
  UPDATE public.profiles
     SET budget_matching_fund = budget_matching_fund - p_amount,
         budget_everysite     = budget_everysite + p_amount,
         updated_at = now()
   WHERE user_id = v_uid;
END; $$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs          ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS profiles_select_own      ON public.profiles;
DROP POLICY IF EXISTS profiles_select_admin    ON public.profiles;
DROP POLICY IF EXISTS profiles_select_approver ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own      ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own      ON public.profiles;
DROP POLICY IF EXISTS profiles_update_admin    ON public.profiles;
CREATE POLICY profiles_select_own      ON public.profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY profiles_select_admin    ON public.profiles FOR SELECT USING (public.is_admin());
CREATE POLICY profiles_select_approver ON public.profiles FOR SELECT USING (public.is_approver());
CREATE POLICY profiles_insert_own      ON public.profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY profiles_update_own      ON public.profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY profiles_update_admin    ON public.profiles FOR UPDATE USING (public.is_admin());

-- zones
DROP POLICY IF EXISTS zones_select_auth  ON public.zones;
DROP POLICY IF EXISTS zones_admin_write   ON public.zones;
CREATE POLICY zones_select_auth ON public.zones FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY zones_admin_write ON public.zones FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- requests
DROP POLICY IF EXISTS requests_select_own      ON public.requests;
DROP POLICY IF EXISTS requests_select_admin    ON public.requests;
DROP POLICY IF EXISTS requests_select_approver ON public.requests;
DROP POLICY IF EXISTS requests_insert_own      ON public.requests;
DROP POLICY IF EXISTS requests_update_own      ON public.requests;
DROP POLICY IF EXISTS requests_update_admin    ON public.requests;
DROP POLICY IF EXISTS requests_update_approver ON public.requests;
CREATE POLICY requests_select_own      ON public.requests FOR SELECT USING (requester_id = public.my_profile_id());
CREATE POLICY requests_select_admin    ON public.requests FOR SELECT USING (public.is_admin());
CREATE POLICY requests_select_approver ON public.requests FOR SELECT USING (public.is_approver());
CREATE POLICY requests_insert_own      ON public.requests FOR INSERT WITH CHECK (requester_id = public.my_profile_id() AND public.is_approved());
CREATE POLICY requests_update_own      ON public.requests FOR UPDATE USING (requester_id = public.my_profile_id() AND status IN ('draft','returned'));
CREATE POLICY requests_update_admin    ON public.requests FOR UPDATE USING (public.is_admin());
CREATE POLICY requests_update_approver ON public.requests FOR UPDATE USING (public.is_approver());

DROP POLICY IF EXISTS requests_delete_own   ON public.requests;
DROP POLICY IF EXISTS requests_delete_admin ON public.requests;
CREATE POLICY requests_delete_own   ON public.requests FOR DELETE USING (
  requester_id = public.my_profile_id() AND status IN ('draft', 'returned')
);
CREATE POLICY requests_delete_admin ON public.requests FOR DELETE USING (public.is_admin());

-- request_attachments
DROP POLICY IF EXISTS attach_select_own      ON public.request_attachments;
DROP POLICY IF EXISTS attach_select_admin    ON public.request_attachments;
DROP POLICY IF EXISTS attach_select_approver ON public.request_attachments;
DROP POLICY IF EXISTS attach_insert_own      ON public.request_attachments;
DROP POLICY IF EXISTS attach_delete_own      ON public.request_attachments;
CREATE POLICY attach_select_own ON public.request_attachments FOR SELECT USING (
  request_id IN (SELECT id FROM public.requests WHERE requester_id = public.my_profile_id())
);
CREATE POLICY attach_select_admin ON public.request_attachments FOR SELECT USING (public.is_admin());
CREATE POLICY attach_select_approver ON public.request_attachments FOR SELECT USING (public.is_approver());
CREATE POLICY attach_insert_own ON public.request_attachments FOR INSERT WITH CHECK (
  request_id IN (SELECT id FROM public.requests WHERE requester_id = public.my_profile_id())
);
CREATE POLICY attach_delete_own ON public.request_attachments FOR DELETE USING (
  request_id IN (SELECT id FROM public.requests
                 WHERE requester_id = public.my_profile_id() AND status IN ('draft','returned'))
);

-- audit_logs
DROP POLICY IF EXISTS audit_select_admin  ON public.audit_logs;
DROP POLICY IF EXISTS audit_insert_approved ON public.audit_logs;
CREATE POLICY audit_select_admin    ON public.audit_logs FOR SELECT USING (public.is_admin());
CREATE POLICY audit_insert_approved ON public.audit_logs FOR INSERT WITH CHECK (public.is_approved());

-- ── zones_public (anon อ่านได้ ตอนสมัคร) ────────────────────────────────────
DROP VIEW IF EXISTS public.zones_public;
CREATE VIEW public.zones_public AS
  SELECT id, name, description, sort_order FROM public.zones;
GRANT SELECT ON public.zones_public TO anon, authenticated;

-- ── STORAGE ─────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES ('request-attachments','request-attachments', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('approval-pdfs','approval-pdfs', false) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS storage_attach_read   ON storage.objects;
DROP POLICY IF EXISTS storage_attach_write  ON storage.objects;
DROP POLICY IF EXISTS storage_attach_delete ON storage.objects;
CREATE POLICY storage_attach_read   ON storage.objects FOR SELECT USING (bucket_id IN ('request-attachments','approval-pdfs') AND auth.uid() IS NOT NULL);
CREATE POLICY storage_attach_write  ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('request-attachments','approval-pdfs') AND auth.uid() IS NOT NULL);
CREATE POLICY storage_attach_delete ON storage.objects FOR DELETE USING (bucket_id = 'request-attachments' AND auth.uid() IS NOT NULL);
