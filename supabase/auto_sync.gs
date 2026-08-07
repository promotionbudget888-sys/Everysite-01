// ============================================================================
// auto_sync.gs — sync "แถวใหม่" ในชีต Requests → Supabase อัตโนมัติ (insert-only)
// วางไฟล์นี้ในโปรเจกต์ Apps Script เดียวกับ Code.gs
//
// หลักการ: ทุก 5 นาที สแกนชีต Requests แล้ว "เพิ่ม" เฉพาะแถวที่ยังไม่มีใน Supabase
// (เทียบด้วย request_id) — ไม่แตะแถวเดิม → ไม่ทับข้อมูลที่แก้ผ่านเว็บ
// (Supabase = ฐานหลัก; ชีตส่งเฉพาะของใหม่เข้ามา)
//
// ── ติดตั้ง (ทำครั้งเดียว) ─────────────────────────────────────────────────
//   1) ตั้ง Script properties (Project Settings → Script properties):
//        SUPABASE_URL         = https://rxbyxwxrzqldgkwinqmb.supabase.co
//        SUPABASE_SERVICE_KEY = <service_role key>
//      (ถ้าเคยตั้งไว้ตอน backfill แล้ว ใช้ตัวเดิมได้เลย)
//   2) เลือกฟังก์ชัน installSyncTrigger แล้วกด Run (อนุญาตสิทธิ์ตอนถาม)
//   → เสร็จ! จากนี้แถวใหม่ในชีตจะเข้า Supabase เองทุก 5 นาที
//
//   ทดสอบทันที: เลือก syncNewRequestsToSupabase แล้ว Run → ดู Execution log
//   ปิดการ sync: เลือก removeSyncTrigger แล้ว Run
// ============================================================================

function _supa() {
  var p = PropertiesService.getScriptProperties();
  var url = p.getProperty('SUPABASE_URL'), key = p.getProperty('SUPABASE_SERVICE_KEY');
  if (!url || !key) throw new Error('ตั้ง SUPABASE_URL / SUPABASE_SERVICE_KEY ใน Script properties ก่อน');
  return { url: url.replace(/\/+$/, ''), key: key };
}

// ดึง id ทั้งหมดของตาราง (แบ่งหน้า 1000 ด้วย limit/offset) → { id: true }
function _getIds(supa, table) {
  var ids = {}, offset = 0, size = 1000;
  for (;;) {
    var res = UrlFetchApp.fetch(
      supa.url + '/rest/v1/' + table + '?select=id&limit=' + size + '&offset=' + offset,
      { headers: { apikey: supa.key, Authorization: 'Bearer ' + supa.key }, muteHttpExceptions: true }
    );
    var code = res.getResponseCode();
    if (code !== 200) {
      throw new Error('อ่าน ' + table + ' ไม่ได้ (HTTP ' + code + '): ' + res.getContentText().slice(0, 200) +
        ' — เช็คว่า SUPABASE_SERVICE_KEY เป็น service_role key');
    }
    var arr = JSON.parse(res.getContentText() || '[]');
    if (!arr.length) break;
    for (var i = 0; i < arr.length; i++) ids[arr[i].id] = true;
    if (arr.length < size) break;
    offset += size;
  }
  return ids;
}

