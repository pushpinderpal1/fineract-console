"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { fineract, formatError } from "@/lib/fineract";
import { todayIso, toFineractDate } from "@/lib/dates";

type Office = { id: number; name: string };

type Form = {
  firstname: string;
  middlename: string;
  lastname: string;
  officeId: number;
  externalId: string;
  active: boolean;
  activationDate: string;     // yyyy-MM-dd from the date picker
  submittedOnDate: string;
  mobileNo: string;
};

const initial: Form = {
  firstname: "",
  middlename: "",
  lastname: "",
  officeId: 1,                 // Head office
  externalId: "",
  active: true,
  activationDate: todayIso(),
  submittedOnDate: todayIso(),
  mobileNo: "",
};

export default function NewClientPage() {
  const router = useRouter();
  const [f, setF] = useState<Form>(initial);
  const [offices, setOffices] = useState<Office[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ clientId: number } | null>(null);
  const [err, setErr] = useState<{ title: string; detail: string; raw?: string } | null>(null);

  function update<K extends keyof Form>(k: K, v: Form[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fineract<Office[]>({ method: "GET", path: "/offices" });
        if (!cancelled) {
          setOffices(data);
          if (data.length > 0 && !data.find((o) => o.id === f.officeId)) {
            setF((prev) => ({ ...prev, officeId: data[0].id }));
          }
        }
      } catch {
        if (!cancelled) setOffices([]);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildBody(): Record<string, unknown> {
    const body: Record<string, unknown> = {
      officeId: f.officeId,
      firstname: f.firstname.trim(),
      lastname: f.lastname.trim(),
      active: f.active,
      legalFormId: 1,                     // 1 = Person, 2 = Entity
      locale: "en",
      dateFormat: "dd MMMM yyyy",
      submittedOnDate: toFineractDate(f.submittedOnDate),
    };
    if (f.middlename.trim()) body.middlename = f.middlename.trim();
    if (f.externalId.trim()) body.externalId = f.externalId.trim();
    if (f.mobileNo.trim()) body.mobileNo = f.mobileNo.trim();
    if (f.active) body.activationDate = toFineractDate(f.activationDate);
    return body;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    setSuccess(null);
    try {
      const data = await fineract<{ clientId: number; resourceId: number }>({
        method: "POST",
        path: "/clients",
        body: buildBody(),
      });
      setSuccess({ clientId: data.clientId ?? data.resourceId });
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
          <div className="page-eyebrow">POST /clients</div>
          <h1 className="page-title">New client</h1>
          <p className="page-sub">A customer of the institution. Becomes eligible for loans once active.</p>
        </div>
      </header>

      {success && (
        <div className="alert alert-good">
          <div className="alert-label">Created · client {success.clientId}</div>
          <div>The client is now in the system.</div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={() => router.push(`/clients/${success.clientId}`)}>
              View client
            </button>
            <button className="btn btn-ghost" onClick={() => router.push("/loans/new")}>
              Create a loan for them
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => { setSuccess(null); setF(initial); }}
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
            <div className="field-group-title">Name</div>
            <div className="field-group-hint">Legal name on file.</div>
          </div>
          <div className="field-grid">
            <Text label="First name" code="firstname" value={f.firstname}
              onChange={(v) => update("firstname", v)} required />
            <Text label="Middle name" code="middlename" value={f.middlename}
              onChange={(v) => update("middlename", v)} />
            <Text label="Last name" code="lastname" value={f.lastname}
              onChange={(v) => update("lastname", v)} required />
          </div>
        </section>

        <section className="field-group">
          <div>
            <div className="field-group-title">Affiliation</div>
            <div className="field-group-hint">Branch and external reference.</div>
          </div>
          <div className="field-grid">
            <div className="field">
              <label className="field-label">
                Office
                <span className="field-label-code">officeId</span>
              </label>
              <select
                value={f.officeId}
                onChange={(e) => update("officeId", Number(e.target.value))}
              >
                {offices === null && <option>Loading…</option>}
                {offices?.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            <Text label="External ID" code="externalId" value={f.externalId}
              onChange={(v) => update("externalId", v)}
              hint="Optional reference code for integrations." />
            <Text label="Mobile" code="mobileNo" value={f.mobileNo}
              onChange={(v) => update("mobileNo", v)} />
          </div>
        </section>

        <section className="field-group">
          <div>
            <div className="field-group-title">Status</div>
            <div className="field-group-hint">Active clients can immediately have loans.</div>
          </div>
          <div className="field-grid">
            <div className="field">
              <label className="field-label">
                Active
                <span className="field-label-code">active</span>
              </label>
              <select
                value={f.active ? "true" : "false"}
                onChange={(e) => update("active", e.target.value === "true")}
              >
                <option value="true">Activate now</option>
                <option value="false">Pending (activate later)</option>
              </select>
            </div>
            {f.active && (
              <DateField label="Activation date" code="activationDate" value={f.activationDate}
                onChange={(v) => update("activationDate", v)} />
            )}
            <DateField label="Submitted" code="submittedOnDate" value={f.submittedOnDate}
              onChange={(v) => update("submittedOnDate", v)} />
          </div>
        </section>

        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Creating…" : "Create client"}
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
        {p.label}
        <span className="field-label-code">{p.code}</span>
      </label>
      <input value={p.value} onChange={(e) => p.onChange(e.target.value)} required={p.required} />
      {p.hint && <div className="field-hint">{p.hint}</div>}
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
