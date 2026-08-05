-- ============================================================================
-- Trigger: สร้างแถว profiles อัตโนมัติเมื่อมี auth user ใหม่ (สมัครสมาชิก)
-- รันใน SQL Editor เพิ่มเติม (หลัง setup.sql) เมื่อต้องการเปิดให้สมัครสมาชิกผ่านแอป
--
-- อ่านข้อมูลจาก raw_user_meta_data ที่ Register.tsx ส่งมาผ่าน supabase.auth.signUp
-- ตั้ง role='requester', status='pending' รออนุมัติ
-- ปลอดภัย: import ที่รันไปแล้วไม่กระทบ (trigger นี้มีผลกับ signUp ครั้งใหม่เท่านั้น)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id, email, full_name, first_name, last_name,
    role, status, zone_id, affiliation, department, branch, phone, line_id
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    'requester',
    'pending',
    NEW.raw_user_meta_data->>'zone_id',
    NEW.raw_user_meta_data->>'affiliation',
    NEW.raw_user_meta_data->>'department',
    NEW.raw_user_meta_data->>'branch',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'line_id'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
