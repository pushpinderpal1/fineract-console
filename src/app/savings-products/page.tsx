"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { fineract, formatError } from "@/lib/fineract";

type SavingsProduct = {
  id: number;
  name: string;
  shortName: string;
  currency?: { code?: string };
  nominalAnnualInterestRate?: number;
  minRequiredOpeningBalance?: number;
};

export default function SavingsProductsPage() {
  const [products, setProducts] = useState<SavingsProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fineract<SavingsProduct[]>({
          method: "GET",
          path: "/savingsproducts",
        });
        if (!cancelled) setProducts(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) {
          const f = formatError(e);
          setError(`${f.title} — ${f.detail}`);
          setProducts([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <AppShell>
      <header className="page-head">
        <div>
          <div className="page-eyebrow">Inventory</div>
          <h1 className="page-title">Savings products</h1>
          <p className="page-sub">
            Templates for customer deposit accounts. Define interest, fees, and balance rules.
          </p>
        </div>
        <Link href="/savings-products/new" className="btn btn-primary" style={{ textDecoration: "none" }}>
          New product
        </Link>
      </header>

      {error && (
        <div className="alert alert-bad">
          <div className="alert-label">Could not load</div>
          <div>{error}</div>
        </div>
      )}

      <div className="table-card">
        <div className="table-head">
          <span>{products?.length ?? "—"} products</span>
          <span>GET /savingsproducts</span>
        </div>
        {products === null ? (
          <div className="empty-state">
            <div className="empty-state-eyebrow">Loading</div>
            Fetching from Fineract…
          </div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-eyebrow">No products yet</div>
            <p style={{ marginBottom: 16 }}>Create your first savings product to start opening deposit accounts.</p>
            <Link href="/savings-products/new" className="btn btn-primary" style={{ textDecoration: "none" }}>
              Create a product
            </Link>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 60 }}>ID</th>
                <th>Name</th>
                <th>Code</th>
                <th>Currency</th>
                <th style={{ textAlign: "right" }}>Interest rate</th>
                <th style={{ textAlign: "right" }}>Min opening</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.id}</td>
                  <td>{p.name}</td>
                  <td className="mono">{p.shortName}</td>
                  <td className="mono">{p.currency?.code ?? "—"}</td>
                  <td className="mono" style={{ textAlign: "right" }}>
                    {p.nominalAnnualInterestRate !== undefined
                      ? `${p.nominalAnnualInterestRate}%`
                      : "—"}
                  </td>
                  <td className="mono" style={{ textAlign: "right" }}>
                    {p.minRequiredOpeningBalance?.toLocaleString() ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
