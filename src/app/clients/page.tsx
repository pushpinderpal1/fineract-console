"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { fineract, formatError } from "@/lib/fineract";
import { fmtFineractArray } from "@/lib/dates";

type Client = {
  id: number;
  accountNo: string;
  displayName: string;
  status?: { code?: string; value?: string };
  officeName?: string;
  activationDate?: number[];
};

type ClientsResponse = { pageItems?: Client[] } | Client[];

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fineract<ClientsResponse>({
          method: "GET",
          path: "/clients?limit=200",
        });
        const list = Array.isArray(data) ? data : data.pageItems ?? [];
        if (!cancelled) setClients(list);
      } catch (e) {
        if (!cancelled) {
          const f = formatError(e);
          setError(`${f.title} — ${f.detail}`);
          setClients([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <AppShell>
      <header className="page-head">
        <div>
          <div className="page-eyebrow">People</div>
          <h1 className="page-title">Clients</h1>
          <p className="page-sub">
            Customers of the institution. Each loan needs a client.
          </p>
        </div>
        <Link href="/clients/new" className="btn btn-primary" style={{ textDecoration: "none" }}>
          New client
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
          <span>{clients?.length ?? "—"} clients</span>
          <span>GET /clients</span>
        </div>

        {clients === null ? (
          <div className="empty-state">
            <div className="empty-state-eyebrow">Loading</div>
            Fetching from Fineract…
          </div>
        ) : clients.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-eyebrow">No clients yet</div>
            <p style={{ marginBottom: 16 }}>Create your first client to start originating loans.</p>
            <Link href="/clients/new" className="btn btn-primary" style={{ textDecoration: "none" }}>
              Create a client
            </Link>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 60 }}>ID</th>
                <th>Account #</th>
                <th>Name</th>
                <th>Status</th>
                <th>Office</th>
                <th>Activated</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{c.id}</td>
                  <td className="mono">{c.accountNo}</td>
                  <td>
                    <Link href={`/clients/${c.id}`}>{c.displayName}</Link>
                  </td>
                  <td className="mono" style={{ color: "var(--ink-soft)" }}>
                    {c.status?.value ?? "—"}
                  </td>
                  <td className="mono">{c.officeName ?? "—"}</td>
                  <td className="mono">{fmtFineractArray(c.activationDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
