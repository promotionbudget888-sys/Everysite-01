// ============================================================================
// db.ts — Data layer บน Supabase (แทน apiPost → Google Apps Script)
// คืนค่าเป็น ApiResponse { success, data, error } และ "shape" ของ row ตรงกับที่
// GAS เคยคืน (คอลัมน์ Supabase ตั้งชื่อตรงกัน) เพื่อให้หน้าเดิมแก้น้อยที่สุด
//
// LINE ยังยิงผ่าน GAS (notify_line) ชั่วคราว — การ mirror กลับ Google Sheet เป็น
// Phase 4
// ============================================================================
import { supabase } from '@/integrations/supabase/client';
import { apiPost } from '@/lib/api';
import type { UserProfile } from '@/lib/auth';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

const ok = <T>(data: T): ApiResponse<T> => ({ success: true, data });
const fail = (e: unknown): ApiResponse<any> => ({
  success: false,
  error: e instanceof Error ? e.message : String(e),
});

// ── actor ปัจจุบัน (ตั้งโดย AuthContext) สำหรับ audit log ────────────────────
let currentActor: { id: string; name: string; role: string } | null = null;
export function setCurrentActor(p: UserProfile | null) {
  currentActor = p ? { id: p.id, name: p.full_name || 'ผู้ใช้', role: p.role } : null;
}

// ── Audit log (best-effort) ─────────────────────────────────────────────────
async function logAudit(entry: {
  action: string;
  target_type?: string;
  target_id?: string | null;
  detail?: string;
}) {
  try {
    await supabase.from('audit_logs').insert({
      actor_id: currentActor?.id ?? null,
      actor_name: currentActor?.name ?? 'System',
      actor_role: currentActor?.role ?? 'system',
      action: entry.action,
      target_type: entry.target_type ?? 'system',
      target_id: entry.target_id ?? null,
      detail: entry.detail ?? null,
    });
  } catch (e) {
    console.warn('logAudit failed:', e);
  }
}

// ── LINE (ผ่าน GAS, best-effort) ────────────────────────────────────────────
function notifyLine(payload: Record<string, unknown>) {
  apiPost({ mode: 'notify_line', ...payload }).catch((e) =>
    console.warn('notifyLine failed:', e)
  );
}

// ── Phase 4: mirror กลับ Google Sheet (ผ่าน GAS, best-effort) ────────────────
// เขียน Supabase สำเร็จก่อน แล้วค่อย sync เข้า Sheet (Supabase = ฐานหลัก)
function mirror(payload: Record<string, unknown>) {
  apiPost(payload).catch((e) => console.warn('sheet mirror failed:', e));
}
function mirrorRequest(fields: Record<string, unknown>) {
  mirror({ mode: 'sync_request', ...fields });
}

// ════════════════════════════════════════════════════════════════════════════
// REQUESTS
// ════════════════════════════════════════════════════════════════════════════

export interface ListRequestsOpts {
  requesterId?: string;
  zoneId?: string;
  status?: string; // ระบุ status เดียว (ไม่รวม 'all' / 'history')
}

export async function listRequests(opts: ListRequestsOpts = {}): Promise<ApiResponse<any[]>> {
  try {
    let q = supabase.from('requests').select('*').order('created_at', { ascending: false });
    if (opts.requesterId) q = q.eq('requester_id', opts.requesterId);
    if (opts.zoneId) q = q.eq('zone_id', opts.zoneId);
    if (opts.status && opts.status !== 'all' && opts.status !== 'history') {
      q = q.eq('status', opts.status);
    }
    const { data, error } = await q;
    if (error) throw error;
    return ok(data ?? []);
  } catch (e) {
    return fail(e);
  }
}

// คำขอที่รอการดำเนินการ ตาม role (แทน GAS handlePendingRequests)
export async function pendingRequests(opts: {
  role?: string;
  zoneId?: string | null;
  status?: string;
}): Promise<ApiResponse<any[]>> {
  try {
    let statuses: string[];
    if (opts.status) statuses = [opts.status];
    else if (opts.role === 'admin') statuses = ['submitted', 'admin_finalize'];
    else if (opts.role === 'zone_approver_1') statuses = ['zone_review_1'];
    else if (opts.role === 'zone_approver_2') statuses = ['zone_review_2'];
    else statuses = ['submitted'];

    let q = supabase.from('requests').select('*').in('status', statuses)
      .order('created_at', { ascending: false });
    // requester ธรรมดาที่ดู submitted → กรองตามโซนตัวเอง (เหมือน GAS)
    if (!opts.status && !['admin', 'zone_approver_1', 'zone_approver_2'].includes(opts.role || '') && opts.zoneId) {
      q = q.eq('zone_id', opts.zoneId);
    }
    const { data, error } = await q;
    if (error) throw error;
    return ok(data ?? []);
  } catch (e) {
    return fail(e);
  }
}

