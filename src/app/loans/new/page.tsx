"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { fineract, formatError } from "@/lib/fineract";
import { offsetDaysIso, todayIso, toFineractDate } from "@/lib/dates";

type Client = { id: number; displayName: string; status?: { code?: string } };
type Product = {
  id: number;
  name: string;
  shortName: string;
  principal?: number;
  numberOfRepayments?: number;
  repaymentEvery?: number;
  repaymentFrequencyType?: { id?: number };
  interestRatePerPeriod?: number;
  interestRateFrequencyType?: { id?: number };
  amortizationType?: { id?: number };
  interestType?: { id?: number };
  interestCalculationPeriodType?: { id?: number };
  transactionProcessingStrategyCode?: string;
};
type Staff = { id: number; displayName: string };

type Form = {
  clientId: string;
  productId: string;
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
  loanOfficerId: string;          // "" = none
  submittedOnDate: string;        // yyyy-MM-dd
  expectedDisbursementDate: string;
};

const initial: Form = {
  clientId: "",
  productId: "",
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
  loanOfficerId: "",
  submittedOnDate: todayIso(),
  expectedDisbursementDate: offsetDaysIso(1),  // tomorrow, must be ≥ submittedOnDate
};

export default function NewLoanPage() {
  return (
    <Suspense fallback={<AppShell><div className="page">Loading…</div></AppShell>}>
      <NewLoanInner />
    </Suspense>
  );
}

function NewLoanInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectClientId = searchParams.get("clientId") ?? "";

  const [f, setF] = useState<Form>({ ...initial, clientId: preselectClientId });
  const [clients, setClients] = useState<Client[] | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ loanId: number } | null>(null);
  const [err, setErr] = useState<{ title: string; detail: string; raw?: string } | null>(null);

  function update<K extends keyof Form>(k: K, v: Form[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  // Load clients, products, staff in parallel.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, p, s] = await Promise.all([
          fineract<{ pageItems?: Client[] } | Client[]>({ method: "GET", path: "/clients?limit=500" }),
          fineract<Product[]>({ method: "GET", path: "/loanproducts" }),
          fineract<Staff[]>({ method: "GET", path: "/staff?status=active" }).catch(() => []),
        ]);
        if (!cancelled) {
          setClients(Array.isArray(c) ? c : c.pageItems ?? []);
          setProducts(Array.isArray(p) ? p : []);
          setStaff(Array.isArray(s) ? s : []);
        }
      } catch (e) {
        if (!cancelled) {
          const fe = formatError(e);
          setErr(fe);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // When a product is picked, fetch its details and prefill scheduling fields.
  async function onProductSelect(idStr: string) {
    update("productId", idStr);
    if (!idStr) return;
    try {
      const d = await fineract<Product>({ method: "GET", path: `/loanproducts/${idStr}` });
      setF((prev) => ({
        ...prev,
        productId: idStr,
        principal: d.principal ?? prev.principal,
        numberOfRepayments: d.numberOfRepayments ?? prev.numberOfRepayments,
        repaymentEvery: d.repaymentEvery ?? prev.repaymentEvery,
        repaymentFrequencyType: d.repaymentFrequencyType?.id ?? prev.repaymentFrequencyType,
        interestRatePerPeriod: d.interestRatePerPeriod ?? prev.interestRatePerPeriod,
        interestRateFrequencyType: d.interestRateFrequencyType?.id ?? prev.interestRateFrequencyType,
        amortizationType: d.amortizationType?.id ?? prev.amortizationType,
        interestType: d.interestType?.id ?? prev.interestType,
        interestCalculationPeriodType: d.interestCalculationPeriodType?.id ?? prev.interestCalculationPeriodType,
        transactionProcessingStrategyCode:
          d.transactionProcessingStrategyCode ?? prev.transactionProcessingStrategyCode,
      }));
    } catch {
      // Non-fatal — the user can still proceed with manual values.
    }
  }

  function buildBody(): Record<string, unknown> {
    const body: Record<string, unknown> = {
      clientId: Number(f.clientId),
      productId: Number(f.productId),
      principal: f.principal,
      loanTermFrequency: f.numberOfRepayments * f.repaymentEvery,
      loanTermFrequencyType: f.repaymentFrequencyType,
      numberOfRepayments: f.numberOfRepayments,
      repaymentEvery: f.repaymentEvery,
      repaymentFrequencyType: f.repaymentFrequencyType,
      interestRatePerPeriod: f.interestRatePerPeriod,
      interestType: f.interestType,
      interestCalculationPeriodType: f.interestCalculationPeriodType,
      amortizationType: f.amortizationType,
      transactionProcessingStrategyCode: f.transactionProcessingStrategyCode,
      expectedDisbursementDate: toFineractDate(f.expectedDisbursementDate),
      submittedOnDate: toFineractDate(f.submittedOnDate),
      loanType: "individual",
      locale: "en",
      dateFormat: "dd MMMM yyyy",
    };
    if (f.loanOfficerId) body.loanOfficerId = Number(f.loanOfficerId);
    return body;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.clientId || !f.productId) {
      setErr({ title: "Missing", detail: "Pick a client and a loan product." });
      return;
    }
    setSubmitting(true);
    setErr(null);
    setSuccess(null);
    try {
      const data = await fineract<{ loanId?: number; resourceId?: number }>({
        method: "POST",
        path: "/loans",
        body: buildBody(),
      });
      setSuccess({ loanId: data.loanId ?? data.resourceId ?? 0 });
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
          <div className="page-eyebrow">POST /loans</div>
          <h1 className="page-title">New loan</h1>
          <p className="page-sub">
            Originate a loan against a client and product. The loan is created in <em>submitted</em> state — approve and disburse it from the loan detail page.
          </p>
        </div>
      </header>

      {success && (
        <div className="alert alert-good">
          <div className="alert-label">Created · loan {success.loanId}</div>
          <div>The loan is now in submitted state. Approve and disburse it from the detail page.</div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={() => router.push(`/loans/${success.loanId}`)}>
              Open loan
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => { setSuccess(null); setF({ ...initial, clientId: f.clientId }); }}
            >
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
            <div className="field-group-title">Who and what</div>
            <div className="field-group-hint">Pick the client and the product to use as a template.</div>
          </div>
          <div className="field-grid">
            <div className="field">
              <label className="field-label">
                Client
                <span className="field-label-code">clientId</span>
              </label>
              <select value={f.clientId} onChange={(e) => update("clientId", e.target.value)} required>
                <option value="">{clients === null ? "Loading…" : "— Pick a client —"}</option>
                {clients?.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.displayName}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label">
                Loan product
                <span className="field-label-code">productId</span>
              </label>
              <select value={f.productId} onChange={(e) => onProductSelect(e.target.value)} required>
                <option value="">{products === null ? "Loading…" : "— Pick a product —"}</option>
                {products?.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.shortName} · {p.name}
                  </option>
                ))}
              </select>
              <div className="field-hint">Selecting a product prefills the schedule below.</div>
            </div>
          </div>
        </section>

        <section className="field-group">
          <div>
            <div className="field-group-title">Terms</div>
            <div className="field-group-hint">Defaults from the product. Override for this specific loan if needed.</div>
          </div>
          <div className="field-grid">
            <Num label="Principal" code="principal" value={f.principal}
              onChange={(v) => update("principal", v)} min={0} />
            <Num label="Repayments" code="numberOfRepayments" value={f.numberOfRepayments}
              onChange={(v) => update("numberOfRepayments", v)} min={1} />
            <Num label="Every" code="repaymentEvery" value={f.repaymentEvery}
              onChange={(v) => update("repaymentEvery", v)} min={1} />
            <Sel label="Frequency" code="repaymentFrequencyType"
              value={String(f.repaymentFrequencyType)}
              onChange={(v) => update("repaymentFrequencyType", Number(v))}
              options={[ ["0", "Days"], ["1", "Weeks"], ["2", "Months"] ]} />
            <Num label="Rate" code="interestRatePerPeriod" value={f.interestRatePerPeriod}
              onChange={(v) => update("interestRatePerPeriod", v)} step="0.01" />
            <Sel label="Rate frequency" code="interestRateFrequencyType"
              value={String(f.interestRateFrequencyType)}
              onChange={(v) => update("interestRateFrequencyType", Number(v))}
              options={[ ["2", "Per month"], ["3", "Per year"] ]} />
          </div>
        </section>

        <section className="field-group">
          <div>
            <div className="field-group-title">Schedule</div>
            <div className="field-group-hint">When the loan is submitted and expected to disburse.</div>
          </div>
          <div className="field-grid">
            <DateField label="Submitted" code="submittedOnDate" value={f.submittedOnDate}
              onChange={(v) => update("submittedOnDate", v)} />
            <DateField label="Expected disbursement" code="expectedDisbursementDate"
              value={f.expectedDisbursementDate}
              onChange={(v) => update("expectedDisbursementDate", v)} />
            <div className="field">
              <label className="field-label">
                Loan officer
                <span className="field-label-code">loanOfficerId (optional)</span>
              </label>
              <select value={f.loanOfficerId} onChange={(e) => update("loanOfficerId", e.target.value)}>
                <option value="">{staff === null ? "Loading…" : "— Unassigned —"}</option>
                {staff?.map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.displayName}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Creating…" : "Submit loan application"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setF(initial)} disabled={submitting}>
            Reset
          </button>
        </div>
      </form>
    </AppShell>
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
      <input type="number" value={p.value} onChange={(e) => p.onChange(Number(e.target.value))}
        min={p.min} max={p.max} step={p.step} />
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
        {p.options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
    </div>
  );
}

function DateField(p: {
  label: string; code: string; value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <label className="field-label">
        {p.label}
        <span className="field-label-code">{p.code}</span>
      </label>
      <input type="date" value={p.value} onChange={(e) => p.onChange(e.target.value)} />
    </div>
  );
}
