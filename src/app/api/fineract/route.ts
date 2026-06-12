import { NextRequest, NextResponse } from "next/server";

// Server-side proxy. Keeps the Fineract URL/tenant in environment variables
// and forwards the auth header + body from the browser.

const FINERACT_BASE =
  process.env.FINERACT_BASE_URL ??
  "https://fineract-railway-production.up.railway.app/fineract-provider/api/v1";

const TENANT = process.env.FINERACT_TENANT ?? "default";

export async function POST(req: NextRequest) {
  let payload: {
    method?: string;
    path?: string;
    body?: unknown;
    auth?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { developerMessage: "Proxy could not parse request." },
      { status: 400 },
    );
  }

  const method = payload.method ?? "GET";
  const path = payload.path ?? "";
  if (!path.startsWith("/")) {
    return NextResponse.json(
      { developerMessage: "Path must start with /" },
      { status: 400 },
    );
  }
  if (!payload.auth) {
    return NextResponse.json(
      { developerMessage: "Missing auth credentials." },
      { status: 401 },
    );
  }

  const url = FINERACT_BASE + path;

  const init: RequestInit = {
    method,
    headers: {
      "Authorization": `Basic ${payload.auth}`,
      "Fineract-Platform-TenantId": TENANT,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
  };
  if (method !== "GET" && method !== "DELETE" && payload.body !== undefined) {
    init.body = JSON.stringify(payload.body);
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch (e) {
    return NextResponse.json(
      {
        developerMessage: "Could not reach Fineract backend.",
        defaultUserMessage: e instanceof Error ? e.message : String(e),
      },
      { status: 502 },
    );
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
  });
}
