"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { fineract, formatError } from "@/lib/fineract";
import { fmtFineractArray, todayIso, toFineractDate } from "@/lib/dates";

type LoanDetail = {
  id: number;
  accountNo: string;
  externalId?: string;
  status?: { id?: number; code?: string; value?: string };
  clientId?: number;
  clientName?: string;
  loanProductName?: string;
  principal?: number;
  approvedPrincipal?: number;
  loanBalance?: number;
  totalOutstanding?: number;
  summary?: {
    principalDisbursed?: number;
    principalPaid?: number;
    principalOutstanding?: number;
    interestCharged?: number;
    interestPaid?: number;
    interestOutstanding?: number;
    totalExpectedRepayment?: number;
    totalRepayment?: number;
    totalOutstanding?: number;
  };
  timeline?: {
    submittedOnDate?: number[];
    approvedOnDate?: number[];
    actualDisbursementDate?: number[];
    expectedDisbursementDate?: number[];
  };
  repaymentSchedule?: {
    periods?: SchedulePeriod[];
  };
};

type SchedulePeriod = {
  period?: number;
  fromDate?: number[];
  dueDate?: number[];
  principalDue?: number;
  interestDue?: number;
  totalDueForPeriod?: number;
  principalOutstanding?: number;
  complete?: boolean;
  principalPaid?: number;
  interestPaid?: number;
};

// Fineract status IDs (commonly seen)
const STATUS = {
  SUBMITTED: 100,
  APPROVED: 200,
  ACTIVE: 300,
  CLOSED_OBLIGATIONS_MET: 600,
  CLOSED_WRITTEN_OFF: 601,
};

