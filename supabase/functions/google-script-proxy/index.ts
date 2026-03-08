const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-app-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const scriptUrl =
      Deno.env.get("GOOGLE_APPS_SCRIPT_URL") ||
      Deno.env.get("VITE_GOOGLE_SCRIPT_URL") ||
      Deno.env.get("GOOGLE_APPS_SCRIPT_REQUEST_URL");

    if (!scriptUrl) {
      return jsonResponse(
        { success: false, error: "Google Apps Script URL is not configured" },
        500
      );
    }

    const requestJson = await req.json().catch(() => ({}));
    const method = requestJson?.method === "GET" ? "GET" : "POST";
    const payload =
      requestJson && typeof requestJson.payload === "object" && requestJson.payload !== null
        ? requestJson.payload
        : {};

    const appToken = req.headers.get("x-app-token");

    // Inject token into payload body (headers get stripped on GAS redirect)
    const enrichedPayload: Record<string, any> = { ...payload };
    if (appToken) {
      enrichedPayload._token = appToken;
    }

    let upstreamResponse: Response;
    if (method === "GET") {
      const url = new URL(scriptUrl);
      Object.entries(enrichedPayload).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });

      upstreamResponse = await fetch(url.toString(), { method: "GET" });
    } else {
      upstreamResponse = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(enrichedPayload),
      });
    }

    const text = await upstreamResponse.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // keep text response
    }

    const isHtmlResponse =
      (typeof parsed === "string" && parsed.trimStart().startsWith("<!DOCTYPE html")) ||
      (upstreamResponse.headers.get("content-type") || "").includes("text/html");

    if (isHtmlResponse) {
      const runtimeError =
        typeof parsed === "string"
          ? parsed.match(/ReferenceError:[^<]+|TypeError:[^<]+|SyntaxError:[^<]+/)?.[0]
          : undefined;

      return jsonResponse(
        {
          success: false,
          error:
            runtimeError ||
            "Google Apps Script ตอบกลับเป็นหน้า HTML (URL ไม่ถูกต้องหรือสคริปต์มี error) กรุณาใช้ลิงก์ Web App ที่ลงท้าย /exec และ Deploy เวอร์ชันล่าสุด",
        },
        502
      );
    }

    if (!upstreamResponse.ok) {
      const errorMessage =
        typeof parsed === "object" && parsed !== null && "error" in parsed
          ? String((parsed as { error: unknown }).error)
          : `HTTP ${upstreamResponse.status}`;

      return jsonResponse({ success: false, error: errorMessage }, upstreamResponse.status);
    }

    return jsonResponse({ success: true, data: parsed });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown proxy error",
      },
      500
    );
  }
});
