-- ============================================================================
-- เพิ่ม RLS policy สำหรับ "ลบคำขอ" (รันใน Supabase → SQL Editor ครั้งเดียว)
-- ตอนตั้ง setup.sql รอบแรกยังไม่มี DELETE policy → ลบจากเว็บ (session ผู้ใช้)
-- ยังไม่ได้ผล ต้องเพิ่มอันนี้
--
--   requester : ลบได้เฉพาะคำขอของตัวเองที่ยัง draft/returned
--   admin     : ลบได้ทุกคำขอ
-- (ไฟล์แนบจะถูกลบตามอัตโนมัติด้วย ON DELETE CASCADE)
-- ============================================================================

DROP POLICY IF EXISTS requests_delete_own   ON public.requests;
DROP POLICY IF EXISTS requests_delete_admin ON public.requests;

CREATE POLICY requests_delete_own ON public.requests FOR DELETE USING (
  requester_id = public.my_profile_id() AND status IN ('draft', 'returned')
);

CREATE POLICY requests_delete_admin ON public.requests FOR DELETE USING (public.is_admin());
