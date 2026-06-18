"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { fineract, formatError } from "@/lib/fineract";

type GLAccount = {
  id: number;
  name: string;
  glCode: string;
  type?: { value?: string };           // ASSET, LIABILITY, EQUITY, INCOME, EXPENSE
  usage?: { value?: string };          // DETAIL, HEADER
  manualEntriesAllowed?: boolean;
  disabled?: boolean;
  description?: string;
};

const TYPE_COLORS: Record<string, string> = {
  ASSET: "#2E7D4F",
  LIABILITY: "#B33636",
  EQUITY: "#4A4A48",
  INCOME: "#2E7D4F",
  EXPENSE: "#B33636",
};

export default function GLAccountsPage() {
  const [accounts, setAccounts] = useState<GLAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fineract<GLAccount[]>({
          method: "GET",
          path: "/glaccounts",
        });
        if (!cancelled) setAccounts(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) {
          const f = formatError(e);
          setError(`${f.title} — ${f.detail}`);
          setAccounts([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = accounts?.filter((a) =>
    filter === "ALL" || (a.type?.value ?? "").toUpperCase() === filter
  );

  const counts = accounts ? {
    ASSET: accounts.filter((a) => (a.type?.value ?? "").toUpperCase() === "ASSET").length,
    LIABILITY: accounts.filter((a) => (a.type?.value ?? "").toUpperCase() === "LIABILITY").length,
    EQUITY: accounts.filter((a) => (a.type?.value ?? "").toUpperCase() === "EQUITY").length,
    INCOME: accounts.filter((a) => (a.type?.value ?? "").toUpperCase() === "INCOME").length,
    EXPENSE: accounts.filter((a) => (a.type?.value ?? "").toUpperCase() === "EXPENSE").length,
  } : null;

  return (
    <AppShell>
      <header className="page-head">
        <div>
          <div className="page-eyebrow">Accounting</div>
          <h1 className="page-title">Chart of accounts</h1>
          <p className="page-sub">
            General ledger accounts. Each product's transactions post to these accounts.
            Foundational configuration for financial reporting.
          </p>
        </div>
        <Link href="/gl-accounts/new" className="btn btn-primary" style={{ textDecoration: "none" }}>
          New account
        </Link>
      </header>

      {error && (
        <div className="alert alert-bad">
          <div className="alert-label">Could not load</div>
          <div>{error}</div>
        </div>
      )}

      {counts && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 1,
          background: "var(--rule)",
          border: "1px solid var(--rule)",
          marginBottom: 24,
        }}>
          <CountCard label="Assets" count={counts.ASSET} type="ASSET" />
          <CountCard label="Liabilities" count={counts.LIABILITY} type="LIABILITY" />
          <CountCard label="Equity" count={counts.EQUITY} type="EQUITY" />
          <CountCard label="Income" count={counts.INCOME} type="INCOME" />
          <CountCard label="Expenses" count={counts.EXPENSE} type="EXPENSE" />
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["ALL", "ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilter(t)}
            className={filter === t ? "btn btn-primary" : "btn btn-ghost"}
            style={{ fontSize: 11 }}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="table-card">
        <div className="table-head">
          <span>{filtered?.length ?? "—"} accounts</span>
          <span>GET /glaccounts</span>
        </div>
        {accounts === null ? (
          <div className="empty-state">
            <div className="empty-state-eyebrow">Loading</div>
          </div>
        ) : filtered?.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-eyebrow">
              {filter === "ALL" ? "No GL accounts yet" : `No ${filter} accounts`}
            </div>
            {filter === "ALL" && (
              <>
                <p style={{ marginBottom: 16 }}>
                  Define the chart of accounts before configuring accounting on products.
                </p>
                <Link href="/gl-accounts/new" className="btn btn-primary" style={{ textDecoration: "none" }}>
                  Create first account
                </Link>
              </>
            )}
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 60 }}>ID</th>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Usage</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {filtered?.map((a) => (
                <tr key={a.id}>
                  <td className="mono">{a.id}</td>
                  <td className="mono">{a.glCode}</td>
                  <td>{a.name}</td>
                  <td>
                    <span style={{
                      fontFamily: "var(--font-display)", fontSize: 11,
                      padding: "2px 6px",
                      background: TYPE_COLORS[a.type?.value?.toUpperCase() ?? ""] ?? "var(--ink-faint)",
                      color: "white",
                    }}>
                      {a.type?.value ?? "—"}
                    </span>
                  </td>
                  <td className="mono" style={{ color: "var(--ink-soft)", fontSize: 11 }}>
                    {a.usage?.value ?? "—"}
                  </td>
                  <td style={{ color: "var(--ink-soft)" }}>{a.description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}

function CountCard(p: { label: string; count: number; type: string }) {
  return (
    <div style={{ background: "white", padding: "14px 16px" }}>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: 10,
        letterSpacing: "0.12em", textTransform: "uppercase",
        color: TYPE_COLORS[p.type] ?? "var(--ink-faint)",
        marginBottom: 4,
      }}>
        {p.label}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500 }}>
        {p.count}
      </div>
    </div>
  );
}
