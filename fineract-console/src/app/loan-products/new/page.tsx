"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { fineract, formatError } from "@/lib/fineract";

type Form = {
  name: string;
  shortName: string;
  currencyCode: string;
  digitsAfterDecimal: number;
  principal: number;
  numberOfRepayments: number;
  repaymentEvery: number;
  repaymentFrequencyType: number;
  interestRatePerPeriod: number;
  interestRateFrequencyType: number;
  amortizationType: number;
  interestType: number;
  interestCalculationPeriodType: number;
  transactionProcessingStrategyCode: string;
  accountingRule: number;
  daysInYearType: number;
  daysInMonthType: number;
};

const initial: Form = {
  name: "Standard Microloan",
  shortName: "SML1",
  currencyCode: "USD",
  digitsAfterDecimal: 2,
  principal: 10000,
  numberOfRepayments: 12,
  repaymentEvery: 1,
  repaymentFrequencyType: 2,
  interestRatePerPeriod: 18,
  interestRateFrequencyType: 3,
  amortizationType: 1,
  interestType: 0,
  interestCalculationPeriodType: 1,
  transactionProcessingStrategyCode: "mifos-standard-strategy",
  accountingRule: 1,
  daysInYearType: 365,
  daysInMonthType: 30,
};

export default function NewLoanProductPage() {
  const router = useRouter();
  const [f, setF] = useState<Form>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ resourceId: number } | null>(null);
  const [err, setErr] = useState<{ title: string; detail: string; raw?: string } | null>(null);

  function update<K extends keyof Form>(k: K, v: Form[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    setSuccess(null);

    const body = { ...f, locale: "en", dateFormat: "dd MMMM yyyy" };

    try {
      const data = await fineract<{ resourceId: number }>({
        method: "POST",
        path: "/loanproducts",
        body,
      });
      setSuccess({ resourceId: data.resourceId });
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <header className="page-head">
        <div>
          <div className="page-eyebrow">POST /loanproducts</div>
          <h1 className="page-title">New loan product</h1>
          <p className="page-sub">
            Defines the template — currency, principal range, schedule, interest, accounting — applied to every loan originated from it.
          </p>
        </div>
      </header>

      {success && (
        <div className="alert alert-good">
          <div className="alert-label">Created · resource {success.resourceId}</div>
          <div>The product is now visible in Fineract. You can originate loans against it.</div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={() => router.push("/loan-products")}>
              View products
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => { setSuccess(null); setF({ ...initial, name: "", shortName: "" }); }}
            >
              Create another
            </button>
          </div>
        </div>
      )}

      {err && (
        <div className="alert alert-bad">
          <div className="alert-label">{err.title}</div>
          <pre style={{
            margin: 0, fontFamily: "var(--font-display)",
            fontSize: 12, whiteSpace: "pre-wrap",
          }}>{err.detail}</pre>
          {err.raw && (
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 11 }}>
                Raw response
              </summary>
              <pre>{err.raw}</pre>
            </details>
          )}
        </div>
      )}

      <form className="form" onSubmit={submit}>
        {/* === Identity === */}
        <section className="field-group">
          <div>
            <div className="field-group-title">Identity</div>
            <div className="field-group-hint">How the product appears to staff and in reports.</div>
          </div>
          <div className="field-grid">
            <TextField label="Name" code="name" value={f.name}
              onChange={(v) => update("name", v)} required maxLength={100} />
            <TextField label="Short code" code="shortName" value={f.shortName}
              onChange={(v) => update("shortName", v)} required maxLength={4}
              hint="≤ 4 characters, unique." />
          </div>
        </section>

        {/* === Currency === */}
        <section className="field-group">
          <div>
            <div className="field-group-title">Currency</div>
            <div className="field-group-hint">ISO code and decimal precision for amounts.</div>
          </div>
          <div className="field-grid">
            <TextField label="Currency code" code="currencyCode" value={f.currencyCode}
              onChange={(v) => update("currencyCode", v.toUpperCase())} required maxLength={3} />
            <NumField label="Decimal places" code="digitsAfterDecimal" value={f.digitsAfterDecimal}
              onChange={(v) => update("digitsAfterDecimal", v)} min={0} max={4} />
          </div>
        </section>

        {/* === Principal & schedule === */}
        <section className="field-group">
          <div>
            <div className="field-group-title">Schedule</div>
            <div className="field-group-hint">Default principal and how the schedule is built.</div>
          </div>
          <div className="field-grid">
            <NumField label="Default principal" code="principal" value={f.principal}
              onChange={(v) => update("principal", v)} min={0} />
            <NumField label="Repayments" code="numberOfRepayments" value={f.numberOfRepayments}
              onChange={(v) => update("numberOfRepayments", v)} min={1} />
            <NumField label="Every" code="repaymentEvery" value={f.repaymentEvery}
              onChange={(v) => update("repaymentEvery", v)} min={1} hint="e.g. 1 with 'months' = monthly." />
            <SelectField label="Frequency" code="repaymentFrequencyType" value={f.repaymentFrequencyType}
              onChange={(v) => update("repaymentFrequencyType", v)}
              options={[
                [0, "Days"], [1, "Weeks"], [2, "Months"],
              ]} />
          </div>
        </section>

        {/* === Interest === */}
        <section className="field-group">
          <div>
            <div className="field-group-title">Interest</div>
            <div className="field-group-hint">Rate, calculation method, and amortization style.</div>
          </div>
          <div className="field-grid">
            <NumField label="Rate" code="interestRatePerPeriod" value={f.interestRatePerPeriod}
              onChange={(v) => update("interestRatePerPeriod", v)} step="0.01" hint="Percent, in the chosen frequency." />
            <SelectField label="Rate frequency" code="interestRateFrequencyType" value={f.interestRateFrequencyType}
              onChange={(v) => update("interestRateFrequencyType", v)}
              options={[ [2, "Per month"], [3, "Per year"] ]} />
            <SelectField label="Amortization" code="amortizationType" value={f.amortizationType}
              onChange={(v) => update("amortizationType", v)}
              options={[ [0, "Equal principal"], [1, "Equal installments"] ]} />
            <SelectField label="Interest method" code="interestType" value={f.interestType}
              onChange={(v) => update("interestType", v)}
              options={[ [0, "Declining balance"], [1, "Flat"] ]} />
            <SelectField label="Calc period" code="interestCalculationPeriodType" value={f.interestCalculationPeriodType}
              onChange={(v) => update("interestCalculationPeriodType", v)}
              options={[ [0, "Daily"], [1, "Same as repayment period"] ]} />
          </div>
        </section>

        {/* === Processing & accounting === */}
        <section className="field-group">
          <div>
            <div className="field-group-title">Processing</div>
            <div className="field-group-hint">How payments allocate and where they post.</div>
          </div>
          <div className="field-grid">
            <SelectField label="Repayment strategy" code="transactionProcessingStrategyCode" value={f.transactionProcessingStrategyCode}
              onChange={(v) => update("transactionProcessingStrategyCode", v)}
              options={[
                ["mifos-standard-strategy", "Mifos standard"],
                ["heavensfamily-strategy", "Heavensfamily"],
                ["creocore-strategy", "Creocore (early payment)"],
                ["rbi-india-strategy", "RBI India"],
                ["principal-interest-penalties-fees-order-strategy", "Principal · Interest · Penalties · Fees"],
                ["interest-principal-penalties-fees-order-strategy", "Interest · Principal · Penalties · Fees"],
                ["early-repayment-strategy", "Early repayment"],
              ]} />
            <SelectField label="Accounting" code="accountingRule" value={f.accountingRule}
              onChange={(v) => update("accountingRule", v)}
              options={[
                [1, "None"], [2, "Cash"], [3, "Accrual (periodic)"], [4, "Accrual (upfront)"],
              ]} hint="Start with None for sandbox." />
            <SelectField label="Days in year" code="daysInYearType" value={f.daysInYearType}
              onChange={(v) => update("daysInYearType", v)}
              options={[ [360, "360"], [364, "364"], [365, "365"] ]} />
            <SelectField label="Days in month" code="daysInMonthType" value={f.daysInMonthType}
              onChange={(v) => update("daysInMonthType", v)}
              options={[ [1, "Actual"], [30, "30"] ]} />
          </div>
        </section>

        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Creating…" : "Create product"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setF(initial)}
            disabled={submitting}
          >
            Reset
          </button>
        </div>
      </form>
    </AppShell>
  );
}

