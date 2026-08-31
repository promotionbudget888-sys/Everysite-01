-- ============================================================================
-- fix_rls_security.sql — ปิดช่องโหว่ RLS (รันใน Supabase → SQL Editor ครั้งเดียว)
--
-- ปัญหาที่พบ (เจาะทดสอบแล้ว): ผู้ใช้ที่ login แล้ว (แม้เป็น requester ธรรมดา)
--   • ยกระดับ role ตัวเองเป็น admin ได้
--   • อ่าน/แก้ profiles และ requests ของคนอื่นได้ทั้งหมด
-- สาเหตุ: มี policy "permissive" แปลกปลอม (เช่น USING (true) / auth.role()='authenticated')
--   ที่เปิดกว้างเกินไป — น่าจะถูกเพิ่มผ่าน Dashboard ตอน debug
--
-- ไฟล์นี้: (1) เปิด RLS ให้ครบ (2) ลบ policy เดิม "ทั้งหมด" บนตารางที่เกี่ยวข้อง
--   (3) สร้าง policy ที่ถูกต้องใหม่ (4) เพิ่ม trigger กันผู้ใช้แก้ role/status/งบ ตัวเอง
-- ============================================================================

-- 0) helper functions (สร้างซ้ำได้ กันกรณีหาย) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_profile_id() RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path=public AS $$ SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1; $$;
CREATE OR REPLACE FUNCTION public.my_zone() RETURNS text LANGUAGE sql SECURITY DEFINER STABLE SET search_path=public AS $$ SELECT zone_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1; $$;
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path=public AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role='admin' AND status='approved'); $$;
CREATE OR REPLACE FUNCTION public.is_approved() RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path=public AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND status='approved'); $$;
CREATE OR REPLACE FUNCTION public.is_approver() RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path=public AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND status='approved' AND role IN ('zone_approver','zone_approver_1','zone_approver_2')); $$;

-- 1) เปิด RLS ให้ครบ ─────────────────────────────────────────────────────────
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.requests            FORCE ROW LEVEL SECURITY;

-- 2) ลบ policy เดิมทั้งหมด (กวาด policy แปลกปลอมออก) ──────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN ('profiles','requests','request_attachments','audit_logs','zones')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 3) สร้าง policy ที่ถูกต้อง ──────────────────────────────────────────────────

-- profiles: อ่านของตัวเอง / admin / ผู้อนุมัติ ; แก้/เพิ่มของตัวเอง / admin
CREATE POLICY profiles_select_own      ON public.profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY profiles_select_admin    ON public.profiles FOR SELECT USING (public.is_admin());
CREATE POLICY profiles_select_approver ON public.profiles FOR SELECT USING (public.is_approver());
CREATE POLICY profiles_insert_own      ON public.profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY profiles_update_own      ON public.profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY profiles_update_admin    ON public.profiles FOR UPDATE USING (public.is_admin());

-- zones: authenticated อ่านได้ ; admin จัดการ
CREATE POLICY zones_select_auth ON public.zones FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY zones_admin_write ON public.zones FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- requests
CREATE POLICY requests_select_own      ON public.requests FOR SELECT USING (requester_id = public.my_profile_id());
CREATE POLICY requests_select_admin    ON public.requests FOR SELECT USING (public.is_admin());
CREATE POLICY requests_select_approver ON public.requests FOR SELECT USING (public.is_approver());
CREATE POLICY requests_insert_own      ON public.requests FOR INSERT WITH CHECK (requester_id = public.my_profile_id() AND public.is_approved());
CREATE POLICY requests_update_own      ON public.requests FOR UPDATE USING (requester_id = public.my_profile_id() AND status IN ('draft','returned'));
CREATE POLICY requests_update_admin    ON public.requests FOR UPDATE USING (public.is_admin());
CREATE POLICY requests_update_approver ON public.requests FOR UPDATE USING (public.is_approver());
CREATE POLICY requests_delete_own      ON public.requests FOR DELETE USING (requester_id = public.my_profile_id() AND status IN ('draft','returned'));
CREATE POLICY requests_delete_admin    ON public.requests FOR DELETE USING (public.is_admin());

-- request_attachments
CREATE POLICY attach_select_own      ON public.request_attachments FOR SELECT USING (request_id IN (SELECT id FROM public.requests WHERE requester_id = public.my_profile_id()));
CREATE POLICY attach_select_admin    ON public.request_attachments FOR SELECT USING (public.is_admin());
CREATE POLICY attach_select_approver ON public.request_attachments FOR SELECT USING (public.is_approver());
CREATE POLICY attach_insert_own      ON public.request_attachments FOR INSERT WITH CHECK (request_id IN (SELECT id FROM public.requests WHERE requester_id = public.my_profile_id()));
CREATE POLICY attach_delete_own      ON public.request_attachments FOR DELETE USING (request_id IN (SELECT id FROM public.requests WHERE requester_id = public.my_profile_id() AND status IN ('draft','returned')));

-- audit_logs: admin อ่าน ; ผู้อนุมัติแล้ว insert
CREATE POLICY audit_select_admin    ON public.audit_logs FOR SELECT USING (public.is_admin());
CREATE POLICY audit_insert_approved ON public.audit_logs FOR INSERT WITH CHECK (public.is_approved());

-- 4) trigger กันยกระดับสิทธิ์ + แก้งบตัวเอง (ผู้ที่ไม่ใช่ admin) ──────────────
CREATE OR REPLACE FUNCTION public.guard_profile_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- admin หรือ service_role (backend, auth.uid() เป็น null) แก้ได้ทุกอย่าง
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  -- ผู้ใช้ทั่วไป: ล็อก role/status เสมอ (กันยกระดับสิทธิ์)
  NEW.role   := OLD.role;
  NEW.status := OLD.status;
  -- ล็อกงบ ยกเว้นตอน transfer RPC (ตั้ง app.allow_budget = on)
  IF current_setting('app.allow_budget', true) IS DISTINCT FROM 'on' THEN
    NEW.budget_matching_fund  := OLD.budget_matching_fund;
    NEW.budget_everysite      := OLD.budget_everysite;
    NEW.used_matching_fund    := OLD.used_matching_fund;
    NEW.used_everysite        := OLD.used_everysite;
    NEW.pending_matching_fund := OLD.pending_matching_fund;
    NEW.pending_everysite     := OLD.pending_everysite;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_profile ON public.profiles;
CREATE TRIGGER trg_guard_profile BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_changes();

-- 5) transfer RPC: อนุญาตให้แก้งบได้ (ตั้ง GUC ก่อน UPDATE) ───────────────────
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
  PERFORM set_config('app.allow_budget', 'on', true);  -- อนุญาต guard ให้แก้งบรอบนี้
  UPDATE public.profiles
     SET budget_matching_fund = budget_matching_fund - p_amount,
         budget_everysite     = budget_everysite + p_amount,
         updated_at = now()
   WHERE user_id = v_uid;
END; $$;
