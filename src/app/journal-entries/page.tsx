"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { fineract, formatError } from "@/lib/fineract";
import { fmtFineractArray, offsetDaysIso, todayIso, toFineractDate } from "@/lib/dates";

type JournalEntry = {
  id: number;
  officeName?: string;
  glAccountName?: string;
  glAccountId?: number;
  glAccountCode?: string;
  glAccountType?: { value?: string };
  transactionDate?: number[];
  entryType?: { value?: string };       // "DEBIT" | "CREDIT"
  amount?: number;
  transactionId?: string;
  manualEntry?: boolean;
  reversed?: boolean;
};

type GLAccount = { id: number; name: string; glCode: string; type?: { value?: string } };

type EntriesResponse = { pageItems?: JournalEntry[]; totalFilteredRecords?: number };

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState(offsetDaysIso(-30));
  const [toDate, setToDate] = useState(todayIso());
  const [accountFilter, setAccountFilter] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fineract<GLAccount[]>({
          method: "GET",
          path: "/glaccounts",
        });
        if (!cancelled) setAccounts(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setAccounts([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setEntries(null);
      try {
        const params = new URLSearchParams();
        params.append("fromDate", toFineractDate(fromDate));
        params.append("toDate", toFineractDate(toDate));
        params.append("locale", "en");
        params.append("dateFormat", "dd MMMM yyyy");
        params.append("limit", "300");
        if (accountFilter) params.append("glAccountId", accountFilter);

        const data = await fineract<EntriesResponse>({
          method: "GET",
          path: `/journalentries?${params.toString()}`,
        });
        if (!cancelled) {
          setEntries(data.pageItems ?? []);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          const f = formatError(e);
          setError(`${f.title} — ${f.detail}`);
          setEntries([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [fromDate, toDate, accountFilter]);

  const totalDebit = entries?.reduce((s, e) =>
    s + ((e.entryType?.value ?? "").toUpperCase() === "DEBIT" ? (e.amount ?? 0) : 0), 0) ?? 0;
  const totalCredit = entries?.reduce((s, e) =>
    s + ((e.entryType?.value ?? "").toUpperCase() === "CREDIT" ? (e.amount ?? 0) : 0), 0) ?? 0;
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <AppShell>
      <header className="page-head">
        <div>
          <div className="page-eyebrow">Accounting</div>
          <h1 className="page-title">Journal entries</h1>
          <p className="page-sub">
            Every transaction in the system produces balanced journal entries.
            Filter by date or account to drill into specific activity.
          </p>
        </div>
      </header>

      {/* Filters */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 2fr",
        gap: 16,
        marginBottom: 24,
        padding: 16,
        border: "1px solid var(--rule)",
        background: "white",
      }}>
        <div className="field">
          <label className="field-label">From<span className="field-label-code">fromDate</span></label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">To<span className="field-label-code">toDate</span></label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">GL account<span className="field-label-code">glAccountId</span></label>
          <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
            <option value="">— All accounts —</option>
            {accounts.map((a) => (
              <option key={a.id} value={String(a.id)}>
                {a.glCode} · {a.name} ({a.type?.value})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Balance summary */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 1,
        background: "var(--rule)",
        border: "1px solid var(--rule)",
        marginBottom: 24,
      }}>
        <Stat label="Entries" value={String(entries?.length ?? "—")} />
        <Stat label="Total debits" value={fmt(totalDebit)} />
        <Stat label="Total credits" value={fmt(totalCredit)} />
        <Stat
          label="Balance"
          value={entries === null ? "—" : balanced ? "Balanced" : `${fmt(Math.abs(totalDebit - totalCredit))} off`}
          accent={!balanced}
          good={entries !== null && balanced}
        />
      </div>

      {error && (
        <div className="alert alert-bad">
          <div className="alert-label">Could not load</div>
          <div>{error}</div>
        </div>
      )}

      <div className="table-card">
        <div className="table-head">
          <span>{entries?.length ?? "—"} entries</span>
          <span>GET /journalentries</span>
        </div>
        {entries === null ? (
          <div className="empty-state">
            <div className="empty-state-eyebrow">Loading</div>
          </div>
        ) : entries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-eyebrow">No entries in range</div>
            Adjust the date filters above, or run transactions on products with accounting enabled.
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 60 }}>ID</th>
                <th>Date</th>
                <th>Account</th>
                <th>Type</th>
                <th>Office</th>
                <th>Transaction</th>
                <th style={{ textAlign: "right" }}>Debit</th>
                <th style={{ textAlign: "right" }}>Credit</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const isDebit = (e.entryType?.value ?? "").toUpperCase() === "DEBIT";
                return (
                  <tr key={e.id} style={e.reversed ? { textDecoration: "line-through", color: "var(--ink-faint)" } : undefined}>
                    <td className="mono">{e.id}</td>
                    <td className="mono">{fmtFineractArray(e.transactionDate)}</td>
                    <td>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 11, color: "var(--ink-faint)", marginRight: 6 }}>
                        {e.glAccountCode}
                      </span>
                      {e.glAccountName}
                    </td>
                    <td style={{ fontSize: 11, color: "var(--ink-soft)" }}>{e.glAccountType?.value ?? "—"}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{e.officeName ?? "—"}</td>
                    <td className="mono" style={{ fontSize: 11, color: "var(--ink-soft)" }}>{e.transactionId ?? "—"}</td>
                    <td className="mono" style={{ textAlign: "right" }}>
                      {isDebit ? fmt(e.amount) : ""}
                    </td>
                    <td className="mono" style={{ textAlign: "right" }}>
                      {!isDebit ? fmt(e.amount) : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "var(--rule-soft)" }}>
                <td colSpan={6} className="mono" style={{ fontWeight: 500 }}>Totals</td>
                <td className="mono" style={{ textAlign: "right", fontWeight: 500 }}>{fmt(totalDebit)}</td>
                <td className="mono" style={{ textAlign: "right", fontWeight: 500 }}>{fmt(totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </AppShell>
  );
}

function Stat(p: { label: string; value: string; accent?: boolean; good?: boolean }) {
  return (
    <div style={{ background: "white", padding: "14px 16px" }}>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: 10,
        letterSpacing: "0.12em", textTransform: "uppercase",
        color: "var(--ink-faint)", marginBottom: 4,
      }}>{p.label}</div>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 500,
        color: p.accent ? "var(--bad)" : p.good ? "var(--good)" : "var(--ink)",
      }}>{p.value}</div>
    </div>
  );
}

function fmt(n: number | undefined): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
