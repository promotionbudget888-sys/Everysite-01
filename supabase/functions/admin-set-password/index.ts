// Edge Function: admin-set-password
// ให้ "แอดมิน" ตั้งรหัสผ่านใหม่ให้ผู้ใช้คนอื่นได้ อย่างปลอดภัย
// - verify ผู้เรียกเป็น admin (จาก JWT) ฝั่ง server
// - ใช้ service_role (อยู่ใน env ของ edge function เท่านั้น ไม่หลุดมา frontend)
//
// Deploy: supabase functions deploy admin-set-password
//   หรือสร้างใน Dashboard → Edge Functions → New function → วางโค้ดนี้
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const { email, password } = await req.json().catch(() => ({}));
    if (!email || !password || String(password).length < 6) {
      return json({ error: "ต้องมี email และ password อย่างน้อย 6 ตัว" }, 400);
    }

    // 1) ยืนยันว่าผู้เรียกเป็นแอดมินที่อนุมัติแล้ว
    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uErr } = await caller.auth.getUser();
    if (uErr || !user) return json({ error: "unauthorized" }, 401);
    const { data: prof } = await caller.from("profiles").select("role,status").eq("user_id", user.id).maybeSingle();
    if (!prof || prof.role !== "admin" || prof.status !== "approved") {
      return json({ error: "ต้องเป็นผู้ดูแลระบบ (admin)" }, 403);
    }

    // 2) ตั้งรหัสผ่านให้ผู้ใช้เป้าหมาย (service role)
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: target } = await admin.from("profiles").select("user_id, email").eq("email", String(email).toLowerCase()).maybeSingle();
    if (!target?.user_id) return json({ error: "ไม่พบผู้ใช้ตาม email นี้" }, 404);

    const { error: pErr } = await admin.auth.admin.updateUserById(target.user_id, { password: String(password) });
    if (pErr) return json({ error: pErr.message }, 400);

    return json({ success: true, email: target.email });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "server error" }, 500);
  }
});
