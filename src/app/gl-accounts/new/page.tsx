"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { fineract, formatError } from "@/lib/fineract";

// Fineract account type codes
const TYPE_ASSET = 1;
const TYPE_LIABILITY = 2;
const TYPE_EQUITY = 3;
const TYPE_INCOME = 4;
const TYPE_EXPENSE = 5;

// Usage: 1 = DETAIL (postable), 2 = HEADER (grouping)
const USAGE_DETAIL = 1;

type Form = {
  name: string;
  glCode: string;
  type: number;
  usage: number;
  manualEntriesAllowed: boolean;
  description: string;
};

const initial: Form = {
  name: "",
  glCode: "",
  type: TYPE_ASSET,
  usage: USAGE_DETAIL,
  manualEntriesAllowed: true,
  description: "",
};

// A minimal but real chart of accounts for a microfinance institution
// running loan + savings products. Lets users bulk-create the foundation
// in one click before remapping product accounting rules.
type SeedAccount = { name: string; glCode: string; type: number; description: string };

const SEED: SeedAccount[] = [
  // Assets
  { glCode: "1001", name: "Cash on hand", type: TYPE_ASSET, description: "Liquid cash for disbursements and deposits" },
  { glCode: "1101", name: "Loan portfolio", type: TYPE_ASSET, description: "Outstanding principal on customer loans" },
  { glCode: "1201", name: "Interest receivable", type: TYPE_ASSET, description: "Accrued but uncollected interest" },
  { glCode: "1301", name: "Fees receivable", type: TYPE_ASSET, description: "Accrued but uncollected fees" },

  // Liabilities
  { glCode: "2001", name: "Customer deposits", type: TYPE_LIABILITY, description: "Customer savings balances payable" },
  { glCode: "2101", name: "Suspense — transfers", type: TYPE_LIABILITY, description: "Funds awaiting allocation" },
  { glCode: "2201", name: "Overpayment liability", type: TYPE_LIABILITY, description: "Customer overpayments to refund" },

  // Income
  { glCode: "4001", name: "Interest on loans", type: TYPE_INCOME, description: "Interest income from loan portfolio" },
  { glCode: "4101", name: "Loan fees", type: TYPE_INCOME, description: "Origination and service fees" },
  { glCode: "4201", name: "Loan penalties", type: TYPE_INCOME, description: "Late payment penalties" },
  { glCode: "4301", name: "Loan recovery", type: TYPE_INCOME, description: "Recoveries on written-off loans" },

  // Expense
  { glCode: "5001", name: "Loan write-offs", type: TYPE_EXPENSE, description: "Principal written off as uncollectable" },
  { glCode: "5101", name: "Interest on deposits", type: TYPE_EXPENSE, description: "Interest paid to customers on savings" },
];

