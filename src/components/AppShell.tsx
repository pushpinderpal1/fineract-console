"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearSession, getSession } from "@/lib/fineract";

type HealthState = "UP" | "DOWN" | "UNREACHABLE" | "CHECKING" | "UNKNOWN";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [username, setUsername] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthState>("CHECKING");

  useEffect(() => {
    const s = getSession();
    if (!s?.authenticated) {
      router.replace("/login");
      return;
    }
    setUsername(s.username);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      try {
        const r = await fetch("/api/health", { cache: "no-store" });
        const d = await r.json();
        if (!cancelled) setHealth(d.status === "UP" ? "UP" : (d.status as HealthState));
      } catch {
        if (!cancelled) setHealth("UNREACHABLE");
      }
    };
    ping();
    const t = setInterval(ping, 20_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  function signOut() {
    clearSession();
    router.replace("/login");
  }

  const navProducts = [
    { label: "Loan products", href: "/loan-products" },
    { label: "Create product", href: "/loan-products/new" },
  ];
  const navTools = [
    { label: "Repayment simulator", href: "/simulator" },
  ];

  const breadcrumb = pathname.split("/").filter(Boolean);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-dot" />
          Fineract Console
        </div>

        <nav className="nav">
          <div className="nav-section">Loan products</div>
          {navProducts.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={pathname === n.href ? "active" : ""}
            >
              {n.label}
            </Link>
          ))}
          <div className="nav-section">Tools</div>
          {navTools.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={pathname === n.href ? "active" : ""}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="status-card">
          <div className="status-label">Backend</div>
          <div className="status-line">
            <span className={`status-pip ${pipClass(health)}`} />
            <span>{health}</span>
          </div>
          <div className="status-label" style={{ marginTop: 12 }}>Signed in</div>
          <div className="status-line">{username ?? "—"}</div>
          <button
            onClick={signOut}
            style={{
              marginTop: 16,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "rgba(250,250,247,0.8)",
              fontFamily: "var(--font-display)",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <span>Sandbox</span>
            {breadcrumb.map((p, i) => (
              <span key={i} style={{ display: "flex", gap: 12 }}>
                <span className="sep">/</span>
                <span>{p}</span>
              </span>
            ))}
          </div>
          <div>Tenant: default</div>
        </header>
        <section className="page">{children}</section>
      </main>
    </div>
  );
}

function pipClass(s: HealthState): string {
  if (s === "UP") return "up";
  if (s === "DOWN" || s === "UNREACHABLE") return "down";
  return "unknown";
}