/* ===== Field helpers ===== */

function TextField(p: {
  label: string; code: string; value: string;
  onChange: (v: string) => void;
  required?: boolean; maxLength?: number; hint?: string;
}) {
  return (
    <div className="field">
      <label className="field-label">
        {p.label}
        <span className="field-label-code">{p.code}</span>
      </label>
      <input
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        required={p.required}
        maxLength={p.maxLength}
      />
      {p.hint && <div className="field-hint">{p.hint}</div>}
    </div>
  );
}

function NumField(p: {
  label: string; code: string; value: number;
  onChange: (v: number) => void;
  min?: number; max?: number; step?: string; hint?: string;
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
        min={p.min}
        max={p.max}
        step={p.step}
      />
      {p.hint && <div className="field-hint">{p.hint}</div>}
    </div>
  );
}

function SelectField<V extends string | number>(p: {
  label: string; code: string; value: V;
  onChange: (v: V) => void;
  options: Array<[V, string]>;
  hint?: string;
}) {
  return (
    <div className="field">
      <label className="field-label">
        {p.label}
        <span className="field-label-code">{p.code}</span>
      </label>
      <select
        value={String(p.value)}
        onChange={(e) => {
          const raw = e.target.value;
          // Preserve original type (number vs string) based on the option list
          const sample = p.options[0][0];
          const next = (typeof sample === "number" ? Number(raw) : raw) as V;
          p.onChange(next);
        }}
      >
        {p.options.map(([v, label]) => (
          <option key={String(v)} value={String(v)}>{label}</option>
        ))}
      </select>
      {p.hint && <div className="field-hint">{p.hint}</div>}
    </div>
  );
}
