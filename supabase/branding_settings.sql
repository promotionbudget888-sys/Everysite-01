-- ============================================================================
-- Branding settings: ตาราง app_settings + storage bucket 'branding'
-- ใช้เก็บรูปแบนเนอร์หน้าล็อกอิน/สมัครสมาชิก (แอดมิน/God Mode ตั้งได้จากหน้าตั้งค่า)
-- รันครั้งเดียวใน Supabase → SQL Editor
-- ============================================================================

-- 1) ตารางเก็บค่าตั้งค่าแบบ key/value ----------------------------------------
create table if not exists public.app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.app_settings enable row level security;

-- อ่านได้ทุกคน (หน้าล็อกอินต้องอ่านรูปได้ก่อนล็อกอิน)
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read
  on public.app_settings for select
  using (true);

-- เขียนได้เฉพาะแอดมินที่อนุมัติแล้ว
drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write
  on public.app_settings for all
  using (exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin' and p.status = 'approved'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin' and p.status = 'approved'
  ));

grant select on public.app_settings to anon, authenticated;
grant insert, update, delete on public.app_settings to authenticated;

-- 2) Storage bucket สาธารณะสำหรับรูปแบรนด์ -----------------------------------
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do update set public = true;

-- อ่านรูปได้ทุกคน (bucket สาธารณะ)
drop policy if exists branding_read on storage.objects;
create policy branding_read
  on storage.objects for select
  using (bucket_id = 'branding');

-- อัปโหลด/แก้ไข/ลบ ได้เฉพาะแอดมิน
drop policy if exists branding_insert on storage.objects;
create policy branding_insert
  on storage.objects for insert
  with check (bucket_id = 'branding' and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin' and p.status = 'approved'
  ));

drop policy if exists branding_update on storage.objects;
create policy branding_update
  on storage.objects for update
  using (bucket_id = 'branding' and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin' and p.status = 'approved'
  ));

drop policy if exists branding_delete on storage.objects;
create policy branding_delete
  on storage.objects for delete
  using (bucket_id = 'branding' and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin' and p.status = 'approved'
  ));
