// ============================================================================
// GAS PATCH — Phase 4: ให้ Google Sheet เป็น "mirror" ของ Supabase
//
// วิธีใช้: เปิด Apps Script editor ของโปรเจกต์เดิม แล้ว
//   1) วางฟังก์ชัน handleSyncRequest ด้านล่างนี้ต่อท้ายไฟล์
//   2) เพิ่ม 1 บรรทัดใน switch(action) ของ doPost:
//         case "sync_request": return handleSyncRequest(data);
//   3) (แนะนำ) แก้ getOrCreateFolder ให้แชร์โฟลเดอร์ด้วย — กันบั๊กโฟลเดอร์เด้ง
//      สำหรับ "ไฟล์เก่า" ที่ยังเปิดผ่านลิงก์โฟลเดอร์ (ดูท้ายไฟล์)
//   4) Deploy เวอร์ชันใหม่ (Manage deployments → Edit → New version)
//
// หลักการ: แอปเขียน Supabase ก่อน (ฐานหลัก) แล้วยิง sync_request มา upsert แถวใน
// Sheet ตาม request_id — อัปเดตเฉพาะคอลัมน์ที่ส่งมา (ไม่ส่ง LINE ซ้ำ เพราะแอปส่งเอง)
// request_id ตรงกับ Supabase id อยู่แล้ว (ตอน import ใช้ id เดียวกัน)
// ============================================================================

function handleSyncRequest(data) {
  requireFields(data, ["request_id"]);
  var sheet = getRequestsSheet();
  if (!sheet) throw new Error("Requests sheet not found");

  // แผนที่ index คอลัมน์ (0-based) -> key ที่ส่งมาจากแอป
  var colMap = {
    2:  "title",           3:  "description",     4:  "request_type",
    5:  "size",            6:  "size_code",       7:  "amount",
    8:  "requester_name",  9:  "requester_email", 10: "department",
    11: "branch",          12: "affiliation",     13: "status",
    14: "zone_id",         15: "requester_id",    16: "admin_notes",
    17: "zone_approver_notes", 18: "final_notes", 19: "rejected_reason",
    20: "admin_at",        21: "zone1_at",        22: "zone2_at",
    23: "final_at"
  };

  var rows = sheet.getDataRange().getValues();
  var rowIdx = -1;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === String(data.request_id)) { rowIdx = i; break; }
  }

  if (rowIdx === -1) {
    // ยังไม่มีแถวนี้ → append ใหม่ (24 คอลัมน์)
    var row = [];
    for (var c = 0; c < 24; c++) row.push("");
    row[0] = data.created_at || new Date().toISOString();
    row[1] = data.request_id;
    for (var k in colMap) {
      var key = colMap[k];
      if (data[key] !== undefined && data[key] !== null) row[Number(k)] = data[key];
    }
    sheet.appendRow(row);
  } else {
    // มีแล้ว → อัปเดตเฉพาะคอลัมน์ที่ส่งมา
    var r = rowIdx + 1;
    for (var k2 in colMap) {
      var key2 = colMap[k2];
      if (data[key2] !== undefined && data[key2] !== null) {
        sheet.getRange(r, Number(k2) + 1).setValue(data[key2]);
      }
    }
  }
  return respond(true, { synced: true, request_id: data.request_id });
}

// ── (แนะนำ) แก้บั๊กโฟลเดอร์เด้ง สำหรับไฟล์เก่า ────────────────────────────────
// แทนที่ getOrCreateFolder เดิมด้วยตัวนี้ เพื่อแชร์ "โฟลเดอร์" ให้เปิดได้เหมือนไฟล์
//
// function getOrCreateFolder(parent, name) {
//   var f = parent.getFoldersByName(name);
//   var folder = f.hasNext() ? f.next() : parent.createFolder(name);
//   folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
//   return folder;
// }
