"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  simulate,
  type AmortizationType,
  type FrequencyType,
  type InterestMethod,
  type RateFrequencyType,
  type SimInput,
} from "@/lib/amortization";

type Params = {
  principal: number;
  rate: number;
  rateFrequency: RateFrequencyType;
  numberOfRepayments: number;
  repaymentEvery: number;
  repaymentFrequency: FrequencyType;
  amortization: AmortizationType;
  interestMethod: InterestMethod;
  daysInYear: 360 | 364 | 365;
  daysInMonth: 30 | 0;
  graceOnPrincipalPayment: number;
  graceOnInterestPayment: number;
  graceOnInterestCharged: number;
  disbursementDate: string; // yyyy-mm-dd
};

const defaults: Params = {
  principal: 10000,
  rate: 18,
  rateFrequency: "PER_YEAR",
  numberOfRepayments: 12,
  repaymentEvery: 1,
  repaymentFrequency: "MONTHS",
  amortization: "EQUAL_INSTALLMENTS",
  interestMethod: "DECLINING_BALANCE",
  daysInYear: 365,
  daysInMonth: 30,
  graceOnPrincipalPayment: 0,
  graceOnInterestPayment: 0,
  graceOnInterestCharged: 0,
  disbursementDate: new Date().toISOString().slice(0, 10),
};

