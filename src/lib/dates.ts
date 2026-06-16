// Date helpers — Fineract's request bodies want dd MMMM yyyy strings
// (e.g. "15 June 2026"). HTML <input type="date"> gives us yyyy-MM-dd
// strings. These two helpers convert between them.

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-06-15" → "15 June 2026". Empty input → empty output. */
export function toFineractDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

/** [2026, 6, 15] (Fineract response format) → "15 Jun 2026". */
export function fmtFineractArray(arr: number[] | undefined): string {
  if (!arr || arr.length < 3) return "—";
  const [y, m, d] = arr;
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
}

/** Today as yyyy-MM-dd, for default values on date inputs. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** N days ago / from now, as yyyy-MM-dd. */
export function offsetDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
