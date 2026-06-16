"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { fineract, formatError } from "@/lib/fineract";

type SavingsAccount = {
  id: number;
  accountNo: string;
  clientId?: number;
  clientName?: string;
  productName?: string;
  status?: { value?: string };
  accountBalance?: number;
  currency?: { code?: string };
};

type SavingsResponse = { pageItems?: SavingsAccount[] } | SavingsAccount[];

export default function SavingsAccountsPage() {
  const [accounts, setAccounts] = useState<SavingsAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fineract<SavingsResponse>({
          method: "GET",
          path: "/savingsaccounts?limit=200",
        });
        const list = Array.isArray(data) ? data : data.pageItems ?? [];
        if (!cancelled) setAccounts(list);
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

  return (
    <AppShell>
      <header className="page-head">
        <div>
          <div className="page-eyebrow">Deposits</div>
          <h1 className="page-title">Savings accounts</h1>
          <p className="page-sub">
            Individual deposit accounts. Each is an instance of a savings product, opened for one client.
          </p>
        </div>
        <Link href="/savings-accounts/new" className="btn btn-primary" style={{ textDecoration: "none" }}>
          New account
        </Link>
      </header>

      {error && (
        <div className="alert alert-bad">
          <div className="alert-label">Could not load</div>
          <div>{error}</div>
        </div>
      )}

      <div className="table-card">
        <div className="table-head">
          <span>{accounts?.length ?? "—"} accounts</span>
          <span>GET /savingsaccounts</span>
        </div>
        {accounts === null ? (
          <div className="empty-state">
            <div className="empty-state-eyebrow">Loading</div>
          </div>
        ) : accounts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-eyebrow">No accounts yet</div>
            <p style={{ marginBottom: 16 }}>Open the first savings account for a client.</p>
            <Link href="/savings-accounts/new" className="btn btn-primary" style={{ textDecoration: "none" }}>
              Open an account
            </Link>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 60 }}>ID</th>
                <th>Account #</th>
                <th>Client</th>
                <th>Product</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td className="mono">{a.id}</td>
                  <td className="mono">
                    <Link href={`/savings-accounts/${a.id}`}>{a.accountNo}</Link>
                  </td>
                  <td>
                    {a.clientId
                      ? <Link href={`/clients/${a.clientId}`}>{a.clientName}</Link>
                      : (a.clientName ?? "—")}
                  </td>
                  <td>{a.productName ?? "—"}</td>
                  <td className="mono" style={{ color: "var(--ink-soft)" }}>{a.status?.value ?? "—"}</td>
                  <td className="mono" style={{ textAlign: "right", fontWeight: 500 }}>
                    {a.accountBalance?.toLocaleString() ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
