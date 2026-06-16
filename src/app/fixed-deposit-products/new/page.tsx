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
  interestCompoundingPeriodType: number;       // 1=Daily, 4=Monthly, 5=Quarterly, 6=Semi-Annual, 7=Annual
  interestPostingPeriodType: number;            // 4=Monthly, 5=Quarterly, 7=Annually
  interestCalculationType: number;              // 1=Daily Balance, 2=Average Daily Balance
  interestCalculationDaysInYearType: number;    // 360 or 365

  // Term limits
  minDepositTerm: number;
  minDepositTermTypeId: number;                  // 1=Days, 2=Weeks, 3=Months, 4=Years
  maxDepositTerm: number | null;
  maxDepositTermTypeId: number;

  // Deposit limits
  minDepositAmount: number | null;
  maxDepositAmount: number | null;

  // Pre-closure rules
  preClosurePenalApplicable: boolean;
  preClosurePenalInterest: number;
  preClosurePenalInterestOnTypeId: number;       // 1=Whole term, 2=Till premature withdrawal
};

const initial: Form = {
  name: "Standard Fixed Deposit",
  shortName: "FD1",
  description: "",
  currencyCode: "USD",
  digitsAfterDecimal: 2,

  nominalAnnualInterestRate: 7.5,
  interestCompoundingPeriodType: 4,
  interestPostingPeriodType: 4,
  interestCalculationType: 1,
  interestCalculationDaysInYearType: 365,

  minDepositTerm: 6,
  minDepositTermTypeId: 3,
  maxDepositTerm: 60,
  maxDepositTermTypeId: 3,

  minDepositAmount: 1000,
  maxDepositAmount: null,

  preClosurePenalApplicable: true,
  preClosurePenalInterest: 1,
  preClosurePenalInterestOnTypeId: 1,
};

const ACCOUNTING_RULE_NONE = 1;