function _rowToReq(r) {
  function s(v) { return v == null ? '' : String(v).replace(/^'/, '').trim(); }
  function orn(v) { var x = s(v); return x === '' ? null : x; }
  function zn(v) { var x = s(v); if (x === '' || x.toLowerCase() === 'none') return null; var m = x.match(/^(-?\d+)(?:\.0+)?$/); return m ? m[1] : x; }
  function tn(v) { if (typeof v === 'number') return String(v); var x = s(v); var m = x.match(/^(-?\d+)\.0+$/); return x === '' ? null : (m ? m[1] : x); }
  function iso(v) { var x = s(v); if (!x) return null; var d = new Date(x); return isNaN(d) ? null : d.toISOString(); }
  function nm(v) { var n = Number(s(v)); return isFinite(n) ? n : 0; }
  return {
    id: s(r[1]), requester_id: s(r[15]), zone_id: zn(r[14]),
    title: s(r[2]) || '-', description: orn(r[3]), request_type: orn(r[4]),
    size: orn(r[5]), size_code: orn(r[6]), amount: nm(r[7]),
    requester_name: orn(r[8]), requester_email: orn(r[9]),
    department: tn(r[10]), branch: tn(r[11]), affiliation: tn(r[12]),
    status: s(r[13]) || 'submitted', admin_notes: orn(r[16]),
    zone_approver_notes: orn(r[17]), final_notes: orn(r[18]), rejected_reason: orn(r[19]),
    admin_at: iso(r[20]), zone1_at: iso(r[21]), zone2_at: iso(r[22]), final_at: iso(r[23]),
    created_at: iso(r[0]) || new Date().toISOString(),
  };
}

// ── ฟังก์ชันหลัก (trigger เรียกอันนี้) ────────────────────────────────────────
function syncNewRequestsToSupabase() {
  var supa = _supa();
  var sheet = getRequestsSheet();               // ใช้ helper จาก Code.gs
  if (!sheet) throw new Error('ไม่พบ Requests sheet');
  var rows = sheet.getDataRange().getValues();

  var existing = _getIds(supa, 'requests');       // id ที่มีใน Supabase แล้ว
  var profiles = _getIds(supa, 'profiles');       // เจ้าของที่มีจริง (กัน FK)
  Logger.log('อ่านจาก Supabase → requests=' + Object.keys(existing).length + ', profiles=' + Object.keys(profiles).length +
    (Object.keys(profiles).length === 0 ? '  ⚠️ profiles=0 แปลว่าคีย์ผิด (ต้องใช้ service_role)' : ''));

  var toInsert = [], skippedNoUser = 0;
  for (var i = 1; i < rows.length; i++) {
    var id = String(rows[i][1] || '').trim();
    var reqId = String(rows[i][15] || '').trim();
    if (!id || !reqId) continue;
    if (existing[id]) continue;                   // มีแล้ว → ข้าม (insert-only ไม่ทับ)
    if (!profiles[reqId]) { skippedNoUser++; continue; } // เจ้าของยังไม่อยู่ใน Supabase
    toInsert.push(_rowToReq(rows[i]));
  }

  if (toInsert.length === 0) {
    Logger.log('ไม่มีแถวใหม่' + (skippedNoUser ? ' (ข้าม ' + skippedNoUser + ' แถว: เจ้าของยังไม่มีใน Supabase)' : ''));
    return 0;
  }

  var res = UrlFetchApp.fetch(supa.url + '/rest/v1/requests', {
    method: 'post', contentType: 'application/json',
    headers: { apikey: supa.key, Authorization: 'Bearer ' + supa.key, Prefer: 'return=minimal' },
    payload: JSON.stringify(toInsert), muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  var ok = code >= 200 && code < 300;
  Logger.log((ok ? '✅ เพิ่ม ' : '❌ ล้มเหลว ') + toInsert.length + ' แถว | HTTP ' + code +
    (ok ? '' : ' ' + res.getContentText().slice(0, 200)) +
    (skippedNoUser ? ' | ข้าม(ไม่มีเจ้าของ) ' + skippedNoUser : ''));
  return ok ? toInsert.length : 0;
}

// ── จัดการ trigger ───────────────────────────────────────────────────────────
function installSyncTrigger() {
  removeSyncTrigger();
  ScriptApp.newTrigger('syncNewRequestsToSupabase').timeBased().everyMinutes(5).create();
  Logger.log('✅ ติดตั้ง trigger: sync ทุก 5 นาทีแล้ว');
}
function removeSyncTrigger() {
  var ts = ScriptApp.getProjectTriggers();
  for (var i = 0; i < ts.length; i++) {
    if (ts[i].getHandlerFunction() === 'syncNewRequestsToSupabase') ScriptApp.deleteTrigger(ts[i]);
  }
}
