import { supabase } from '@/integrations/supabase/client';

// เรียก Google Apps Script ผ่าน Supabase Edge Function "google-script-proxy"
// proxy จะใส่ SECRET_TOKEN ให้ฝั่ง server → token ไม่หลุดมาอยู่ใน bundle ของ frontend
// (เดิม api.ts ยิง GAS ตรง ๆ พร้อม token ที่ hardcode = ช่องโหว่)

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function apiPost<T = any>(
  body: Record<string, any>
): Promise<ApiResponse<T>> {
  try {
    const { data, error } = await supabase.functions.invoke('google-script-proxy', { body });
    if (error) return { success: false, error: error.message };
    if (data && typeof data === 'object') return data as ApiResponse<T>;
    return { success: false, error: 'ไม่มีการตอบกลับจาก proxy' };
  } catch (err) {
    console.error('GAS proxy error:', err);
    return { success: false, error: String(err) };
  }
}

export async function apiGet<T = any>(
  params: Record<string, string>
): Promise<ApiResponse<T>> {
  return apiPost<T>(params);
}
