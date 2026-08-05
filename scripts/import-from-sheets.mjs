// ============================================================================
// import-from-sheets.mjs
// ย้ายข้อมูลเดิมจาก Google Sheets (.xlsx export) → Supabase  (รันครั้งเดียว, idempotent)
//
// อ่านไฟล์ .xlsx โดยตรง — column mapping ยืนยันจากไฟล์จริงแล้ว
//   Users.xlsx / Budget Requests.xlsx / Logs.xlsx
//
// ทำ:
//   1. สร้าง user ใน Supabase Auth ด้วย email + รหัสผ่านเดิม (login เดิมได้)
//   2. เติม profiles / requests / audit_logs
//
// วิธีรัน (จากโฟลเดอร์โปรเจกต์):
//   1) .env ต้องมี  VITE_SUPABASE_URL  และ  SUPABASE_SERVICE_ROLE_KEY
//   2) วางไฟล์ทั้ง 3 ไว้ใน ./data/  (หรือกำหนด path เองผ่าน env ด้านล่าง)
//   3) node --env-file=.env scripts/import-from-sheets.mjs
//
// รันซ้ำได้: user เดิม -> ข้าม auth, แถว id ซ้ำ -> upsert
// ============================================================================

import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// path ของไฟล์ (แก้ได้ด้วย env)
const USERS_XLSX    = process.env.USERS_XLSX    || "./data/Users.xlsx";
const REQUESTS_XLSX = process.env.REQUESTS_XLSX || "./data/Budget Requests.xlsx";
const LOGS_XLSX     = process.env.LOGS_XLSX     || "./data/Logs.xlsx";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ ต้องตั้งค่า VITE_SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ใน .env ก่อน");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── อ่าน xlsx เป็น array ของ array (แถวแรก = header) ─────────────────────────
function readXlsx(path) {
  let buf;
  try { buf = readFileSync(path); }
  catch { console.warn(`⚠️  ไม่พบไฟล์ ${path} — ข้าม`); return []; }
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true, blankrows: false });
  return rows.slice(1); // ตัด header
}

// ── helpers ─────────────────────────────────────────────────────────────────
const s = (v) => (v === null || v === undefined) ? "" : String(v).replace(/^'/, "").trim();
const orNull = (v) => { const x = s(v); return x === "" ? null : x; };
const num = (v) => { const n = Number(s(v)); return Number.isFinite(n) ? n : 0; };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isoOrNull = (v) => { const x = s(v); if (!x) return null; const d = new Date(x); return isNaN(d) ? null : d.toISOString(); };
// zone: 2.0 / "2.0" / "2" -> "2" ; ว่าง/None -> null
const zoneNorm = (v) => {
  const x = s(v);
  if (x === "" || x.toLowerCase() === "none") return null;
  const m = x.match(/^(-?\d+)(?:\.0+)?$/);
  return m ? m[1] : x;
};
// ค่าที่ควรเป็นข้อความแต่บางแถวเป็นตัวเลข (เช่น department 4.0) -> "4"
const textNorm = (v) => {
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  const x = s(v);
  const m = x.match(/^(-?\d+)\.0+$/);
  return x === "" ? null : (m ? m[1] : x);
};

// ── โหลด auth users เดิม (email -> id) เพื่อรันซ้ำได้ ─────────────────────────
async function loadExistingAuthUsers() {
  const map = new Map();
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) if (u.email) map.set(u.email.toLowerCase(), u.id);
    if (data.users.length < 1000) break;
    page++;
  }
  return map;
}

// ── 1) USERS ────────────────────────────────────────────────────────────────
// ยืนยันตำแหน่งคอลัมน์จาก "แถวข้อมูลจริง" (0-based) — หมายเหตุ: แถว header ใน
// ไฟล์ถูกแก้มือจนเหลื่อม (label user_id อยู่ col19) แต่ค่า UUID จริงอยู่ col22
// ตามลำดับที่ GAS appendRow เขียน:
// 0 timestamp · 2 full_name · 3 email · 4 affiliation · 5 branch · 6 department
// 7 role · 8 status · 9 zone · 11 password · 12 phone · 13 first_name
// 14 last_name · 15 budget_mf · 16 budget_es · 17 used_mf · 18 used_es
// 21 LINE UserID · 22 user_id(UUID)
async function importUsers() {
  const rows = readXlsx(USERS_XLSX).filter((r) => s(r[3]) !== ""); // ต้องมี email
  console.log(`\n👥 Users: ${rows.length} คน`);
  const existing = await loadExistingAuthUsers();
  let created = 0, reused = 0, failed = 0;
  const weakPw = [];

  for (const r of rows) {
    const email = s(r[3]).toLowerCase();
    const rawPw = s(r[11]);
    const password = rawPw || "Everysite@123"; // เผื่อรหัสว่าง
    if (rawPw && rawPw.length < 6) { weakPw.push(email); }
    let authId = existing.get(email);

    if (!authId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: s(r[2]) },
      });
      if (error) { console.error(`  ❌ auth ${email}: ${error.message}`); failed++; continue; }
      authId = data.user.id;
      created++;
    } else reused++;

    const profileId = UUID_RE.test(s(r[22])) ? s(r[22]) : undefined; // profiles.id = UUID เดิม (col22)
    const profile = {
      ...(profileId ? { id: profileId } : {}),
      user_id: authId,
      email,
      full_name: s(r[2]) || email,
      first_name: orNull(r[13]),
      last_name: orNull(r[14]),
      role: s(r[7]) || "requester",
      status: s(r[8]) || "pending",
      zone_id: zoneNorm(r[9]),
      phone: orNull(r[12]),
      affiliation: textNorm(r[4]),
      department: textNorm(r[6]),
      branch: textNorm(r[5]),
      line_id: orNull(r[21]),
      budget_matching_fund: num(r[15]),
      budget_everysite: num(r[16]),
      used_matching_fund: num(r[17]),
      used_everysite: num(r[18]),
      ...(isoOrNull(r[0]) ? { created_at: isoOrNull(r[0]) } : {}),
    };
    const { error: pErr } = await supabase.from("profiles").upsert(profile, { onConflict: "user_id" });
    if (pErr) { console.error(`  ❌ profile ${email}: ${pErr.message}`); failed++; }
  }

  console.log(`  ✅ auth ใหม่ ${created} / ใช้เดิม ${reused} / ล้มเหลว ${failed}`);
  if (weakPw.length) console.log(`  ⚠️  รหัสสั้นกว่า 6 ตัว (${weakPw.length}) อาจสร้างไม่ได้: ${weakPw.join(", ")}`);
}

