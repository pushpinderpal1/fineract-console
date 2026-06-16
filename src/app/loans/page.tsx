"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { fineract, formatError } from "@/lib/fineract";

type Loan = {
  id: number;
  accountNo: string;
  clientId?: number;
  clientName?: string;
  loanProductName?: string;
  status?: { value?: string; code?: string };
  principal?: number;
  loanBalance?: number;
};

type LoansResponse = { pageItems?: Loan[] } | Loan[];

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fineract<LoansResponse>({
          method: "GET",
          path: "/loans?limit=200",
        });
        const list = Array.isArray(data) ? data : data.pageItems ?? [];
        if (!cancelled) setLoans(list);
      } catch (e) {
        if (!cancelled) {
          const f = formatError(e);
          setError(`${f.title} — ${f.detail}`);
          setLoans([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <AppShell>
      <header className="page-head">
        <div>
          <div className="page-eyebrow">Lending</div>
          <h1 className="page-title">Loans</h1>
          <p className="page-sub">
            Individual loan accounts. Each loan is an instance of a product, originated for one client.
          </p>
        </div>
        <Link href="/loans/new" className="btn btn-primary" style={{ textDecoration: "none" }}>
          New loan
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
          <span>{loans?.length ?? "—"} loans</span>
          <span>GET /loans</span>
        </div>
        {loans === null ? (
          <div className="empty-state">
            <div className="empty-state-eyebrow">Loading</div>
            Fetching from Fineract…
          </div>
        ) : loans.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-eyebrow">No loans yet</div>
            <p style={{ marginBottom: 16 }}>Originate your first loan against an existing client and product.</p>
            <Link href="/loans/new" className="btn btn-primary" style={{ textDecoration: "none" }}>
              Create a loan
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
                <th style={{ textAlign: "right" }}>Principal</th>
                <th style={{ textAlign: "right" }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((l) => (
                <tr key={l.id}>
                  <td className="mono">{l.id}</td>
                  <td className="mono">
                    <Link href={`/loans/${l.id}`}>{l.accountNo}</Link>
                  </td>
                  <td>
                    {l.clientId
                      ? <Link href={`/clients/${l.clientId}`}>{l.clientName}</Link>
                      : (l.clientName ?? "—")}
                  </td>
                  <td>{l.loanProductName ?? "—"}</td>
                  <td className="mono" style={{ color: "var(--ink-soft)" }}>{l.status?.value ?? "—"}</td>
                  <td className="mono" style={{ textAlign: "right" }}>
                    {l.principal?.toLocaleString() ?? "—"}
                  </td>
                  <td className="mono" style={{ textAlign: "right" }}>
                    {l.loanBalance?.toLocaleString() ?? "—"}
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
