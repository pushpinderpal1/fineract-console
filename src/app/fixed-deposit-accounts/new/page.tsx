"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { fineract, formatError } from "@/lib/fineract";
import { todayIso, toFineractDate } from "@/lib/dates";

type Client = { id: number; displayName: string };

type FdProduct = {
  id: number;
  name: string;
  shortName: string;
  nominalAnnualInterestRate?: number;
  minDepositTerm?: number;
  minDepositTermType?: { id?: number; value?: string };
  maxDepositTerm?: number;
  maxDepositTermType?: { id?: number; value?: string };
  minDepositAmount?: number;
  maxDepositAmount?: number;
};

type Form = {
  clientId: string;
  productId: string;
  depositAmount: number;
  depositPeriod: number;
  depositPeriodFrequencyId: number;  // 1=Days, 2=Weeks, 3=Months, 4=Years
  submittedOnDate: string;
  activate: boolean;
  activationDate: string;
};

export default function NewFdAccountPage() {
  return (
    <Suspense fallback={<AppShell><div className="page">Loading…</div></AppShell>}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const preselectClientId = sp.get("clientId") ?? "";

  const [f, setF] = useState<Form>({
    clientId: preselectClientId,
    productId: "",
    depositAmount: 10000,
    depositPeriod: 12,
    depositPeriodFrequencyId: 3,
    submittedOnDate: todayIso(),
    activate: true,
    activationDate: todayIso(),
  });
  const [clients, setClients] = useState<Client[] | null>(null);
  const [products, setProducts] = useState<FdProduct[] | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<FdProduct | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ accountId: number } | null>(null);
  const [err, setErr] = useState<{ title: string; detail: string; raw?: string } | null>(null);

  function update<K extends keyof Form>(k: K, v: Form[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, p] = await Promise.all([
          fineract<{ pageItems?: Client[] } | Client[]>({ method: "GET", path: "/clients?limit=500" }),
          fineract<FdProduct[]>({ method: "GET", path: "/fixeddepositproducts" }),
        ]);
        if (!cancelled) {
          setClients(Array.isArray(c) ? c : c.pageItems ?? []);
          setProducts(Array.isArray(p) ? p : []);
        }
      } catch (e) {
        if (!cancelled) setErr(formatError(e));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // When product changes, fetch the full detail to seed sensible defaults.
  async function onProductSelect(idStr: string) {
    update("productId", idStr);
    if (!idStr) {
      setSelectedProduct(null);
      return;
    }
    try {
      const d = await fineract<FdProduct>({
        method: "GET",
        path: `/fixeddepositproducts/${idStr}`,
      });
      setSelectedProduct(d);
      setF((prev) => ({
        ...prev,
        productId: idStr,
        depositAmount: d.minDepositAmount ?? prev.depositAmount,
        depositPeriod: d.minDepositTerm ?? prev.depositPeriod,
        depositPeriodFrequencyId: d.minDepositTermType?.id ?? prev.depositPeriodFrequencyId,
      }));
    } catch {
      // Non-fatal — user proceeds with manual values
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.clientId || !f.productId) {
      setErr({ title: "Missing", detail: "Pick a client and a fixed deposit product." });
      return;
    }
    setSubmitting(true);
    setErr(null);
    setSuccess(null);

    try {
      // Step 1 — create the FD account in submitted state
      const created = await fineract<{ resourceId?: number; savingsId?: number }>({
        method: "POST",
        path: "/fixeddepositaccounts",
        body: {
          clientId: Number(f.clientId),
          productId: Number(f.productId),
          depositAmount: f.depositAmount,
          depositPeriod: f.depositPeriod,
          depositPeriodFrequencyId: f.depositPeriodFrequencyId,
          submittedOnDate: toFineractDate(f.submittedOnDate),
          locale: "en",
          dateFormat: "dd MMMM yyyy",
        },
      });
      const accountId = created.savingsId ?? created.resourceId ?? 0;

      // Step 2 — approve + activate if requested (FD accounts follow a
      // similar lifecycle to savings: submitted → approved → activated)
      if (f.activate && accountId) {
        await fineract({
          method: "POST",
          path: `/fixeddepositaccounts/${accountId}?command=approve`,
          body: {
            approvedOnDate: toFineractDate(f.activationDate),
            locale: "en",
            dateFormat: "dd MMMM yyyy",
          },
        });
        await fineract({
          method: "POST",
          path: `/fixeddepositaccounts/${accountId}?command=activate`,
          body: {
            activatedOnDate: toFineractDate(f.activationDate),
            locale: "en",
            dateFormat: "dd MMMM yyyy",
          },
        });
      }

      setSuccess({ accountId });
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
          <div className="page-eyebrow">POST /fixeddepositaccounts</div>
          <h1 className="page-title">Open fixed deposit</h1>
          <p className="page-sub">
            Customer commits a lump sum for the agreed term. The maturity amount is calculated automatically from the product&apos;s rate and the term you pick.
          </p>
        </div>
      </header>

      {success && (
        <div className="alert alert-good">
          <div className="alert-label">Opened · FD account {success.accountId}</div>
          <div>The fixed deposit is now active and locked for the agreed term. It can be referenced as loan collateral.</div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={() => router.push(`/fixed-deposit-accounts/${success.accountId}`)}>
              Open FD
            </button>
            <button className="btn btn-ghost" onClick={() => router.push(`/loans/new?clientId=${f.clientId}`)}>
              Create loan against this client
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
            <div className="field-group-hint">Client owning the FD, and the product to use.</div>
          </div>
          <div className="field-grid">
            <div className="field">
              <label className="field-label">Client<span className="field-label-code">clientId</span></label>
              <select value={f.clientId} onChange={(e) => update("clientId", e.target.value)} required>
                <option value="">{clients === null ? "Loading…" : "— Pick a client —"}</option>
                {clients?.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.displayName}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label">FD product<span className="field-label-code">productId</span></label>
              <select value={f.productId} onChange={(e) => onProductSelect(e.target.value)} required>
                <option value="">{products === null ? "Loading…" : "— Pick a product —"}</option>
                {products?.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.shortName} · {p.name} ({p.nominalAnnualInterestRate}% p.a.)
                  </option>
                ))}
              </select>
              {selectedProduct && (
                <div className="field-hint">
                  Term: {selectedProduct.minDepositTerm} {selectedProduct.minDepositTermType?.value} to{" "}
                  {selectedProduct.maxDepositTerm ?? "∞"} {selectedProduct.maxDepositTermType?.value ?? ""}
                  {" · "}
                  Min deposit: {selectedProduct.minDepositAmount?.toLocaleString() ?? "any"}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="field-group">
          <div>
            <div className="field-group-title">Deposit</div>
            <div className="field-group-hint">Amount and term.</div>
          </div>
          <div className="field-grid">
            <Num label="Deposit amount" code="depositAmount" value={f.depositAmount}
              onChange={(v) => update("depositAmount", v)} min={0} />
            <Num label="Term" code="depositPeriod" value={f.depositPeriod}
              onChange={(v) => update("depositPeriod", v)} min={1} />
            <Sel label="Term unit" code="depositPeriodFrequencyId"
              value={String(f.depositPeriodFrequencyId)}
              onChange={(v) => update("depositPeriodFrequencyId", Number(v))}
              options={[ ["1", "Days"], ["2", "Weeks"], ["3", "Months"], ["4", "Years"] ]} />
          </div>
        </section>

        <section className="field-group">
          <div>
            <div className="field-group-title">Activation</div>
            <div className="field-group-hint">Active FDs are locked in and start accruing interest.</div>
          </div>
          <div className="field-grid">
            <Date_ label="Submitted" code="submittedOnDate" value={f.submittedOnDate}
              onChange={(v) => update("submittedOnDate", v)} />
            <div className="field">
              <label className="field-label">
                Activate now<span className="field-label-code">approve+activate</span>
              </label>
              <select value={f.activate ? "true" : "false"}
                onChange={(e) => update("activate", e.target.value === "true")}>
                <option value="true">Yes — approve and activate</option>
                <option value="false">No — leave in submitted state</option>
              </select>
            </div>
            {f.activate && (
              <Date_ label="Activation date" code="activationDate" value={f.activationDate}
                onChange={(v) => update("activationDate", v)} />
            )}
          </div>
        </section>

        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Opening…" : "Open FD"}
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
        {p.label}<span className="field-label-code">{p.code}</span>
      </label>
      <input type="number" value={p.value}
        onChange={(e) => p.onChange(Number(e.target.value))}
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
        {p.label}<span className="field-label-code">{p.code}</span>
      </label>
      <select value={p.value} onChange={(e) => p.onChange(e.target.value)}>
        {p.options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
    </div>
  );
}

function Date_(p: { label: string; code: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label className="field-label">{p.label}<span className="field-label-code">{p.code}</span></label>
      <input type="date" value={p.value} onChange={(e) => p.onChange(e.target.value)} />
    </div>
  );
}
