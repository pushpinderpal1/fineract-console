import { NextResponse } from "next/server";

const FINERACT_BASE =
  process.env.FINERACT_BASE_URL ??
  "https://fineract-railway-production.up.railway.app/fineract-provider/api/v1";

// Derive the actuator URL from the API base — strip "/api/v1" and add "/actuator/health".
function actuatorUrl(): string {
  const base = FINERACT_BASE.replace(/\/api\/v\d+\/?$/, "");
  return base + "/actuator/health";
}

export async function GET() {
  try {
    const res = await fetch(actuatorUrl(), { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ status: "DOWN", code: res.status });
    }
    const data = await res.json();
    return NextResponse.json({ status: data?.status ?? "UNKNOWN" });
  } catch (e) {
    return NextResponse.json(
      { status: "UNREACHABLE", message: e instanceof Error ? e.message : String(e) },
      { status: 200 },
    );
  }
}