function fmt(n: number, decimals = 2) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function SimulatorPage() {
  const [p, setP] = useState<Params>(defaults);

  function update<K extends keyof Params>(k: K, v: Params[K]) {
    setP((prev) => ({ ...prev, [k]: v }));
  }

  const result = useMemo(() => {
    const input: SimInput = {
      principal: p.principal,
      annualOrPeriodicRate: p.rate,
      rateFrequency: p.rateFrequency,
      numberOfRepayments: p.numberOfRepayments,
      repaymentEvery: p.repaymentEvery,
      repaymentFrequency: p.repaymentFrequency,
      amortization: p.amortization,
      interestMethod: p.interestMethod,
      daysInYear: p.daysInYear,
      daysInMonth: p.daysInMonth,
      graceOnPrincipalPayment: p.graceOnPrincipalPayment,
      graceOnInterestPayment: p.graceOnInterestPayment,
      graceOnInterestCharged: p.graceOnInterestCharged,
      disbursementDate: new Date(p.disbursementDate),
    };
    try {
      return simulate(input);
    } catch (e) {
      return null;
    }
  }, [p]);

  return (
    <AppShell>
      <header className="page-head">
        <div>
          <div className="page-eyebrow">Local — no API call</div>
          <h1 className="page-title">Repayment schedule simulator</h1>
          <p className="page-sub">
            Preview what Mifos will generate for a loan with these parameters.
            Same amortization formulas; lets you sanity-check EMI, interest,
            and principal breakdown before originating an actual loan.
          </p>
        </div>
      </header>

      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(280px, 320px) 1fr",
        gap: 32,
        alignItems: "start",
      }}>
        {/* === Parameters panel === */}
        <aside style={{
          border: "1px solid var(--rule)",
          padding: 20,
          background: "white",
          position: "sticky",
          top: 20,
        }}>
          <div className="field-group-title" style={{ marginBottom: 16 }}>
            Parameters
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <Num label="Principal" code="principal" value={p.principal}
              onChange={(v) => update("principal", v)} />

            <Num label="Rate (%)" code="rate" value={p.rate} step="0.01"
              onChange={(v) => update("rate", v)} />

            <Sel label="Rate frequency" code="rateFrequency" value={p.rateFrequency}
              onChange={(v) => update("rateFrequency", v as RateFrequencyType)}
              options={[
                ["PER_YEAR", "Per year"],
                ["PER_MONTH", "Per month"],
              ]} />

            <Num label="Repayments" code="numberOfRepayments" value={p.numberOfRepayments}
              onChange={(v) => update("numberOfRepayments", v)} min={1} />

            <Num label="Every" code="repaymentEvery" value={p.repaymentEvery}
              onChange={(v) => update("repaymentEvery", v)} min={1} />

            <Sel label="Frequency" code="repaymentFrequency" value={p.repaymentFrequency}
              onChange={(v) => update("repaymentFrequency", v as FrequencyType)}
              options={[
                ["DAYS", "Days"],
                ["WEEKS", "Weeks"],
                ["MONTHS", "Months"],
              ]} />

            <Sel label="Amortization" code="amortization" value={p.amortization}
              onChange={(v) => update("amortization", v as AmortizationType)}
              options={[
                ["EQUAL_INSTALLMENTS", "Equal installments (EMI)"],
                ["EQUAL_PRINCIPAL", "Equal principal"],
              ]} />

            <Sel label="Interest method" code="interestMethod" value={p.interestMethod}
              onChange={(v) => update("interestMethod", v as InterestMethod)}
              options={[
                ["DECLINING_BALANCE", "Declining balance"],
                ["FLAT", "Flat"],
              ]} />

            <Sel label="Days in year" code="daysInYear" value={String(p.daysInYear)}
              onChange={(v) => update("daysInYear", Number(v) as 360 | 364 | 365)}
              options={[ ["360", "360"], ["364", "364"], ["365", "365"] ]} />

            <Num label="Grace: principal" code="graceOnPrincipalPayment"
              value={p.graceOnPrincipalPayment}
              onChange={(v) => update("graceOnPrincipalPayment", v)} min={0} />

            <Num label="Grace: interest" code="graceOnInterestPayment"
              value={p.graceOnInterestPayment}
              onChange={(v) => update("graceOnInterestPayment", v)} min={0} />

            <Num label="Grace: no charging" code="graceOnInterestCharged"
              value={p.graceOnInterestCharged}
              onChange={(v) => update("graceOnInterestCharged", v)} min={0} />

            <div className="field">
              <label className="field-label">
                Disbursement
                <span className="field-label-code">disbursementDate</span>
              </label>
              <input
                type="date"
                value={p.disbursementDate}
                onChange={(e) => update("disbursementDate", e.target.value)}
              />
            </div>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setP(defaults)}
              style={{ marginTop: 8 }}
            >
              Reset
            </button>
          </div>
        </aside>

        {/* === Results === */}
        <div style={{ display: "grid", gap: 24 }}>
          {/* Summary cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 1,
            background: "var(--rule)",
            border: "1px solid var(--rule)",
          }}>
            <SummaryCard label="EMI"
              value={result?.totals.emi !== null && result?.totals.emi !== undefined
                ? fmt(result.totals.emi) : "varies"}
              hint={result?.totals.emi ? "per installment" : "see schedule"} />
            <SummaryCard label="Total principal"
              value={result ? fmt(result.totals.totalPrincipal) : "—"} />
            <SummaryCard label="Total interest"
              value={result ? fmt(result.totals.totalInterest) : "—"}
              accent />
            <SummaryCard label="Total payment"
              value={result ? fmt(result.totals.totalPayment) : "—"} />
          </div>

          {/* Per-period rate annotation */}
          {result && (
            <div style={{
              fontFamily: "var(--font-display)",
              fontSize: 11,
              color: "var(--ink-faint)",
            }}>
              Effective per-period rate: {(result.effectivePeriodicRate * 100).toFixed(4)}%
              {" · "}
              {p.numberOfRepayments} installments
              {" · "}
              {p.amortization === "EQUAL_INSTALLMENTS" ? "EMI fixed" : "principal fixed"}
              {", "}
              {p.interestMethod === "DECLINING_BALANCE" ? "declining balance" : "flat"}
            </div>
          )}

          {/* Schedule table */}
          <div className="table-card">
            <div className="table-head">
              <span>Repayment schedule</span>
              <span>{result?.rows.length ?? 0} installments</span>
            </div>
            {result && result.rows.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table className="data" style={{ minWidth: 700 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Due date</th>
                      <th style={{ textAlign: "right" }}>Days</th>
                      <th style={{ textAlign: "right" }}>Principal</th>
                      <th style={{ textAlign: "right" }}>Interest</th>
                      <th style={{ textAlign: "right" }}>Total</th>
                      <th style={{ textAlign: "right" }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row) => (
                      <tr key={row.installmentNumber}>
                        <td className="mono">{row.installmentNumber}</td>
                        <td className="mono">{fmtDate(row.dueDate)}</td>
                        <td className="mono" style={{ textAlign: "right", color: "var(--ink-faint)" }}>
                          {row.daysInPeriod}
                        </td>
                        <td className="mono" style={{ textAlign: "right" }}>
                          {fmt(row.principalDue)}
                        </td>
                        <td className="mono" style={{
                          textAlign: "right",
                          color: "var(--ink-soft)",
                        }}>
                          {fmt(row.interestDue)}
                        </td>
                        <td className="mono" style={{ textAlign: "right", fontWeight: 500 }}>
                          {fmt(row.totalDue)}
                        </td>
                        <td className="mono" style={{ textAlign: "right", color: "var(--ink-faint)" }}>
                          {fmt(row.balanceAfter)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "var(--rule-soft)" }}>
                      <td colSpan={3} className="mono" style={{ fontWeight: 500 }}>
                        Totals
                      </td>
                      <td className="mono" style={{ textAlign: "right", fontWeight: 500 }}>
                        {result && fmt(result.totals.totalPrincipal)}
                      </td>
                      <td className="mono" style={{ textAlign: "right", fontWeight: 500 }}>
                        {result && fmt(result.totals.totalInterest)}
                      </td>
                      <td className="mono" style={{ textAlign: "right", fontWeight: 500 }}>
                        {result && fmt(result.totals.totalPayment)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-eyebrow">Invalid parameters</div>
                Adjust the inputs to generate a schedule.
              </div>
            )}
          </div>

          {/* Honest caveats */}
          <div className="alert" style={{ borderLeftColor: "var(--ink-faint)", background: "var(--rule-soft)" }}>
            <div className="alert-label">What this simulator does not capture</div>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
              <li>Interest recalculation after repayments — Mifos can adjust the schedule based on actual payment dates</li>
              <li>Charges, fees, penalties — these are layered on top by Mifos depending on the loan product setup</li>
              <li>Holiday and working-day adjustments — Mifos may shift dates around non-working days</li>
              <li>Multi-tranche disbursement — for products that disburse in parts</li>
            </ul>
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-faint)" }}>
              For products without these features, this simulator should match Mifos's generated schedule exactly.
              Small rounding differences in the last installment are normal.
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

/* ===== Small helpers ===== */

function SummaryCard(p: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div style={{
      background: "white",
      padding: "18px 20px",
    }}>
      <div style={{
        fontFamily: "var(--font-display)",
        fontSize: 10,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--ink-faint)",
        marginBottom: 6,
      }}>
        {p.label}
      </div>
      <div style={{
        fontFamily: "var(--font-display)",
        fontSize: 22,
        fontWeight: 500,
        color: p.accent ? "var(--signal-hover)" : "var(--ink)",
        letterSpacing: "-0.01em",
      }}>
        {p.value}
      </div>
      {p.hint && (
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: 10,
          color: "var(--ink-faint)",
          marginTop: 4,
        }}>
          {p.hint}
        </div>
      )}
    </div>
  );
}

function Num(p: {
  label: string; code: string; value: number;
  onChange: (v: number) => void;
  min?: number; max?: number; step?: string;
}) {
  return (
    <div className="field">
      <label className="field-label">
        {p.label}
        <span className="field-label-code">{p.code}</span>
      </label>
      <input
        type="number"
        value={p.value}
        onChange={(e) => p.onChange(Number(e.target.value))}
        min={p.min} max={p.max} step={p.step}
      />
    </div>
  );
}

function Sel(p: {
  label: string; code: string; value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <div className="field">
      <label className="field-label">
        {p.label}
        <span className="field-label-code">{p.code}</span>
      </label>
      <select value={p.value} onChange={(e) => p.onChange(e.target.value)}>
        {p.options.map(([v, label]) => (
          <option key={v} value={v}>{label}</option>
        ))}
      </select>
    </div>
  );
}
