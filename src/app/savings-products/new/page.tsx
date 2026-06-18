"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { fineract, formatError } from "@/lib/fineract";

type GLAccount = {
  id: number;
  name: string;
  glCode: string;
  type?: { id?: number; value?: string };
};

const TYPE_ASSET = 1;
const TYPE_LIABILITY = 2;
const TYPE_INCOME = 4;
const TYPE_EXPENSE = 5;

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

  // Accounting
  accountingRule: number;                     // 1=None, 2=Cash
  savingsControlAccountId: number | null;     // Liability — customer deposits
  savingsReferenceAccountId: number | null;   // Asset — cash backing the deposits
  interestOnSavingsAccountId: number | null;  // Expense — interest paid
  incomeFromFeeAccountId: number | null;      // Income — savings fees
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
  // Accounting defaults
  accountingRule: 1,                       // 1 = None
  savingsControlAccountId: null,
  savingsReferenceAccountId: null,
  interestOnSavingsAccountId: null,
  incomeFromFeeAccountId: null,
};

export default function NewSavingsProductPage() {
  const router = useRouter();
  const [f, setF] = useState<Form>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ resourceId: number } | null>(null);
  const [err, setErr] = useState<{ title: string; detail: string; raw?: string } | null>(null);
  const [glAccounts, setGlAccounts] = useState<GLAccount[]>([]);

  // Load GL accounts for the accounting section dropdowns.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fineract<GLAccount[]>({ method: "GET", path: "/glaccounts" });
        if (!cancelled) setGlAccounts(Array.isArray(data) ? data : []);
      } catch {
        // Non-fatal — user can still create with accounting=None
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function accountsOfType(typeIds: number[]): GLAccount[] {
    return glAccounts.filter((a) => typeIds.includes(a.type?.id ?? 0));
  }

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
      accountingRule: f.accountingRule,
      locale: "en",
    };
    if (f.description.trim()) body.description = f.description.trim();
    if (f.minRequiredOpeningBalance !== null) {
      body.minRequiredOpeningBalance = f.minRequiredOpeningBalance;
    }
    if (f.withdrawalFeeForTransfers) body.withdrawalFeeForTransfers = true;
    if (f.allowOverdraft) body.allowOverdraft = true;

    // GL account mappings — only sent for Cash accounting (rule 2).
    if (f.accountingRule === 2) {
      const mappings = {
        savingsControlAccountId: f.savingsControlAccountId,
        savingsReferenceAccountId: f.savingsReferenceAccountId,
        interestOnSavingsAccountId: f.interestOnSavingsAccountId,
        incomeFromFeeAccountId: f.incomeFromFeeAccountId,
      };
      for (const [key, val] of Object.entries(mappings)) {
        if (val !== null && val !== undefined) body[key] = val;
      }
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
            <Sel label="Accounting" code="accountingRule"
              value={String(f.accountingRule)}
              onChange={(v) => update("accountingRule", Number(v))}
              options={[
                ["1", "None (no GL postings)"],
                ["2", "Cash (real-time GL postings)"],
              ]}
              hint={f.accountingRule === 1
                ? "Transactions don't post to general ledger."
                : "Transactions post to GL accounts mapped below."} />
          </div>
        </section>

        {/* === GL account mappings — only when accounting != None === */}
        {f.accountingRule === 2 && (
          <section className="field-group">
            <div>
              <div className="field-group-title">GL account mappings</div>
              <div className="field-group-hint">
                Cash accounting — required mappings. {glAccounts.length > 0
                  ? "Pick from your chart of accounts."
                  : "No GL accounts found. Create them first under Accounting → Chart of accounts."}
              </div>
            </div>
            <div className="field-grid">
              <GLAccountField label="Savings control" code="savingsControlAccountId"
                value={f.savingsControlAccountId} onChange={(v) => update("savingsControlAccountId", v)}
                accounts={accountsOfType([TYPE_LIABILITY])}
                hint="Liability. Customer deposits balance." />
              <GLAccountField label="Savings reference" code="savingsReferenceAccountId"
                value={f.savingsReferenceAccountId} onChange={(v) => update("savingsReferenceAccountId", v)}
                accounts={accountsOfType([TYPE_ASSET])}
                hint="Asset. Cash backing the deposits." />
              <GLAccountField label="Interest on savings" code="interestOnSavingsAccountId"
                value={f.interestOnSavingsAccountId} onChange={(v) => update("interestOnSavingsAccountId", v)}
                accounts={accountsOfType([TYPE_EXPENSE])}
                hint="Expense. Interest paid to customers." />
              <GLAccountField label="Income from fees" code="incomeFromFeeAccountId"
                value={f.incomeFromFeeAccountId} onChange={(v) => update("incomeFromFeeAccountId", v)}
                accounts={accountsOfType([TYPE_INCOME])}
                hint="Income. Fees on savings accounts." />
            </div>
          </section>
        )}

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

function GLAccountField(p: {
  label: string;
  code: string;
  value: number | null;
  onChange: (v: number | null) => void;
  accounts: GLAccount[];
  hint?: string;
}) {
  return (
    <div className="field">
      <label className="field-label">
        {p.label}<span className="field-label-code">{p.code}</span>
      </label>
      <select
        value={p.value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          p.onChange(v === "" ? null : Number(v));
        }}
        required
      >
        <option value="">— Pick an account —</option>
        {p.accounts.map((a) => (
          <option key={a.id} value={String(a.id)}>
            {a.glCode} · {a.name}
          </option>
        ))}
      </select>
      {p.hint && <div className="field-hint">{p.hint}</div>}
    </div>
  );
}
