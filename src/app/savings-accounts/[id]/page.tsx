"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { fineract, formatError } from "@/lib/fineract";
import { fmtFineractArray, todayIso, toFineractDate } from "@/lib/dates";

type SavingsAccountDetail = {
  id: number;
  accountNo: string;
  clientId?: number;
  clientName?: string;
  productName?: string;
  status?: { id?: number; value?: string };
  currency?: { code?: string };
  summary?: {
    accountBalance?: number;
    totalDeposits?: number;
    totalWithdrawals?: number;
    totalInterestEarned?: number;
    availableBalance?: number;
  };
  timeline?: {
    submittedOnDate?: number[];
    approvedOnDate?: number[];
    activatedOnDate?: number[];
  };
  transactions?: Tx[];
};

type Tx = {
  id: number;
  transactionType?: { value?: string; deposit?: boolean; withdrawal?: boolean };
  date?: number[];
  amount?: number;
  runningBalance?: number;
};

const STATUS_ACTIVE = 300;

export default function SavingsAccountDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [acc, setAcc] = useState<SavingsAccountDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"deposit" | "withdraw" | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    try {
      const d = await fineract<SavingsAccountDetail>({
        method: "GET",
        path: `/savingsaccounts/${id}?associations=transactions`,
      });
      setAcc(d);
      setError(null);
    } catch (e) {
      const f = formatError(e);
      setError(`${f.title} — ${f.detail}`);
    }
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  const canTransact = acc?.status?.id === STATUS_ACTIVE;

  return (
    <AppShell>
      <header className="page-head">
        <div>
          <div className="page-eyebrow">
            <Link href="/savings-accounts">Savings accounts</Link> · {acc?.accountNo ?? id}
          </div>
          <h1 className="page-title">{acc?.productName ?? "Loading…"}</h1>
          <p className="page-sub">
            {acc?.clientId && (
              <>
                <Link href={`/clients/${acc.clientId}`}>{acc.clientName}</Link>{" · "}
              </>
            )}
            {acc?.status?.value ?? "—"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canTransact && (
            <>
              <button className="btn btn-primary" onClick={() => setDialog("deposit")}>
                Deposit
              </button>
              <button className="btn btn-ghost" onClick={() => setDialog("withdraw")}>
                Withdraw
              </button>
            </>
          )}
        </div>
      </header>

      {error && (
        <div className="alert alert-bad">
          <div className="alert-label">Could not load</div>
          <div>{error}</div>
        </div>
      )}

      {acc && (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 1,
            background: "var(--rule)",
            border: "1px solid var(--rule)",
            marginBottom: 24,
          }}>
            <Stat label="Balance" value={fmt(acc.summary?.accountBalance)} accent />
            <Stat label="Available" value={fmt(acc.summary?.availableBalance ?? acc.summary?.accountBalance)} />
            <Stat label="Total deposits" value={fmt(acc.summary?.totalDeposits)} />
            <Stat label="Total withdrawals" value={fmt(acc.summary?.totalWithdrawals)} />
            <Stat label="Interest earned" value={fmt(acc.summary?.totalInterestEarned)} />
            <Stat label="Opened" value={fmtFineractArray(acc.timeline?.activatedOnDate)} />
          </div>

          <div className="table-card">
            <div className="table-head">
              <span>Transactions</span>
              <span>{acc.transactions?.length ?? 0}</span>
            </div>
            {!acc.transactions || acc.transactions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-eyebrow">No transactions yet</div>
                {canTransact
                  ? "Make a deposit to fund the account."
                  : "The account isn't active yet — approve and activate first."}
              </div>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>ID</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                    <th style={{ textAlign: "right" }}>Balance after</th>
                  </tr>
                </thead>
                <tbody>
                  {acc.transactions
                    .slice()
                    .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
                    .map((t) => (
                      <tr key={t.id}>
                        <td className="mono">{t.id}</td>
                        <td className="mono">{fmtFineractArray(t.date)}</td>
                        <td>{t.transactionType?.value ?? "—"}</td>
                        <td className="mono" style={{
                          textAlign: "right",
                          color: t.transactionType?.deposit ? "var(--good)" : "var(--ink)",
                        }}>
                          {t.transactionType?.withdrawal ? "−" : ""}{fmt(t.amount)}
                        </td>
                        <td className="mono" style={{ textAlign: "right" }}>
                          {fmt(t.runningBalance)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {dialog === "deposit" && acc && (
        <TransactionDialog
          title="Deposit"
          path={`/savingsaccounts/${acc.id}/transactions?command=deposit`}
          onClose={() => setDialog(null)}
          onSuccess={() => { setDialog(null); reload(); }}
        />
      )}
      {dialog === "withdraw" && acc && (
        <TransactionDialog
          title="Withdraw"
          path={`/savingsaccounts/${acc.id}/transactions?command=withdrawal`}
          onClose={() => setDialog(null)}
          onSuccess={() => { setDialog(null); reload(); }}
        />
      )}
    </AppShell>
  );
}

function Stat(p: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ background: "white", padding: "14px 16px" }}>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: 10,
        letterSpacing: "0.12em", textTransform: "uppercase",
        color: "var(--ink-faint)", marginBottom: 4,
      }}>{p.label}</div>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 500,
        color: p.accent ? "var(--signal-hover)" : "var(--ink)",
      }}>{p.value}</div>
    </div>
  );
}

function fmt(n: number | undefined): string {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TransactionDialog(p: {
  title: string; path: string;
  onClose: () => void; onSuccess: () => void;
}) {
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState("1000");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<{ title: string; detail: string } | null>(null);

  async function execute() {
    setSubmitting(true);
    setErr(null);
    try {
      await fineract({
        method: "POST",
        path: p.path,
        body: {
          transactionDate: toFineractDate(date),
          transactionAmount: Number(amount),
          paymentTypeId: 1,
          locale: "en",
          dateFormat: "dd MMMM yyyy",
        },
      });
      p.onSuccess();
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div role="dialog" onClick={p.onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(20,20,20,0.5)",
        display: "grid", placeItems: "center", zIndex: 50,
      }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--paper)", border: "1px solid var(--rule)",
          width: "min(420px, 90vw)", padding: 24,
        }}>
        <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 500 }}>{p.title}</h2>

        {err && (
          <div className="alert alert-bad" style={{ marginBottom: 16 }}>
            <div className="alert-label">{err.title}</div>
            <pre style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 12, whiteSpace: "pre-wrap" }}>
              {err.detail}
            </pre>
          </div>
        )}

        <div style={{ display: "grid", gap: 14, marginBottom: 20 }}>
          <div className="field">
            <label className="field-label">Date<span className="field-label-code">transactionDate</span></label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">Amount<span className="field-label-code">transactionAmount</span></label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-ghost" onClick={p.onClose} disabled={submitting}>Cancel</button>
          <button className="btn btn-primary" onClick={execute} disabled={submitting}>
            {submitting ? "Processing…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
