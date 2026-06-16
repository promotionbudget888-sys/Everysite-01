import { getSavedProfile } from '@/lib/auth';

const GAS_URL = "https://script.google.com/macros/s/AKfycbztj1lo4_m8LEa6wIiE7sRdzcuoMf7_0xEaWA8zbbUAT_HhhTRGedlnsp7hXon4qleMkw/exec";
const SECRET_TOKEN = "g7Jd93LsKqV4mX2pYtR8nH1bC6wZ5eT0uQ9aF3kL2sV7dN4pX6cM8rT1yW0zU5h";

const AUDIT_SKIP_MODES = new Set([
  "",
  "login",
  "register",
  "user_registered",
  "users",
  "list_users",
  "zones",
  "list",
  "pending",
  "get",
  "audit_logs",
  "log_audit",
  "notify_line",
  "send_line",
  "upload_file",
  "upload_attachment",
]);

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

function getRequestMode(body: Record<string, any>): string {
  return String(body.mode ?? body.action ?? "").trim();
}

function shouldLogAudit(mode: string): boolean {
  return !AUDIT_SKIP_MODES.has(mode);
}

function inferTargetType(mode: string): string {
  if (mode.includes("user")) return "user";
  if (
    mode.includes("request") ||
    ["create", "update", "delete", "approve", "reject", "update_status", "set_competing", "set_paid"].includes(mode)
  ) {
    return "request";
  }
  return "system";
}

function buildAuditPayload(
  mode: string,
  body: Record<string, any>
): Record<string, any> {
  const profile = getSavedProfile();
  const detailParts: string[] = [];

  if (body.status !== undefined) detailParts.push(`status=${body.status}`);
  if (body.role !== undefined) detailParts.push(`role=${body.role}`);
  if (body.budget_matching_fund !== undefined || body.budget_everysite !== undefined) {
    detailParts.push(
      `budget_mf=${Number(body.budget_matching_fund ?? 0)}, budget_es=${Number(body.budget_everysite ?? 0)}`
    );
  }

  const targetId = body.target_id ?? body.id ?? body.request_id ?? body.user_id ?? null;
  const detailWithAction =
    mode +
    (detailParts.length > 0
      ? ": " + detailParts.join(", ")
      : body.title
      ? ": " + body.title
      : "");

  return {
    mode: "log_audit",
    action: "log_audit",
    _token: SECRET_TOKEN,
    actor_name: profile?.full_name || "System",
    actor_role: profile?.role || "system",
    target_type: inferTargetType(mode),
    target_id: targetId !== null && targetId !== undefined ? String(targetId) : "",
    detail: detailWithAction,
    timestamp: new Date().toISOString(),
  };
}

// ── เรียก GAS โดยตรง (text/plain เพื่อหลีกเลี่ยง CORS preflight) ──────────────

async function callGAS<T = any>(
  payload: Record<string, any>
): Promise<ApiResponse<T>> {
  const body = { ...payload, _token: SECRET_TOKEN };

  try {
    const res = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }

    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      return { success: false, error: "Response is not JSON" };
    }

    if (!json?.success) {
      return { success: false, error: json?.error || "Request failed" };
    }

    return { success: true, data: json.data as T };
  } catch (err) {
    console.error("GAS error:", err);
    return { success: false, error: String(err) };
  }
}

// ── Audit Log (fire-and-forget) ───────────────────────────────────────────────

function sendAuditLogIfNeeded(mode: string, body: Record<string, any>) {
  if (!shouldLogAudit(mode)) return;
  const payload = buildAuditPayload(mode, body);
  callGAS(payload).catch((err) => console.warn("Audit log failed:", err));
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function apiGet<T = any>(
  params: Record<string, string>
): Promise<ApiResponse<T>> {
  return callGAS<T>(params);
}

export async function apiPost<T = any>(
  body: Record<string, any>
): Promise<ApiResponse<T>> {
  const mode = getRequestMode(body);
  const result = await callGAS<T>(body);

  if (result.success) {
    sendAuditLogIfNeeded(mode, body);
  }

  return result;
}