export default function LoanDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [loan, setLoan] = useState<LoanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"approve" | "disburse" | "repay" | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    try {
      const data = await fineract<LoanDetail>({
        method: "GET",
        path: `/loans/${id}?associations=repaymentSchedule,summary`,
      });
      setLoan(data);
      setError(null);
    } catch (e) {
      const f = formatError(e);
      setError(`${f.title} — ${f.detail}`);
    }
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  const statusId = loan?.status?.id ?? 0;
  const canApprove = statusId === STATUS.SUBMITTED;
  const canDisburse = statusId === STATUS.APPROVED;
  const canRepay = statusId === STATUS.ACTIVE;

  return (
    <AppShell>
      <header className="page-head">
        <div>
          <div className="page-eyebrow">
            <Link href="/loans">Loans</Link> · {loan?.accountNo ?? id}
          </div>
          <h1 className="page-title">{loan?.loanProductName ?? "Loading…"}</h1>
          <p className="page-sub">
            {loan?.clientId && (
              <>
                <Link href={`/clients/${loan.clientId}`}>{loan.clientName}</Link>
                {" · "}
              </>
            )}
            {loan?.status?.value ?? "—"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canApprove && (
            <button className="btn btn-primary" onClick={() => setDialog("approve")}>
              Approve
            </button>
          )}
          {canDisburse && (
            <button className="btn btn-primary" onClick={() => setDialog("disburse")}>
              Disburse
            </button>
          )}
          {canRepay && (
            <button className="btn btn-primary" onClick={() => setDialog("repay")}>
              Make repayment
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="alert alert-bad">
          <div className="alert-label">Could not load</div>
          <div>{error}</div>
        </div>
      )}

      {loan && (
        <>
          {/* Collateral linkage banner */}
          {loan.externalId?.startsWith("collateral:savings:") && (
            <div className="alert" style={{
              borderLeftColor: "var(--signal)",
              background: "rgba(232, 184, 60, 0.08)",
              marginBottom: 24,
            }}>
              <div className="alert-label" style={{ color: "var(--signal-hover)" }}>
                Secured loan
              </div>
              <div>
                This loan is secured by{" "}
                <Link href={`/savings-accounts/${loan.externalId.split(":")[2]}`}>
                  savings account #{loan.externalId.split(":")[2]}
                </Link>
                {" "}as collateral.
              </div>
            </div>
          )}

          {/* Summary cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 1,
            background: "var(--rule)",
            border: "1px solid var(--rule)",
            marginBottom: 24,
          }}>
            <Stat label="Principal" value={fmt(loan.principal)} />
            <Stat label="Disbursed" value={fmt(loan.summary?.principalDisbursed)} />
            <Stat label="Paid" value={fmt(loan.summary?.totalRepayment)} />
            <Stat label="Outstanding" value={fmt(loan.summary?.totalOutstanding)} accent />
            <Stat label="Submitted" value={fmtFineractArray(loan.timeline?.submittedOnDate)} />
            <Stat label="Approved" value={fmtFineractArray(loan.timeline?.approvedOnDate)} />
            <Stat label="Disbursed on" value={fmtFineractArray(loan.timeline?.actualDisbursementDate)} />
          </div>

          {/* Schedule */}
          <div className="table-card">
            <div className="table-head">
              <span>Repayment schedule</span>
              <span>{loan.repaymentSchedule?.periods?.length ?? 0} periods</span>
            </div>
            {loan.repaymentSchedule?.periods?.length ? (
              <div style={{ overflowX: "auto" }}>
                <table className="data" style={{ minWidth: 700 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Due</th>
                      <th style={{ textAlign: "right" }}>Principal</th>
                      <th style={{ textAlign: "right" }}>Interest</th>
                      <th style={{ textAlign: "right" }}>Total</th>
                      <th style={{ textAlign: "right" }}>Paid</th>
                      <th>State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loan.repaymentSchedule.periods.map((p, idx) => {
                      // Period 0 is the disbursement row; subsequent are installments
                      const isDisburse = !p.period || p.period === 0;
                      const paid = (p.principalPaid ?? 0) + (p.interestPaid ?? 0);
                      return (
                        <tr key={idx} style={isDisburse ? { background: "var(--rule-soft)" } : undefined}>
                          <td className="mono">{p.period ?? "—"}</td>
                          <td className="mono">{fmtFineractArray(p.dueDate ?? p.fromDate)}</td>
                          <td className="mono" style={{ textAlign: "right" }}>{fmt(p.principalDue)}</td>
                          <td className="mono" style={{ textAlign: "right", color: "var(--ink-soft)" }}>
                            {fmt(p.interestDue)}
                          </td>
                          <td className="mono" style={{ textAlign: "right", fontWeight: 500 }}>
                            {fmt(p.totalDueForPeriod)}
                          </td>
                          <td className="mono" style={{ textAlign: "right" }}>
                            {paid > 0 ? fmt(paid) : "—"}
                          </td>
                          <td className="mono" style={{
                            fontSize: 11,
                            color: p.complete ? "var(--good)" : "var(--ink-faint)",
                          }}>
                            {isDisburse ? "Disbursed" : p.complete ? "Paid" : "Due"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-eyebrow">No schedule</div>
                Schedule will appear once the loan is approved.
              </div>
            )}
          </div>
        </>
      )}

      {/* Action dialogs */}
      {dialog === "approve" && loan && (
        <ActionDialog
          title="Approve loan"
          loanId={String(loan.id)}
          command="approve"
          fields={[{ key: "approvedOnDate", label: "Approved on", type: "date", default: todayIso() }]}
          extraBody={{ approvedLoanAmount: loan.principal, expectedDisbursementDate: toFineractDate(todayIso()) }}
          onClose={() => setDialog(null)}
          onSuccess={() => { setDialog(null); reload(); }}
        />
      )}

      {dialog === "disburse" && loan && (
        <ActionDialog
          title="Disburse loan"
          loanId={String(loan.id)}
          command="disburse"
          fields={[
            { key: "actualDisbursementDate", label: "Disbursement date", type: "date", default: todayIso() },
            { key: "transactionAmount", label: "Amount", type: "number", default: String(loan.principal ?? 0) },
          ]}
          onClose={() => setDialog(null)}
          onSuccess={() => { setDialog(null); reload(); }}
        />
      )}

      {dialog === "repay" && loan && (
        <ActionDialog
          title="Make repayment"
          loanId={String(loan.id)}
          path={`/loans/${loan.id}/transactions?command=repayment`}
          fields={[
            { key: "transactionDate", label: "Payment date", type: "date", default: todayIso() },
            { key: "transactionAmount", label: "Amount", type: "number", default: String(nextInstallmentAmount(loan)) },
          ]}
          extraBody={{ paymentTypeId: 1 }}
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
      }}>
        {p.label}
      </div>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 500,
        color: p.accent ? "var(--signal-hover)" : "var(--ink)",
      }}>
        {p.value}
      </div>
    </div>
  );
}

function fmt(n: number | undefined): string {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function nextInstallmentAmount(loan: LoanDetail): number {
  const next = loan.repaymentSchedule?.periods?.find((p) => p.period && p.period > 0 && !p.complete);
  return next?.totalDueForPeriod ?? 0;
}

/* ===== Dialog component used for approve / disburse / repay ===== */

type Field = {
  key: string;
  label: string;
  type: "date" | "number" | "text";
  default: string;
};

function ActionDialog(p: {
  title: string;
  loanId: string;
  command?: string;             // for /loans/{id}?command=X
  path?: string;                // explicit override
  fields: Field[];
  extraBody?: Record<string, unknown>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    p.fields.forEach((f) => { init[f.key] = f.default; });
    return init;
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<{ title: string; detail: string } | null>(null);

  async function execute() {
    setSubmitting(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        locale: "en",
        dateFormat: "dd MMMM yyyy",
        ...p.extraBody,
      };
      for (const f of p.fields) {
        if (f.type === "date") body[f.key] = toFineractDate(values[f.key]);
        else if (f.type === "number") body[f.key] = Number(values[f.key]);
        else body[f.key] = values[f.key];
      }
      const path = p.path ?? `/loans/${p.loanId}?command=${p.command}`;
      await fineract({ method: "POST", path, body });
      p.onSuccess();
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      onClick={p.onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(20,20,20,0.5)",
        display: "grid", placeItems: "center", zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--paper)", border: "1px solid var(--rule)",
          width: "min(480px, 90vw)", padding: 24,
        }}
      >
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
          {p.fields.map((f) => (
            <div className="field" key={f.key}>
              <label className="field-label">
                {f.label}
                <span className="field-label-code">{f.key}</span>
              </label>
              <input
                type={f.type}
                value={values[f.key]}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-ghost" onClick={p.onClose} disabled={submitting}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={execute} disabled={submitting}>
            {submitting ? "Processing…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
