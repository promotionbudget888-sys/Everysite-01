// ============================================================================
// update-requests.mjs — อัปเดตข้อมูล "คำขอ" ใน Supabase จาก Budget Requests.xlsx
// (แถวเดิมที่แก้ไข → อัปเดต, แถวใหม่ → เพิ่ม)  upsert ตาม request_id
//
// วิธีรัน (จากโฟลเดอร์โปรเจกต์):
//   node --env-file=.env scripts/update-requests.mjs            # อัปเดตจริง
//   node --env-file=.env scripts/update-requests.mjs --dry      # ดูก่อนว่าจะเปลี่ยนอะไร (ไม่เขียน)
//
// path ไฟล์ (แก้ได้): env REQUESTS_XLSX (ค่า default = ./data/Budget Requests.xlsx)
// ============================================================================
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.VITE_SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FILE = process.env.REQUESTS_XLSX || "./data/Budget Requests.xlsx";
const DRY = process.argv.includes("--dry");

if (!URL || !SK) { console.error("❌ ต้องมี VITE_SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ใน .env"); process.exit(1); }
const sb = createClient(URL, SK, { auth: { autoRefreshToken: false, persistSession: false } });

const s = (v) => (v == null ? "" : String(v).replace(/^'/, "").trim());
const orNull = (v) => { const x = s(v); return x === "" ? null : x; };
const num = (v) => { const n = Number(s(v)); return Number.isFinite(n) ? n : 0; };
const isoOrNull = (v) => { const x = s(v); if (!x) return null; const d = new Date(x); return isNaN(d) ? null : d.toISOString(); };
const zoneNorm = (v) => { const x = s(v); if (x === "" || x.toLowerCase() === "none") return null; const m = x.match(/^(-?\d+)(?:\.0+)?$/); return m ? m[1] : x; };
const textNorm = (v) => { if (typeof v === "number") return String(v); const x = s(v); const m = x.match(/^(-?\d+)\.0+$/); return x === "" ? null : (m ? m[1] : x); };

// อ่าน xlsx (คอลัมน์ยืนยันจากไฟล์จริง — ตรงกับ import-from-sheets.mjs)
function readRows(path) {
  const wb = XLSX.read(readFileSync(path), { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true, blankrows: false }).slice(1);
}

function toRequest(r) {
  return {
    id: s(r[1]),
    requester_id: s(r[15]),
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
}

async function main() {
  const rows = readRows(FILE).filter((r) => s(r[1]) !== "");
  console.log(`📄 อ่าน ${rows.length} คำขอจาก ${FILE}${DRY ? "  (DRY RUN — ไม่เขียนจริง)" : ""}`);

  // profile id ที่มีจริง (กัน FK พัง) + request id ที่มีอยู่แล้ว (แยก ใหม่/อัปเดต)
  const { data: profs } = await sb.from("profiles").select("id");
  const validIds = new Set((profs || []).map((p) => p.id));
  const { data: existing } = await sb.from("requests").select("id");
  const existingIds = new Set((existing || []).map((r) => r.id));

  let updated = 0, inserted = 0, skipped = 0, failed = 0;
  for (const raw of rows) {
    const req = toRequest(raw);
    if (!req.id || !req.requester_id) { skipped++; continue; }
    if (!validIds.has(req.requester_id)) { skipped++; continue; } // ไม่มีเจ้าของใน profiles
    const isNew = !existingIds.has(req.id);

    if (DRY) { isNew ? inserted++ : updated++; continue; }
    const { error } = await sb.from("requests").upsert(req, { onConflict: "id" });
    if (error) { console.error(`  ❌ ${req.id.slice(0, 8)}: ${error.message}`); failed++; continue; }
    isNew ? inserted++ : updated++;
  }

  console.log(`\n${DRY ? "จะ" : "✅"} อัปเดต ${updated} · เพิ่มใหม่ ${inserted} · ข้าม ${skipped}${failed ? ` · ล้มเหลว ${failed}` : ""}`);
  if (DRY) console.log("รันจริงด้วย: node --env-file=.env scripts/update-requests.mjs");
}
main().catch((e) => { console.error("💥", e); process.exit(1); });
