// Fineract API client.
// Calls go through our own Next.js API route to keep credentials server-side.

export type FineractError = {
  status: number;
  developerMessage?: string;
  defaultUserMessage?: string;
  errors?: Array<{
    parameterName?: string;
    defaultUserMessage?: string;
    developerMessage?: string;
  }>;
  raw?: unknown;
};

const STORAGE_KEY = "fineract.session.v1";

export type Session = {
  username: string;
  base64Encoded: string;     // Base64(username:password) — used for Basic Auth
  authenticated: boolean;
};

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setSession(s: Session) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/**
 * Calls the Fineract API via our proxy.
 * The proxy forwards Auth + Tenant header to Fineract.
 */
export async function fineract<T = unknown>(opts: {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;             // e.g. "/loanproducts"
  body?: unknown;
  session?: Session | null;
}): Promise<T> {
  const session = opts.session ?? getSession();
  if (!session?.base64Encoded) {
    throw { status: 401, defaultUserMessage: "Not authenticated. Sign in first." } as FineractError;
  }

  const res = await fetch("/api/fineract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: opts.method,
      path: opts.path,
      body: opts.body,
      auth: session.base64Encoded,
    }),
  });

  const text = await res.text();
  let parsed: unknown = undefined;
  if (text) {
    try { parsed = JSON.parse(text); } catch { parsed = text; }
  }

  if (!res.ok) {
    const err: FineractError = {
      status: res.status,
      raw: parsed,
    };
    if (parsed && typeof parsed === "object") {
      const p = parsed as Record<string, unknown>;
      err.developerMessage = typeof p.developerMessage === "string" ? p.developerMessage : undefined;
      err.defaultUserMessage = typeof p.defaultUserMessage === "string" ? p.defaultUserMessage : undefined;
      if (Array.isArray(p.errors)) err.errors = p.errors as FineractError["errors"];
    }
    throw err;
  }

  return parsed as T;
}

/** Pretty-print a FineractError for display in alerts. */
export function formatError(e: unknown): { title: string; detail: string; raw?: string } {
  if (!e || typeof e !== "object") {
    return { title: "Unknown error", detail: String(e) };
  }
  const err = e as FineractError;
  const title = err.status ? `HTTP ${err.status}` : "Error";

  if (err.errors && err.errors.length > 0) {
    const lines = err.errors.map((it) => {
      const param = it.parameterName ? `[${it.parameterName}] ` : "";
      return param + (it.developerMessage ?? it.defaultUserMessage ?? "");
    });
    return {
      title,
      detail: lines.join("\n"),
      raw: JSON.stringify(err.raw, null, 2),
    };
  }

  return {
    title,
    detail: err.developerMessage ?? err.defaultUserMessage ?? "Request failed.",
    raw: err.raw ? JSON.stringify(err.raw, null, 2) : undefined,
  };
}