export default function NewGLAccountPage() {
  const router = useRouter();
  const [f, setF] = useState<Form>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [success, setSuccess] = useState<{ resourceId: number } | null>(null);
  const [seedResults, setSeedResults] = useState<{ created: number; failed: string[] } | null>(null);
  const [err, setErr] = useState<{ title: string; detail: string; raw?: string } | null>(null);

  function update<K extends keyof Form>(k: K, v: Form[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  function buildBody(account: { name: string; glCode: string; type: number; description?: string; usage?: number; manualEntriesAllowed?: boolean }): Record<string, unknown> {
    return {
      name: account.name,
      glCode: account.glCode,
      type: account.type,
      usage: account.usage ?? USAGE_DETAIL,
      manualEntriesAllowed: account.manualEntriesAllowed ?? true,
      description: account.description,
    };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    setSuccess(null);
    try {
      const data = await fineract<{ resourceId: number }>({
        method: "POST",
        path: "/glaccounts",
        body: buildBody({
          name: f.name,
          glCode: f.glCode,
          type: f.type,
          description: f.description.trim() || undefined,
          usage: f.usage,
          manualEntriesAllowed: f.manualEntriesAllowed,
        }),
      });
      setSuccess({ resourceId: data.resourceId });
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function createSeedSet() {
    setSeeding(true);
    setErr(null);
    setSeedResults(null);
    const failed: string[] = [];
    let created = 0;
    for (const account of SEED) {
      try {
        await fineract({
          method: "POST",
          path: "/glaccounts",
          body: buildBody(account),
        });
        created++;
      } catch (e) {
        const f = formatError(e);
        failed.push(`${account.glCode} ${account.name}: ${f.detail.split("\n")[0]}`);
      }
    }
    setSeedResults({ created, failed });
    setSeeding(false);
  }

  return (
    <AppShell>
      <header className="page-head">
        <div>
          <div className="page-eyebrow">POST /glaccounts</div>
          <h1 className="page-title">New GL account</h1>
          <p className="page-sub">
            Single account in the chart of accounts, or use the bulk-create helper to
            populate a starter chart for a microfinance institution.
          </p>
        </div>
      </header>

      {/* Seed helper card */}
      <div className="alert" style={{
        borderLeftColor: "var(--signal)",
        background: "rgba(232, 184, 60, 0.06)",
        marginBottom: 24,
      }}>
        <div className="alert-label" style={{ color: "var(--signal-hover)" }}>
          Quick start
        </div>
        <div style={{ marginBottom: 12 }}>
          Create a minimal chart of accounts for loan + savings operations:
          {" "}
          <strong>{SEED.length} accounts</strong> covering cash, loan portfolio,
          customer deposits, interest income, fees, write-offs, etc. Skips any code
          that already exists.
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={createSeedSet}
          disabled={seeding}
        >
          {seeding ? `Creating… (${SEED.length} accounts)` : `Create ${SEED.length} starter accounts`}
        </button>
      </div>

      {seedResults && (
        <div className={`alert ${seedResults.failed.length === 0 ? "alert-good" : "alert-bad"}`}>
          <div className="alert-label">
            {seedResults.created} created
            {seedResults.failed.length > 0 && ` · ${seedResults.failed.length} skipped/failed`}
          </div>
          {seedResults.failed.length > 0 && (
            <details>
              <summary style={{ cursor: "pointer", marginTop: 8, fontSize: 12 }}>
                Skipped/failed details
              </summary>
              <ul style={{ marginTop: 8, paddingLeft: 18, fontSize: 12 }}>
                {seedResults.failed.map((line, i) => <li key={i}>{line}</li>)}
              </ul>
            </details>
          )}
          <div style={{ marginTop: 12 }}>
            <button
              className="btn btn-ghost"
              onClick={() => router.push("/gl-accounts")}
            >
              View chart of accounts
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="alert alert-good">
          <div className="alert-label">Created · resource {success.resourceId}</div>
          <div>The GL account is in the chart of accounts.</div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={() => router.push("/gl-accounts")}>
              View chart of accounts
            </button>
            <button className="btn btn-ghost"
              onClick={() => { setSuccess(null); setF(initial); }}>
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
        </div>
      )}

      <h2 style={{ marginTop: 32, marginBottom: 16, fontSize: 16, fontWeight: 500 }}>
        Or create one manually
      </h2>

      <form className="form" onSubmit={submit}>
        <section className="field-group">
          <div>
            <div className="field-group-title">Identity</div>
            <div className="field-group-hint">Display name and GL code.</div>
          </div>
          <div className="field-grid">
            <Text label="Name" code="name" value={f.name}
              onChange={(v) => update("name", v)} required />
            <Text label="GL code" code="glCode" value={f.glCode}
              onChange={(v) => update("glCode", v)} required
              hint="Unique numeric code (e.g. 1001 for assets)." />
          </div>
        </section>

        <section className="field-group">
          <div>
            <div className="field-group-title">Classification</div>
            <div className="field-group-hint">Where this account sits in the chart.</div>
          </div>
          <div className="field-grid">
            <Sel label="Type" code="type" value={String(f.type)}
              onChange={(v) => update("type", Number(v))}
              options={[
                [String(TYPE_ASSET), "Asset"],
                [String(TYPE_LIABILITY), "Liability"],
                [String(TYPE_EQUITY), "Equity"],
                [String(TYPE_INCOME), "Income"],
                [String(TYPE_EXPENSE), "Expense"],
              ]} />
            <Sel label="Usage" code="usage" value={String(f.usage)}
              onChange={(v) => update("usage", Number(v))}
              options={[
                [String(USAGE_DETAIL), "Detail (accepts transactions)"],
                ["2", "Header (grouping only)"],
              ]} />
            <Sel label="Manual entries" code="manualEntriesAllowed"
              value={f.manualEntriesAllowed ? "true" : "false"}
              onChange={(v) => update("manualEntriesAllowed", v === "true")}
              options={[
                ["true", "Allowed"],
                ["false", "Disallowed"],
              ]} />
          </div>
        </section>

        <section className="field-group">
          <div>
            <div className="field-group-title">Description</div>
            <div className="field-group-hint">Optional notes about the account's purpose.</div>
          </div>
          <div className="field-grid">
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label className="field-label">
                Description<span className="field-label-code">description</span>
              </label>
              <textarea
                value={f.description}
                onChange={(e) => update("description", e.target.value)}
                rows={3}
                style={{
                  fontFamily: "var(--font-body)", fontSize: 14,
                  padding: "8px 12px",
                  border: "1px solid var(--rule)",
                  background: "white", color: "var(--ink)",
                  borderRadius: 0, width: "100%", resize: "vertical",
                }}
              />
            </div>
          </div>
        </section>

        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Creating…" : "Create account"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setF(initial)} disabled={submitting}>
            Reset
          </button>
        </div>
      </form>
    </AppShell>
  );
}

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

function Sel(p: {
  label: string; code: string; value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <div className="field">
      <label className="field-label">
        {p.label}<span className="field-label-code">{p.code}</span>
      </label>
      <select value={p.value} onChange={(e) => p.onChange(e.target.value)}>
        {p.options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
    </div>
  );
}
