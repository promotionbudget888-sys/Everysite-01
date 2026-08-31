// Edge Function: admin-users
// การจัดการผู้ใช้ที่ต้องใช้สิทธิ์สูง (service_role) อย่างปลอดภัย
//   action: "set_password" → ตั้งรหัสผ่านใหม่ให้ผู้ใช้
//   action: "delete_user"  → ลบผู้ใช้ (บัญชี + profile; คำขอของผู้ใช้จะถูกลบตาม cascade)
//
// - verify ผู้เรียกเป็น admin ที่อนุมัติแล้ว (จาก JWT) ฝั่ง server
// - service_role อยู่ใน env ของ edge function เท่านั้น ไม่หลุดมา frontend
//
// Deploy: supabase functions deploy admin-users
//   หรือ Dashboard → Edge Functions → Deploy a new function → ชื่อ admin-users → วางโค้ดนี้
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const { action, email, password } = await req.json().catch(() => ({}));
    if (!email) return json({ error: "ต้องระบุ email" }, 400);

    // 1) ยืนยันผู้เรียกเป็นแอดมินที่อนุมัติแล้ว
    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uErr } = await caller.auth.getUser();
    if (uErr || !user) return json({ error: "unauthorized" }, 401);
    const { data: me } = await caller.from("profiles").select("role,status").eq("user_id", user.id).maybeSingle();
    if (!me || me.role !== "admin" || me.status !== "approved") {
      return json({ error: "ต้องเป็นผู้ดูแลระบบ (admin)" }, 403);
    }

    // 2) หา user เป้าหมายจาก email
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: target } = await admin.from("profiles").select("user_id, email").eq("email", String(email).toLowerCase()).maybeSingle();
    if (!target?.user_id) return json({ error: "ไม่พบผู้ใช้ตาม email นี้" }, 404);

    if (action === "set_password") {
      if (!password || String(password).length < 6) return json({ error: "รหัสผ่านต้องอย่างน้อย 6 ตัว" }, 400);
      const { error } = await admin.auth.admin.updateUserById(target.user_id, { password: String(password) });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true, email: target.email });
    }

    if (action === "delete_user") {
      if (target.user_id === user.id) return json({ error: "ลบบัญชีตัวเองไม่ได้" }, 400);
      // ลบ auth user → cascade profile → cascade requests ของผู้ใช้
      const { error } = await admin.auth.admin.deleteUser(target.user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true, email: target.email });
    }

    return json({ error: "action ไม่ถูกต้อง (set_password | delete_user)" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "server error" }, 500);
  }
});
