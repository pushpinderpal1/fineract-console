"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { fineract, formatError } from "@/lib/fineract";
import { todayIso, toFineractDate } from "@/lib/dates";

type Client = { id: number; displayName: string };
type SavingsProduct = { id: number; name: string; shortName: string };

type Form = {
  clientId: string;
  productId: string;
  submittedOnDate: string;     // yyyy-MM-dd
  activate: boolean;            // activate immediately?
  activationDate: string;
};

export default function NewSavingsAccountPage() {
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
    submittedOnDate: todayIso(),
    activate: true,
    activationDate: todayIso(),
  });
  const [clients, setClients] = useState<Client[] | null>(null);
  const [products, setProducts] = useState<SavingsProduct[] | null>(null);
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
          fineract<SavingsProduct[]>({ method: "GET", path: "/savingsproducts" }),
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.clientId || !f.productId) {
      setErr({ title: "Missing", detail: "Pick a client and a savings product." });
      return;
    }
    setSubmitting(true);
    setErr(null);
    setSuccess(null);

    try {
      // Step 1 — create the savings account (submitted state)
      const created = await fineract<{ resourceId?: number; savingsId?: number }>({
        method: "POST",
        path: "/savingsaccounts",
        body: {
          clientId: Number(f.clientId),
          productId: Number(f.productId),
          submittedOnDate: toFineractDate(f.submittedOnDate),
          locale: "en",
          dateFormat: "dd MMMM yyyy",
        },
      });
      const accountId = created.savingsId ?? created.resourceId ?? 0;

      // Step 2 — approve and activate if requested. Fineract requires
      // separate command calls for approve → activate.
      if (f.activate && accountId) {
        await fineract({
          method: "POST",
          path: `/savingsaccounts/${accountId}?command=approve`,
          body: {
            approvedOnDate: toFineractDate(f.activationDate),
            locale: "en",
            dateFormat: "dd MMMM yyyy",
          },
        });
        await fineract({
          method: "POST",
          path: `/savingsaccounts/${accountId}?command=activate`,
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
          <div className="page-eyebrow">POST /savingsaccounts</div>
          <h1 className="page-title">Open savings account</h1>
          <p className="page-sub">
            Opens a deposit account for a client based on a savings product. Approving and activating happen in one step if selected.
          </p>
        </div>
      </header>

      {success && (
        <div className="alert alert-good">
          <div className="alert-label">Opened · account {success.accountId}</div>
          <div>The savings account is ready. Deposit funds to give it a balance, then it can be used as loan collateral.</div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={() => router.push(`/savings-accounts/${success.accountId}`)}>
              Open account
            </button>
            <button className="btn btn-ghost"
              onClick={() => { setSuccess(null); setF({ ...f, productId: "" }); }}>
              Open another
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
            <div className="field-group-hint">Client owning the account, and product to use.</div>
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
              <label className="field-label">Savings product<span className="field-label-code">productId</span></label>
              <select value={f.productId} onChange={(e) => update("productId", e.target.value)} required>
                <option value="">{products === null ? "Loading…" : "— Pick a product —"}</option>
                {products?.map((p) => (
                  <option key={p.id} value={String(p.id)}>{p.shortName} · {p.name}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="field-group">
          <div>
            <div className="field-group-title">Activation</div>
            <div className="field-group-hint">Active accounts accept deposits and withdrawals immediately.</div>
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
            {submitting ? "Opening…" : "Open account"}
          </button>
        </div>
      </form>
    </AppShell>
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