// ── 2) REQUESTS ───────────────────────────────────────────────────────────
// 0 timestamp · 1 request_id · 2 title · 3 desc · 4 type · 5 size · 6 size_code
// 7 amount · 8 req_name · 9 req_email · 10 dept · 11 branch · 12 affiliation
// 13 status · 14 zone_id · 15 requester_id · 16 admin_notes · 17 zone_notes
// 18 final_notes · 19 rejected_reason
// 20 admin_review_at · 21 zone1_at · 22 zone2_at · 23 final_at
async function importRequests() {
  const rows = readXlsx(REQUESTS_XLSX).filter((r) => s(r[1]) !== "");
  console.log(`\n📄 Requests: ${rows.length} รายการ`);

  const { data: profs } = await supabase.from("profiles").select("id");
  const validIds = new Set((profs || []).map((p) => p.id));

  let ok = 0, skipped = 0, failed = 0;
  for (const r of rows) {
    const id = s(r[1]);
    const requesterId = s(r[15]);
    if (!id || !requesterId) { skipped++; continue; }
    if (!validIds.has(requesterId)) {
      console.warn(`  ⚠️  request ${id.slice(0, 8)}: ไม่พบ requester ${requesterId.slice(0, 8)} ใน profiles — ข้าม`);
      skipped++; continue;
    }
    const req = {
      id,
      requester_id: requesterId,
      zone_id: zoneNorm(r[14]),
      title: s(r[2]) || "-",
      description: orNull(r[3]),
      request_type: orNull(r[4]),
      size: orNull(r[5]),
      size_code: orNull(r[6]),
      amount: num(r[7]),
      requester_name: orNull(r[8]),
      requester_email: orNull(r[9]),
      department: textNorm(r[10]),
      branch: textNorm(r[11]),
      affiliation: textNorm(r[12]),
      status: s(r[13]) || "submitted",
      admin_notes: orNull(r[16]),
      zone_approver_notes: orNull(r[17]),
      final_notes: orNull(r[18]),
      rejected_reason: orNull(r[19]),
      admin_at: isoOrNull(r[20]),
      zone1_at: isoOrNull(r[21]),
      zone2_at: isoOrNull(r[22]),
      final_at: isoOrNull(r[23]),
      ...(isoOrNull(r[0]) ? { created_at: isoOrNull(r[0]) } : {}),
    };
    const { error } = await supabase.from("requests").upsert(req, { onConflict: "id" });
    if (error) { console.error(`  ❌ request ${id.slice(0, 8)}: ${error.message}`); failed++; continue; }
    ok++;
  }
  console.log(`  ✅ นำเข้า ${ok} / ข้าม ${skipped} / ล้มเหลว ${failed}`);
}

// ── 3) AUDIT LOGS ───────────────────────────────────────────────────────────
// 0 timestamp · 1 actor_name · 2 actor_role · 3 action · 4 target_type
// 5 target_id · 6 detail · 7 log_id
async function importLogs() {
  const rows = readXlsx(LOGS_XLSX).filter((r) => s(r[3]) !== "");
  console.log(`\n📝 Logs: ${rows.length} รายการ`);
  const batch = rows.map((r) => ({
    actor_name: s(r[1]) || "System",
    actor_role: s(r[2]) || "system",
    action: s(r[3]),
    target_type: s(r[4]) || "system",
    target_id: UUID_RE.test(s(r[5])) ? s(r[5]) : null,
    detail: orNull(r[6]),
    ...(isoOrNull(r[0]) ? { created_at: isoOrNull(r[0]) } : {}),
  }));
  let ok = 0, failed = 0;
  for (let i = 0; i < batch.length; i += 500) {
    const chunk = batch.slice(i, i + 500);
    const { error } = await supabase.from("audit_logs").insert(chunk);
    if (error) { console.error(`  ❌ logs batch ${i}: ${error.message}`); failed += chunk.length; }
    else ok += chunk.length;
  }
  console.log(`  ✅ นำเข้า ${ok} / ล้มเหลว ${failed}`);
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 เริ่ม import →", SUPABASE_URL);
  await importUsers();     // ต้องมาก่อน (requests อ้าง profiles.id)
  await importRequests();
  await importLogs();
  console.log("\n🎉 เสร็จสิ้น");
}

main().catch((e) => { console.error("💥", e); process.exit(1); });
