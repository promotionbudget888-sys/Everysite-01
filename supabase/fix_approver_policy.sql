-- ============================================================================
-- แก้บั๊ก: L1/L2 ไม่เห็นคำขอที่แอดมินส่งมา (รันใน Supabase → SQL Editor ครั้งเดียว)
--
-- สาเหตุ: policy ผู้อนุมัติเดิมบังคับ "เห็นเฉพาะโซนตัวเอง" (zone_id = my_zone())
-- แต่ผู้อนุมัติ L1/L2 จริงมี zone_id = null (เป็นผู้อนุมัติกลาง เหมือนระบบ GAS เดิม)
-- → เงื่อนไข zone_id = null ไม่เป็นจริงกับแถวไหนเลย → มองไม่เห็นคำขอทั้งหมด
--
-- แก้: ให้ผู้อนุมัติเห็น/อนุมัติได้ทุกโซน (ตาม role ไม่ผูกโซน)
-- ============================================================================

DROP POLICY IF EXISTS requests_select_approver ON public.requests;
CREATE POLICY requests_select_approver ON public.requests
  FOR SELECT USING (public.is_approver());

DROP POLICY IF EXISTS requests_update_approver ON public.requests;
CREATE POLICY requests_update_approver ON public.requests
  FOR UPDATE USING (public.is_approver());

DROP POLICY IF EXISTS attach_select_approver ON public.request_attachments;
CREATE POLICY attach_select_approver ON public.request_attachments
  FOR SELECT USING (public.is_approver());
