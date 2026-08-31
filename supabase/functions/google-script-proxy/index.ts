// Edge Function: google-script-proxy
// ส่งต่อคำขอไปยัง Google Apps Script โดยใส่ SECRET_TOKEN ให้ "ฝั่ง server"
// → token ไม่หลุดมาอยู่ใน frontend อีกต่อไป
// เรียกได้เฉพาะผู้ใช้ที่ล็อกอินแล้ว (verify JWT เปิดไว้ตอน deploy)
//
// Deploy: supabase functions deploy google-script-proxy
//   หรือ Dashboard → Edge Functions → Deploy a new function → ชื่อ google-script-proxy → วางโค้ดนี้
// ต้องตั้ง Secrets 2 ตัว (Edge Functions → Secrets / Manage secrets):
//   GOOGLE_APPS_SCRIPT_URL = https://script.google.com/macros/s/.../exec
//   GAS_SECRET_TOKEN       = <SECRET_TOKEN เดิมใน CONFIG ของ GAS>

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const GAS_URL = Deno.env.get("GOOGLE_APPS_SCRIPT_URL");
    const TOKEN = Deno.env.get("GAS_SECRET_TOKEN");
    if (!GAS_URL || !TOKEN) {
      return json({ success: false, error: "proxy ยังไม่ตั้งค่า (GOOGLE_APPS_SCRIPT_URL / GAS_SECRET_TOKEN)" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const payload = { ...body, _token: TOKEN };

    const res = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // เลี่ยง CORS preflight ฝั่ง GAS
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      return json({ success: false, error: "GAS ตอบกลับไม่ใช่ JSON (เช็ก URL /exec และ deploy เวอร์ชันล่าสุด)" }, 502);
    }
    // ส่งต่อ response ของ GAS ตรง ๆ ({ success, data, error })
    return json(parsed, 200);
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : "proxy error" }, 500);
  }
});