export default function NewFdProductPage() {
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

      interestRateChart: {},
      nominalAnnualInterestRate: f.nominalAnnualInterestRate,
      interestCompoundingPeriodType: f.interestCompoundingPeriodType,
      interestPostingPeriodType: f.interestPostingPeriodType,
      interestCalculationType: f.interestCalculationType,
      interestCalculationDaysInYearType: f.interestCalculationDaysInYearType,

      minDepositTerm: f.minDepositTerm,
      minDepositTermTypeId: f.minDepositTermTypeId,

      accountingRule: ACCOUNTING_RULE_NONE,
      locale: "en",
    };

    if (f.description.trim()) body.description = f.description.trim();

    if (f.maxDepositTerm !== null) {
      body.maxDepositTerm = f.maxDepositTerm;
      body.maxDepositTermTypeId = f.maxDepositTermTypeId;
    }

    if (f.minDepositAmount !== null) body.minDepositAmount = f.minDepositAmount;
    if (f.maxDepositAmount !== null) body.maxDepositAmount = f.maxDepositAmount;

    body.preClosurePenalApplicable = f.preClosurePenalApplicable;
    if (f.preClosurePenalApplicable) {
      body.preClosurePenalInterest = f.preClosurePenalInterest;
      body.preClosurePenalInterestOnTypeId = f.preClosurePenalInterestOnTypeId;
    }

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
        path: "/fixeddepositproducts",
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
          <div className="page-eyebrow">POST /fixeddepositproducts</div>
          <h1 className="page-title">New fixed deposit product</h1>
          <p className="page-sub">
            Template for term deposits. Customers deposit a lump sum, locked for a term, earning interest at the rate set here.
          </p>
        </div>
      </header>

      {success && (
        <div className="alert alert-good">
          <div className="alert-label">Created · resource {success.resourceId}</div>
          <div>The fixed deposit product is ready. You can now open accounts using it.</div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={() => router.push("/fixed-deposit-products")}>
              View products
            </button>
            <button className="btn btn-ghost" onClick={() => router.push("/fixed-deposit-accounts/new")}>
              Open an FD account
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
            <div className="field-group-hint">Currency and precision.</div>
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
            <div className="field-group-hint">Rate and compounding.</div>
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
                ["6", "Semi-annual"],
                ["7", "Annual"],
              ]} />
            <Sel label="Posting period" code="interestPostingPeriodType"
              value={String(f.interestPostingPeriodType)}
              onChange={(v) => update("interestPostingPeriodType", Number(v))}
              options={[
                ["4", "Monthly"],
                ["5", "Quarterly"],
                ["7", "Annually"],
              ]} />
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
            <div className="field-group-title">Term limits</div>
            <div className="field-group-hint">
              The allowed range of deposit terms. A loan officer opening an account picks a specific term within this range.
            </div>
          </div>
          <div className="field-grid">
            <Num label="Min term" code="minDepositTerm" value={f.minDepositTerm}
              onChange={(v) => update("minDepositTerm", v)} min={1} />
            <Sel label="Min term unit" code="minDepositTermTypeId"
              value={String(f.minDepositTermTypeId)}
              onChange={(v) => update("minDepositTermTypeId", Number(v))}
              options={[ ["1", "Days"], ["2", "Weeks"], ["3", "Months"], ["4", "Years"] ]} />
            <NullableNum label="Max term" code="maxDepositTerm" value={f.maxDepositTerm}
              onChange={(v) => update("maxDepositTerm", v)} min={1}
              hint="Blank = no maximum." />
            <Sel label="Max term unit" code="maxDepositTermTypeId"
              value={String(f.maxDepositTermTypeId)}
              onChange={(v) => update("maxDepositTermTypeId", Number(v))}
              options={[ ["1", "Days"], ["2", "Weeks"], ["3", "Months"], ["4", "Years"] ]} />
          </div>
        </section>

        <section className="field-group">
          <div>
            <div className="field-group-title">Deposit amount limits</div>
            <div className="field-group-hint">Optional bounds on how much a customer can deposit.</div>
          </div>
          <div className="field-grid">
            <NullableNum label="Min deposit" code="minDepositAmount" value={f.minDepositAmount}
              onChange={(v) => update("minDepositAmount", v)} min={0} />
            <NullableNum label="Max deposit" code="maxDepositAmount" value={f.maxDepositAmount}
              onChange={(v) => update("maxDepositAmount", v)} min={0}
              hint="Blank = no maximum." />
          </div>
        </section>

        <section className="field-group">
          <div>
            <div className="field-group-title">Pre-closure</div>
            <div className="field-group-hint">
              Rules if a customer breaks the deposit early. Most institutions apply a small interest penalty.
            </div>
          </div>
          <div className="field-grid">
            <Sel label="Penalty applies" code="preClosurePenalApplicable"
              value={f.preClosurePenalApplicable ? "true" : "false"}
              onChange={(v) => update("preClosurePenalApplicable", v === "true")}
              options={[ ["true", "Yes"], ["false", "No"] ]} />
            {f.preClosurePenalApplicable && (
              <>
                <Num label="Penalty (% reduction in rate)" code="preClosurePenalInterest"
                  value={f.preClosurePenalInterest}
                  onChange={(v) => update("preClosurePenalInterest", v)} step="0.01"
                  hint="Subtracted from the agreed rate when paying out." />
                <Sel label="Applies to" code="preClosurePenalInterestOnTypeId"
                  value={String(f.preClosurePenalInterestOnTypeId)}
                  onChange={(v) => update("preClosurePenalInterestOnTypeId", Number(v))}
                  options={[
                    ["1", "Whole term"],
                    ["2", "Period till premature withdrawal"],
                  ]} />
              </>
            )}
            <div className="field">
              <label className="field-label">
                Accounting
                <span className="field-label-code">accountingRule</span>
              </label>
              <input value="None (no GL mapping)" disabled
                style={{ background: "var(--rule-soft)", color: "var(--ink-soft)", cursor: "not-allowed" }} />
              <div className="field-hint">Sandbox uses None.</div>
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

/* ===== Field helpers ===== */

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
  min?: number; max?: number; step?: string; hint?: string;
}) {
  return (
    <div className="field">
      <label className="field-label">
        {p.label}<span className="field-label-code">{p.code}</span>
      </label>
      <input type="number" value={p.value}
        onChange={(e) => p.onChange(Number(e.target.value))}
        min={p.min} max={p.max} step={p.step} />
      {p.hint && <div className="field-hint">{p.hint}</div>}
    </div>
  );
}

function NullableNum(p: {
  label: string; code: string; value: number | null;
  onChange: (v: number | null) => void;
  min?: number; max?: number; step?: string; hint?: string;
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
        min={p.min} max={p.max} step={p.step}
        placeholder="—" />
      {p.hint && <div className="field-hint">{p.hint}</div>}
    </div>
  );
}

function Sel(p: {
  label: string; code: string; value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
  hint?: string;
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
