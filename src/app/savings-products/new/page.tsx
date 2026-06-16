"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { fineract, formatError } from "@/lib/fineract";

type Form = {
  name: string;
  shortName: string;
  description: string;
  currencyCode: string;
  digitsAfterDecimal: number;
  nominalAnnualInterestRate: number;
  interestCompoundingPeriodType: number;     // 1=Daily, 4=Monthly
  interestPostingPeriodType: number;          // 4=Monthly, 5=Quarterly, 7=Annually
  interestCalculationType: number;            // 1=Daily Balance, 2=Average Daily Balance
  interestCalculationDaysInYearType: number;  // 360 or 365
  minRequiredOpeningBalance: number | null;
  withdrawalFeeForTransfers: boolean;
  allowOverdraft: boolean;
};

const initial: Form = {
  name: "Regular Savings",
  shortName: "RSV1",
  description: "",
  currencyCode: "USD",
  digitsAfterDecimal: 2,
  nominalAnnualInterestRate: 4,
  interestCompoundingPeriodType: 4,
  interestPostingPeriodType: 4,
  interestCalculationType: 1,
  interestCalculationDaysInYearType: 365,
  minRequiredOpeningBalance: null,
  withdrawalFeeForTransfers: false,
  allowOverdraft: false,
};

const ACCOUNTING_RULE_NONE = 1;

