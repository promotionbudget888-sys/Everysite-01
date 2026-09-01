import { supabase } from '@/integrations/supabase/client';

// คีย์ที่ใช้เก็บใน public.app_settings
const BANNER_KEY = 'login_banner_url';
const BUCKET = 'branding';

// อ่าน URL รูปแบนเนอร์หน้าล็อกอิน (อ่านได้แม้ยังไม่ล็อกอิน — policy select ให้ทุกคน)
export async function getLoginBanner(): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', BANNER_KEY)
      .maybeSingle();
    const url = (data?.value || '').trim();
    return url || null;
  } catch {
    return null;
  }
}

// อัปโหลดรูปใหม่ + บันทึก URL (เฉพาะแอดมิน — บังคับด้วย RLS ฝั่ง server)
export async function setLoginBanner(file: File): Promise<{ url: string }> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `login-banner-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type });
  if (upErr) throw upErr;

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const url = pub.publicUrl;

  const { error: setErr } = await supabase
    .from('app_settings')
    .upsert({ key: BANNER_KEY, value: url, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (setErr) throw setErr;

  return { url };
}

// ลบรูปแบนเนอร์ (กลับไปใช้ดีไซน์เริ่มต้น)
export async function clearLoginBanner(): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: BANNER_KEY, value: '', updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
}
