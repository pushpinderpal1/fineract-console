"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { fineract, formatError } from "@/lib/fineract";
import { fmtFineractArray } from "@/lib/dates";

type ClientDetail = {
  id: number;
  accountNo?: string;
  displayName?: string;
  firstname?: string;
  lastname?: string;
  externalId?: string;
  mobileNo?: string;
  officeId?: number;
  officeName?: string;
  status?: { value?: string };
  activationDate?: number[];
  submittedOnDate?: number[];
};

type LoanRow = {
  id: number;
  accountNo: string;
  status?: { value?: string };
  loanProductName?: string;
  principal?: number;
  loanBalance?: number;
};

type ClientAccounts = {
  loanAccounts?: LoanRow[];
};

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [accounts, setAccounts] = useState<ClientAccounts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const [c, a] = await Promise.all([
          fineract<ClientDetail>({ method: "GET", path: `/clients/${id}` }),
          fineract<ClientAccounts>({ method: "GET", path: `/clients/${id}/accounts` }),
        ]);
        if (!cancelled) {
          setClient(c);
          setAccounts(a);
        }
      } catch (e) {
        if (!cancelled) {
          const f = formatError(e);
          setError(`${f.title} — ${f.detail}`);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  return (
    <AppShell>
      <header className="page-head">
        <div>
          <div className="page-eyebrow">
            <Link href="/clients">Clients</Link> · {client?.accountNo ?? id}
          </div>
          <h1 className="page-title">{client?.displayName ?? "Loading…"}</h1>
          <p className="page-sub">{client?.officeName} · {client?.status?.value ?? "—"}</p>
        </div>
        <Link href={`/loans/new?clientId=${id}`} className="btn btn-primary" style={{ textDecoration: "none" }}>
          New loan for this client
        </Link>
      </header>

      {error && (
        <div className="alert alert-bad">
          <div className="alert-label">Could not load</div>
          <div>{error}</div>
        </div>
      )}

      {client && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 1,
          background: "var(--rule)",
          border: "1px solid var(--rule)",
          marginBottom: 24,
        }}>
          <Stat label="Client ID" value={String(client.id)} />
          <Stat label="Account #" value={client.accountNo ?? "—"} />
          <Stat label="External ID" value={client.externalId ?? "—"} />
          <Stat label="Mobile" value={client.mobileNo ?? "—"} />
          <Stat label="Activated" value={fmtFineractArray(client.activationDate)} />
          <Stat label="Submitted" value={fmtFineractArray(client.submittedOnDate)} />
        </div>
      )}

      <div className="table-card">
        <div className="table-head">
          <span>Loans</span>
          <span>{accounts?.loanAccounts?.length ?? 0} accounts</span>
        </div>
        {!accounts ? (
          <div className="empty-state">
            <div className="empty-state-eyebrow">Loading</div>
          </div>
        ) : !accounts.loanAccounts || accounts.loanAccounts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-eyebrow">No loans yet</div>
            <p style={{ marginBottom: 16 }}>Originate a loan against any of your products.</p>
            <Link href={`/loans/new?clientId=${id}`} className="btn btn-primary" style={{ textDecoration: "none" }}>
              Create a loan
            </Link>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 60 }}>ID</th>
                <th>Account #</th>
                <th>Product</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Principal</th>
                <th style={{ textAlign: "right" }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {accounts.loanAccounts.map((l) => (
                <tr key={l.id}>
                  <td className="mono">{l.id}</td>
                  <td className="mono">{l.accountNo}</td>
                  <td>
                    <Link href={`/loans/${l.id}`}>{l.loanProductName}</Link>
                  </td>
                  <td className="mono" style={{ color: "var(--ink-soft)" }}>
                    {l.status?.value ?? "—"}
                  </td>
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

function Stat(p: { label: string; value: string }) {
  return (
    <div style={{ background: "white", padding: "14px 16px" }}>
      <div style={{
        fontFamily: "var(--font-display)",
        fontSize: 10,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--ink-faint)",
        marginBottom: 4,
      }}>
        {p.label}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--ink)" }}>
        {p.value}
      </div>
    </div>
  );
}