export async function getRequest(id: string): Promise<ApiResponse<any>> {
  try {
    const { data, error } = await supabase.from('requests').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return { success: false, error: 'ไม่พบคำขอ' };
    return ok(data);
  } catch (e) {
    return fail(e);
  }
}

export async function createRequest(payload: {
  requester_id: string;
  zone_id?: string | null;
  title: string;
  description?: string | null;
  amount: number;
  request_type?: string | null;
  size?: string | null;
  size_code?: string | null;
  requester_name?: string | null;
  requester_email?: string | null;
  department?: string | null;
  branch?: string | null;
  affiliation?: string | null;
  status?: string;
}): Promise<ApiResponse<{ id: string }>> {
  try {
    const row = { status: 'submitted', ...payload };
    const { data, error } = await supabase.from('requests').insert(row).select('id').single();
    if (error) throw error;
    await logAudit({ action: 'create', target_type: 'request', target_id: data.id, detail: payload.title });
    mirrorRequest({ request_id: data.id, created_at: new Date().toISOString(), ...payload });
    return ok({ id: data.id });
  } catch (e) {
    return fail(e);
  }
}

export async function updateRequest(id: string, updates: Record<string, unknown>): Promise<ApiResponse> {
  try {
    const { error } = await supabase.from('requests').update(updates).eq('id', id);
    if (error) throw error;
    await logAudit({ action: 'update', target_type: 'request', target_id: id });
    mirrorRequest({ request_id: id, ...updates });
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRequest(id: string): Promise<ApiResponse> {
  try {
    const { error } = await supabase.from('requests').delete().eq('id', id);
    if (error) throw error;
    await logAudit({ action: 'delete', target_type: 'request', target_id: id });
    mirror({ mode: 'delete', id }); // ลบแถวใน Sheet ด้วย
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

// เปลี่ยนสถานะ + จดบันทึก + timestamp + หักงบเมื่อ paid (แทน GAS handleUpdateStatus)
export async function updateStatus(payload: {
  id: string;
  status: string;
  notes?: string;
  rejected_reason?: string;
  approver_name?: string;
  used_amount?: number;
  requester_id?: string;
  request_type?: string;
  // สำหรับ LINE card
  title?: string;
  amount?: number | string;
  requester_name?: string;
  zone_id?: string;
}): Promise<ApiResponse> {
  try {
    const status = payload.status;
    const now = new Date().toISOString();
    const upd: Record<string, unknown> = { status };

    if (payload.notes) {
      if (status === 'zone_review_1') upd.admin_notes = payload.notes;
      else if (status === 'zone_review_2') upd.zone_approver_notes = payload.notes;
      else if (status === 'admin_finalize') {
        const { data: cur } = await supabase.from('requests').select('zone_approver_notes').eq('id', payload.id).maybeSingle();
        const ex = cur?.zone_approver_notes || '';
        upd.zone_approver_notes = ex ? `${ex}\n[L2] ${payload.notes}` : payload.notes;
      } else if (['approved', 'competing', 'paid', 'returned'].includes(status)) {
        upd.final_notes = payload.notes;
      }
    }
    if (payload.rejected_reason) upd.rejected_reason = payload.rejected_reason;

    if (status === 'zone_review_1') upd.admin_at = now;
    else if (status === 'zone_review_2') upd.zone1_at = now;
    else if (status === 'admin_finalize') upd.zone2_at = now;
    else if (['approved', 'competing', 'paid'].includes(status)) upd.final_at = now;

    const { error } = await supabase.from('requests').update(upd).eq('id', payload.id);
    if (error) throw error;

    // หักงบที่ใช้จริงเมื่อจ่ายแล้ว
    if (status === 'paid' && payload.used_amount && payload.requester_id) {
      await addUsedAmount(payload.requester_id, payload.request_type, Number(payload.used_amount));
    }

    await logAudit({
      action: status === 'reject' ? 'reject' : 'update_status',
      target_type: 'request',
      target_id: payload.id,
      detail: `status=${status}`,
    });

    // mirror สถานะ + note + timestamp เข้า Sheet
    mirrorRequest({ request_id: payload.id, ...upd });

    // LINE (ผ่าน GAS)
    notifyLine({
      type: 'status_update',
      title: payload.title,
      amount: payload.amount,
      requester_name: payload.requester_name,
      zone_id: payload.zone_id,
      status,
      approver: payload.approver_name,
      notes: payload.notes || '',
    });

    return ok({ id: payload.id, status });
  } catch (e) {
    return fail(e);
  }
}

export async function rejectRequest(payload: {
  id: string;
  rejected_reason?: string;
  notes?: string;
  approver_name?: string;
  title?: string;
  amount?: number | string;
  requester_name?: string;
  zone_id?: string;
}): Promise<ApiResponse> {
  try {
    const reason = payload.rejected_reason || payload.notes || null;
    const { error } = await supabase.from('requests')
      .update({ status: 'rejected', rejected_reason: reason }).eq('id', payload.id);
    if (error) throw error;
    await logAudit({ action: 'reject', target_type: 'request', target_id: payload.id });
    mirrorRequest({ request_id: payload.id, status: 'rejected', rejected_reason: reason });
    notifyLine({
      type: 'status_update', status: 'rejected',
      title: payload.title, amount: payload.amount,
      requester_name: payload.requester_name, zone_id: payload.zone_id,
      approver: payload.approver_name, notes: reason || '',
    });
    return ok({ id: payload.id });
  } catch (e) {
    return fail(e);
  }
}

async function addUsedAmount(profileId: string, requestType: string | undefined, amount: number) {
  const isMF = String(requestType || '').toLowerCase().includes('matching');
  const col = isMF ? 'used_matching_fund' : 'used_everysite';
  const { data } = await supabase.from('profiles').select(col).eq('id', profileId).maybeSingle();
  const current = Number((data as Record<string, unknown>)?.[col] ?? 0);
  await supabase.from('profiles').update({ [col]: current + amount }).eq('id', profileId);
}

// ════════════════════════════════════════════════════════════════════════════
// ATTACHMENTS
// ════════════════════════════════════════════════════════════════════════════

export async function listAttachments(requestId: string): Promise<ApiResponse<any[]>> {
  try {
    const { data, error } = await supabase.from('request_attachments')
      .select('*').eq('request_id', requestId).order('created_at', { ascending: true });
    if (error) throw error;
    return ok(data ?? []);
  } catch (e) {
    return fail(e);
  }
}

// เก็บ "ลิงก์ไฟล์" (ไฟล์จริงอยู่บน Google Drive) ลง Supabase — Phase 3
export async function addAttachment(att: {
  request_id: string;
  file_name: string;
  file_url: string;
  file_type?: string | null;
  file_size?: number | null;
}): Promise<ApiResponse> {
  try {
    const { error } = await supabase.from('request_attachments').insert(att);
    if (error) throw error;
    return ok({});
  } catch (e) {
    return fail(e);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// USERS (profiles)
// ════════════════════════════════════════════════════════════════════════════

export async function listUsers(): Promise<ApiResponse<any[]>> {
  try {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return ok(data ?? []);
  } catch (e) {
    return fail(e);
  }
}

export async function updateUser(id: string, updates: Record<string, unknown>): Promise<ApiResponse> {
  try {
    const { error } = await supabase.from('profiles').update(updates).eq('id', id);
    if (error) throw error;
    await logAudit({ action: 'update_user', target_type: 'user', target_id: id });
    mirror({ mode: 'update_user', id, ...updates }); // sync Sheet
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

export async function setUserStatus(id: string, status: 'approved' | 'rejected' | 'pending'): Promise<ApiResponse> {
  try {
    const { error } = await supabase.from('profiles').update({ status }).eq('id', id);
    if (error) throw error;
    await logAudit({ action: status === 'approved' ? 'user_approved' : 'user_rejected', target_type: 'user', target_id: id });
    // sync Sheet + ส่ง LINE แจ้งผลอนุมัติบัญชี (GAS update_user จัดการให้)
    mirror({ mode: 'update_user', id, status, approver_name: currentActor?.name || 'ผู้ดูแลระบบ' });
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// ZONES
// ════════════════════════════════════════════════════════════════════════════

export async function listZones(): Promise<ApiResponse<any[]>> {
  try {
    const { data, error } = await supabase.from('zones_public')
      .select('id, name, sort_order').order('sort_order', { ascending: true });
    if (error) throw error;
    return ok(data ?? []);
  } catch (e) {
    return fail(e);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// AUDIT LOGS
// ════════════════════════════════════════════════════════════════════════════

export async function listAuditLogs(limit = 1000): Promise<ApiResponse<any[]>> {
  try {
    const { data, error } = await supabase.from('audit_logs')
      .select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return ok(data ?? []);
  } catch (e) {
    return fail(e);
  }
}
