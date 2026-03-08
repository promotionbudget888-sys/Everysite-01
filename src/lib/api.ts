import { getSavedProfile, getToken } from '@/lib/auth';

// ต้องตรงกับ CONFIG.SECRET_TOKEN ใน GAS
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

// ─── Supabase Proxy ───────────────────────────────────────────────────────────

function getProxyUrl(): string {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!baseUrl) console.error("❌ VITE_SUPABASE_URL ยังไม่ได้ตั้งค่าใน .env");
  return baseUrl ? `${baseUrl}/functions/v1/google-script-proxy` : "";
}

function proxyHeaders(): Record<string, string> {
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const token = getToken() || "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (publishableKey) {
    headers["apikey"] = publishableKey;
    headers["Authorization"] = `Bearer ${publishableKey}`;
  }
  if (token) {
    headers["x-app-token"] = token;
  }
  return headers;
}

async function callProxy<T = any>(
  method: "GET" | "POST",
  payload: Record<string, any>
): Promise<ApiResponse<T>> {
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) {
    return { success: false, error: "ระบบยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแลระบบ" };
  }

  // ✅ inject _token ทุก request เพื่อผ่าน GAS auth check
  const payloadWithToken = { ...payload, _token: SECRET_TOKEN };

  try {
    const res = await fetch(proxyUrl, {
      method: "POST",
      headers: proxyHeaders(),
      body: JSON.stringify({ method, payload: payloadWithToken }),
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }

    const json = await res.json();

    if (!json?.success) {
      return { success: false, error: json?.error || "Proxy request failed" };
    }

    // unwrap: proxy { success, data: GAS { success, data } }
    const inner = json.data;
    if (inner && typeof inner === "object" && "success" in inner) {
      if (!inner.success) {
        return { success: false, error: inner.error || "GAS request failed" };
      }
      return { success: true, data: inner.data as T };
    }

    return { success: true, data: inner as T };
  } catch (err) {
    console.error("Proxy error:", err);
    return { success: false, error: String(err) };
  }
}

// ─── Audit Log (fire-and-forget) ─────────────────────────────────────────────

function sendAuditLogIfNeeded(mode: string, body: Record<string, any>) {
  if (!shouldLogAudit(mode)) return;
  const payload = buildAuditPayload(mode, body);
  callProxy("POST", payload).catch((err) =>
    console.warn("Audit log failed:", err)
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function apiGet<T = any>(
  params: Record<string, string>
): Promise<ApiResponse<T>> {
  return callProxy<T>("GET", params);
}

export async function apiPost<T = any>(
  body: Record<string, any>
): Promise<ApiResponse<T>> {
  const mode = getRequestMode(body);
  const result = await callProxy<T>("POST", body);

  if (result.success) {
    sendAuditLogIfNeeded(mode, body);
  }

  return result;
}