"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { fineract, formatError } from "@/lib/fineract";
import { fmtFineractArray } from "@/lib/dates";

type FdDetail = {
  id: number;
  accountNo: string;
  clientId?: number;
  clientName?: string;
  productName?: string;
  status?: { id?: number; value?: string };
  currency?: { code?: string };
  depositAmount?: number;
  maturityAmount?: number;
  maturityDate?: number[];
  depositPeriod?: number;
  depositPeriodFrequency?: { value?: string };
  nominalAnnualInterestRate?: number;
  summary?: {
    accountBalance?: number;
    totalInterestEarned?: number;
  };
  timeline?: {
    submittedOnDate?: number[];
    approvedOnDate?: number[];
    activatedOnDate?: number[];
  };
};

export default function FdDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [acc, setAcc] = useState<FdDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const d = await fineract<FdDetail>({
          method: "GET",
          path: `/fixeddepositaccounts/${id}`,
        });
        if (!cancelled) setAcc(d);
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
            <Link href="/fixed-deposit-accounts">Fixed deposits</Link> · {acc?.accountNo ?? id}
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
            <Stat label="Deposit" value={fmt(acc.depositAmount)} />
            <Stat label="Current balance" value={fmt(acc.summary?.accountBalance ?? acc.depositAmount)} />
            <Stat label="Interest earned" value={fmt(acc.summary?.totalInterestEarned)} />
            <Stat label="At maturity" value={fmt(acc.maturityAmount)} accent />
            <Stat label="Rate" value={acc.nominalAnnualInterestRate ? `${acc.nominalAnnualInterestRate}%` : "—"} />
            <Stat
              label="Term"
              value={
                acc.depositPeriod
                  ? `${acc.depositPeriod} ${acc.depositPeriodFrequency?.value ?? ""}`
                  : "—"
              }
            />
            <Stat label="Activated" value={fmtFineractArray(acc.timeline?.activatedOnDate)} />
            <Stat label="Matures" value={fmtFineractArray(acc.maturityDate)} />
          </div>

          <div className="alert" style={{
            borderLeftColor: "var(--ink-faint)",
            background: "var(--rule-soft)",
          }}>
            <div className="alert-label">About this fixed deposit</div>
            <div>
              The deposit amount is locked for the term. Interest accrues at the agreed rate and is paid at maturity.
              In production setup, scheduled EOD jobs would accrue interest daily and post it on maturity; this sandbox shows the
              calculated maturity amount but doesn&apos;t run the accrual engine.
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-faint)" }}>
              This FD is eligible to back a loan as collateral. Create a loan for{" "}
              <Link href={`/loans/new?clientId=${acc.clientId}`}>this client</Link>{" "}
              and select this FD in the collateral picker.
            </div>
          </div>
        </>
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
