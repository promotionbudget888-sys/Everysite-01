// ============================================================================
// backfill_attachments.gs — เติม "ลิงก์ไฟล์เดิม" ของคำขอเก่า (222 รายการ) เข้า
// ตาราง request_attachments ใน Supabase  (รันใน Apps Script editor ครั้งเดียว)
//
// เตรียมก่อนรัน: ตั้งค่า 2 ตัวใน  Project Settings → Script properties
//     SUPABASE_URL          = https://rxbyxwxrzqldgkwinqmb.supabase.co
//     SUPABASE_SERVICE_KEY  = <service_role key ของ Supabase>
// (เก็บใน Script properties เพื่อไม่ให้ key อยู่ในโค้ด)
//
// วิธีรัน: เลือกฟังก์ชัน backfillAttachments แล้วกด Run → ดูผลใน Execution log
// idempotent: ก่อนใส่ไฟล์ของแต่ละคำขอ จะลบของเดิมใน Supabase ก่อน (รันซ้ำได้ปลอดภัย)
// ============================================================================

function backfillAttachments() {
  var props = PropertiesService.getScriptProperties();
  var SUPA_URL = props.getProperty('SUPABASE_URL');
  var SUPA_KEY = props.getProperty('SUPABASE_SERVICE_KEY');
  if (!SUPA_URL || !SUPA_KEY) {
    Logger.log('❌ ตั้งค่า SUPABASE_URL และ SUPABASE_SERVICE_KEY ใน Script properties ก่อน');
    return;
  }
  SUPA_URL = SUPA_URL.replace(/\/+$/, '');

  // 1) map: 8 ตัวแรกของ request_id -> request_id เต็ม (จาก Requests sheet)
  var rSheet = getRequestsSheet();
  if (!rSheet) { Logger.log('❌ ไม่พบ Requests sheet'); return; }
  var rows = rSheet.getDataRange().getValues();
  var shortToFull = {};
  for (var i = 1; i < rows.length; i++) {
    var id = String(rows[i][1] || '').trim();
    if (id) shortToFull[id.substring(0, 8)] = id;
  }

  // 2) เดินทุกโฟลเดอร์ zone -> Request-XXXXXXXX -> ไฟล์ → รวมตาม request_id
  var root = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  var byRequest = {}; // request_id -> [ {file_name,file_url,file_type,file_size} ]
  var zoneFolders = root.getFolders();
  while (zoneFolders.hasNext()) {
    var reqFolders = zoneFolders.next().getFolders();
    while (reqFolders.hasNext()) {
      var rf = reqFolders.next();
      var m = rf.getName().match(/^Request-([0-9a-fA-F]{8})$/);
      if (!m) continue;
      var full = shortToFull[m[1]];
      if (!full) continue;
      var files = rf.getFiles();
      while (files.hasNext()) {
        var f = files.next();
        try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
        if (!byRequest[full]) byRequest[full] = [];
        byRequest[full].push({
          request_id: full,
          file_name:  f.getName(),
          file_url:   f.getUrl(),
          file_type:  f.getMimeType(),
          file_size:  f.getSize(),
        });
      }
    }
  }

  // 3) ส่งเข้า Supabase (ลบของเดิมของ request นั้นก่อน แล้ว insert)
  var reqIds = Object.keys(byRequest);
  Logger.log('พบไฟล์ของ ' + reqIds.length + ' คำขอ');
  var headers = { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY };
  var totalFiles = 0, okReq = 0, failReq = 0;

  for (var j = 0; j < reqIds.length; j++) {
    var rid = reqIds[j];
    var items = byRequest[rid];

    // ลบของเดิม (กันซ้ำตอนรันซ้ำ)
    UrlFetchApp.fetch(SUPA_URL + '/rest/v1/request_attachments?request_id=eq.' + encodeURIComponent(rid), {
      method: 'delete',
      headers: headers,
      muteHttpExceptions: true,
    });

    // insert ใหม่
    var res = UrlFetchApp.fetch(SUPA_URL + '/rest/v1/request_attachments', {
      method: 'post',
      contentType: 'application/json',
      headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY, Prefer: 'return=minimal' },
      payload: JSON.stringify(items),
      muteHttpExceptions: true,
    });
    var code = res.getResponseCode();
    if (code >= 200 && code < 300) { okReq++; totalFiles += items.length; }
    else { failReq++; Logger.log('❌ ' + rid + ' HTTP ' + code + ' ' + res.getContentText().substring(0, 150)); }
  }

  Logger.log('================================================');
  Logger.log('✅ คำขอสำเร็จ: ' + okReq + ' | ไฟล์ทั้งหมด: ' + totalFiles + ' | ล้มเหลว: ' + failReq);
  Logger.log('================================================');
}