export default function NewSavingsProductPage() {
  const router = useRouter();
  const [f, setF] = useState<Form>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ resourceId: number } | null>(null);
  const [err, setErr] = useState<{ title: string; detail: string; raw?: string } | null>(null);

  function update<K extends keyof Form>(k: K, v: Form[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  function buildBody(): Record<string, unknown> {
    const body: Record<string, unknown> = {
      name: f.name,
      shortName: f.shortName,
      currencyCode: f.currencyCode,
      digitsAfterDecimal: f.digitsAfterDecimal,
      nominalAnnualInterestRate: f.nominalAnnualInterestRate,
      interestCompoundingPeriodType: f.interestCompoundingPeriodType,
      interestPostingPeriodType: f.interestPostingPeriodType,
      interestCalculationType: f.interestCalculationType,
      interestCalculationDaysInYearType: f.interestCalculationDaysInYearType,
      accountingRule: ACCOUNTING_RULE_NONE,
      locale: "en",
    };
    if (f.description.trim()) body.description = f.description.trim();
    if (f.minRequiredOpeningBalance !== null) {
      body.minRequiredOpeningBalance = f.minRequiredOpeningBalance;
    }
    if (f.withdrawalFeeForTransfers) body.withdrawalFeeForTransfers = true;
    if (f.allowOverdraft) body.allowOverdraft = true;
    return body;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    setSuccess(null);
    try {
      const data = await fineract<{ resourceId: number }>({
        method: "POST",
        path: "/savingsproducts",
        body: buildBody(),
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
          <div className="page-eyebrow">POST /savingsproducts</div>
          <h1 className="page-title">New savings product</h1>
          <p className="page-sub">
            Template for deposit accounts. Defines interest, compounding, and posting rules.
          </p>
        </div>
      </header>

      {success && (
        <div className="alert alert-good">
          <div className="alert-label">Created · resource {success.resourceId}</div>
          <div>The savings product is ready. You can now open accounts using it.</div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={() => router.push("/savings-products")}>
              View products
            </button>
            <button className="btn btn-ghost" onClick={() => router.push("/savings-accounts/new")}>
              Open an account
            </button>
            <button className="btn btn-ghost"
              onClick={() => { setSuccess(null); setF({ ...initial, name: "", shortName: "" }); }}>
              Create another
            </button>
          </div>
        </div>
      )}

      {err && (
        <div className="alert alert-bad">
          <div className="alert-label">{err.title}</div>
          <pre style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 12, whiteSpace: "pre-wrap" }}>
            {err.detail}
          </pre>
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
        <section className="field-group">
          <div>
            <div className="field-group-title">Identity</div>
            <div className="field-group-hint">How the product appears to staff and on statements.</div>
          </div>
          <div className="field-grid">
            <Text label="Name" code="name" value={f.name}
              onChange={(v) => update("name", v)} required />
            <Text label="Short code" code="shortName" value={f.shortName}
              onChange={(v) => update("shortName", v)} required
              hint="Max 4 characters, unique." />
          </div>
        </section>

        <section className="field-group">
          <div>
            <div className="field-group-title">Currency</div>
            <div className="field-group-hint">Currency and precision for balances.</div>
          </div>
          <div className="field-grid">
            <Text label="Currency code" code="currencyCode" value={f.currencyCode}
              onChange={(v) => update("currencyCode", v.toUpperCase())} required />
            <Num label="Decimal places" code="digitsAfterDecimal" value={f.digitsAfterDecimal}
              onChange={(v) => update("digitsAfterDecimal", v)} min={0} max={4} />
          </div>
        </section>

        <section className="field-group">
          <div>
            <div className="field-group-title">Interest</div>
            <div className="field-group-hint">How interest accrues on customer balances.</div>
          </div>
          <div className="field-grid">
            <Num label="Annual rate (%)" code="nominalAnnualInterestRate"
              value={f.nominalAnnualInterestRate}
              onChange={(v) => update("nominalAnnualInterestRate", v)} step="0.01" />
            <Sel label="Compounding period" code="interestCompoundingPeriodType"
              value={String(f.interestCompoundingPeriodType)}
              onChange={(v) => update("interestCompoundingPeriodType", Number(v))}
              options={[
                ["1", "Daily"],
                ["4", "Monthly"],
                ["5", "Quarterly"],
                ["7", "Annually"],
              ]} />
            <Sel label="Posting period" code="interestPostingPeriodType"
              value={String(f.interestPostingPeriodType)}
              onChange={(v) => update("interestPostingPeriodType", Number(v))}
              options={[
                ["4", "Monthly"],
                ["5", "Quarterly"],
                ["7", "Annually"],
              ]}
              hint="When accrued interest credits to the account." />
            <Sel label="Calculation type" code="interestCalculationType"
              value={String(f.interestCalculationType)}
              onChange={(v) => update("interestCalculationType", Number(v))}
              options={[
                ["1", "Daily balance"],
                ["2", "Average daily balance"],
              ]} />
            <Sel label="Days in year" code="interestCalculationDaysInYearType"
              value={String(f.interestCalculationDaysInYearType)}
              onChange={(v) => update("interestCalculationDaysInYearType", Number(v))}
              options={[ ["360", "360"], ["365", "365"] ]} />
          </div>
        </section>

        <section className="field-group">
          <div>
            <div className="field-group-title">Balance & overdraft</div>
            <div className="field-group-hint">Minimum opening balance, optional overdraft.</div>
          </div>
          <div className="field-grid">
            <NullableNum label="Min opening balance" code="minRequiredOpeningBalance"
              value={f.minRequiredOpeningBalance}
              onChange={(v) => update("minRequiredOpeningBalance", v)}
              hint="Blank = no minimum." />
            <Sel label="Allow overdraft" code="allowOverdraft"
              value={f.allowOverdraft ? "true" : "false"}
              onChange={(v) => update("allowOverdraft", v === "true")}
              options={[ ["false", "No"], ["true", "Yes"] ]} />
            <div className="field">
              <label className="field-label">
                Accounting
                <span className="field-label-code">accountingRule</span>
              </label>
              <input value="None (no GL mapping)" disabled
                style={{ background: "var(--rule-soft)", color: "var(--ink-soft)", cursor: "not-allowed" }} />
              <div className="field-hint">Sandbox uses None — GL configuration is a separate workstream.</div>
            </div>
          </div>
        </section>

        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Creating…" : "Create product"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setF(initial)} disabled={submitting}>
            Reset
          </button>
        </div>
      </form>
    </AppShell>
  );
}

/* ===== Field helpers (local versions) ===== */

function Text(p: {
  label: string; code: string; value: string;
  onChange: (v: string) => void;
  required?: boolean; hint?: string;
}) {
  return (
    <div className="field">
      <label className="field-label">
        {p.label}<span className="field-label-code">{p.code}</span>
      </label>
      <input value={p.value} onChange={(e) => p.onChange(e.target.value)} required={p.required} />
      {p.hint && <div className="field-hint">{p.hint}</div>}
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
        {p.label}<span className="field-label-code">{p.code}</span>
      </label>
      <input type="number" value={p.value}
        onChange={(e) => p.onChange(Number(e.target.value))}
        min={p.min} max={p.max} step={p.step} />
    </div>
  );
}

function NullableNum(p: {
  label: string; code: string; value: number | null;
  onChange: (v: number | null) => void;
  hint?: string;
}) {
  return (
    <div className="field">
      <label className="field-label">
        {p.label}<span className="field-label-code">{p.code}</span>
      </label>
      <input type="number" value={p.value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          p.onChange(v === "" ? null : Number(v));
        }}
        placeholder="—" />
      {p.hint && <div className="field-hint">{p.hint}</div>}
    </div>
  );
}

function Sel(p: {
  label: string; code: string; value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>; hint?: string;
}) {
  return (
    <div className="field">
      <label className="field-label">
        {p.label}<span className="field-label-code">{p.code}</span>
      </label>
      <select value={p.value} onChange={(e) => p.onChange(e.target.value)}>
        {p.options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
      {p.hint && <div className="field-hint">{p.hint}</div>}
    </div>
  );
}
