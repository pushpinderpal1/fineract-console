/**
 * Loan amortization calculator.
 *
 * Mirrors the standard formulas Mifos/Fineract use when generating the
 * repayment schedule for a single-tranche loan with no charges. Designed
 * to let you verify what Mifos will produce before originating a real loan
 * against the same parameters.
 *
 * What this DOES handle:
 *  - Equal installments (declining-balance EMI) and equal-principal
 *  - Flat interest
 *  - Monthly / weekly / daily repayment frequencies
 *  - Per-month and per-year interest rate inputs
 *  - 360/364/365 days-in-year basis
 *  - Principal grace and interest grace
 *
 * What this does NOT handle (these would diverge from Mifos):
 *  - Interest recalculation after repayments
 *  - Charges, fees, penalties
 *  - Multi-tranche disbursement
 *  - Holiday / working-day adjustments
 *  - Variable installment amounts
 */

export type AmortizationType = "EQUAL_INSTALLMENTS" | "EQUAL_PRINCIPAL";
export type InterestMethod = "DECLINING_BALANCE" | "FLAT";
export type FrequencyType = "DAYS" | "WEEKS" | "MONTHS";
export type RateFrequencyType = "PER_MONTH" | "PER_YEAR";

export type SimInput = {
  principal: number;
  annualOrPeriodicRate: number;       // user-entered percent, e.g. 18 for 18%
  rateFrequency: RateFrequencyType;
  numberOfRepayments: number;
  repaymentEvery: number;             // e.g. 1 with MONTHS = monthly
  repaymentFrequency: FrequencyType;
  amortization: AmortizationType;
  interestMethod: InterestMethod;
  daysInYear: 360 | 364 | 365;
  daysInMonth: 30 | 0;                // 0 means "actual"
  graceOnPrincipalPayment: number;    // installments where no principal is paid
  graceOnInterestPayment: number;     // installments where no interest is paid
  graceOnInterestCharged: number;     // installments where interest doesn't even accrue
  disbursementDate: Date;
};

export type ScheduleRow = {
  installmentNumber: number;
  dueDate: Date;
  daysInPeriod: number;
  principalDue: number;
  interestDue: number;
  totalDue: number;
  balanceAfter: number;
};

export type SimResult = {
  rows: ScheduleRow[];
  totals: {
    totalPrincipal: number;
    totalInterest: number;
    totalPayment: number;
    emi: number | null;          // null if amortization is equal-principal (varies)
  };
  effectivePeriodicRate: number; // the per-period decimal rate actually used
};

/* ---------- Helpers ---------- */

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  // Preserve end-of-month behaviour roughly: take the original day, then
  // clamp into the target month if it overflows (e.g. Jan 31 + 1 month → Feb 28).
  const day = r.getDate();
  r.setDate(1);
  r.setMonth(r.getMonth() + n);
  const lastDay = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(day, lastDay));
  return r;
}

function nextDueDate(prev: Date, every: number, freq: FrequencyType): Date {
  if (freq === "DAYS") return addDays(prev, every);
  if (freq === "WEEKS") return addDays(prev, every * 7);
  return addMonths(prev, every);
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Convert the user's rate input into the per-installment decimal rate.
 *
 * Fineract's behaviour: when rate is "per year" and frequency is "months",
 * the per-period rate is annual / 12. The 360/365 days basis matters only
 * for daily interest accrual; for period-based interest (the common case),
 * the simple division is what Mifos does.
 */
function computePeriodicRate(input: SimInput): number {
  const annualPercent = input.rateFrequency === "PER_YEAR"
    ? input.annualOrPeriodicRate
    : input.annualOrPeriodicRate * 12;
  const annual = annualPercent / 100;

  // periods per year for the chosen frequency
  let periodsPerYear: number;
  if (input.repaymentFrequency === "MONTHS") periodsPerYear = 12 / input.repaymentEvery;
  else if (input.repaymentFrequency === "WEEKS") periodsPerYear = 52 / input.repaymentEvery;
  else periodsPerYear = input.daysInYear / input.repaymentEvery;

  return annual / periodsPerYear;
}

/**
 * EMI formula for equal installments + declining balance.
 *   EMI = P * r * (1+r)^n / ((1+r)^n - 1)
 * where r is the per-period rate and n is the number of installments.
 */
function calcEmi(principal: number, ratePerPeriod: number, n: number): number {
  if (ratePerPeriod === 0) return principal / n;
  const factor = Math.pow(1 + ratePerPeriod, n);
  return (principal * ratePerPeriod * factor) / (factor - 1);
}

/* ---------- Main entry ---------- */

export function simulate(input: SimInput): SimResult {
  const r = computePeriodicRate(input);
  const n = input.numberOfRepayments;
  const rows: ScheduleRow[] = [];

  let balance = input.principal;
  let prevDate = input.disbursementDate;

  // Pre-compute EMI for declining-balance + equal-installments.
  // Grace periods complicate this; for simplicity we use the base EMI
  // and let principal grace shift the principal portion to later installments.
  let emi: number | null = null;
  if (input.amortization === "EQUAL_INSTALLMENTS" && input.interestMethod === "DECLINING_BALANCE") {
    // Effective n excludes principal-grace periods since principal collected
    // happens over (n - graceOnPrincipalPayment) installments.
    const effectiveN = Math.max(1, n - input.graceOnPrincipalPayment);
    emi = calcEmi(input.principal, r, effectiveN);
  }

  // For flat interest, the total interest = P * r * n, distributed evenly.
  const flatInterestPerInstallment = input.interestMethod === "FLAT"
    ? (input.principal * r * n) / n   // = P * r per installment
    : 0;

  for (let i = 1; i <= n; i++) {
    const dueDate = nextDueDate(prevDate, input.repaymentEvery, input.repaymentFrequency);
    const daysInPeriod = daysBetween(prevDate, dueDate);

    let interestDue = 0;
    let principalDue = 0;

    // Interest calculation
    if (i <= input.graceOnInterestCharged) {
      interestDue = 0;
    } else if (input.interestMethod === "FLAT") {
      interestDue = flatInterestPerInstallment;
    } else {
      // Declining balance
      interestDue = balance * r;
    }

    // Interest grace — interest accrued but not collected this period.
    // For simplicity we treat interest grace the same as interest charged
    // (i.e. interest is not added to a separate accrual bucket).
    if (i <= input.graceOnInterestPayment) {
      interestDue = 0;
    }

    // Principal calculation
    if (i <= input.graceOnPrincipalPayment) {
      principalDue = 0;
    } else if (input.amortization === "EQUAL_PRINCIPAL") {
      const payingInstallments = Math.max(1, n - input.graceOnPrincipalPayment);
      principalDue = input.principal / payingInstallments;
    } else if (input.interestMethod === "FLAT") {
      // Flat: principal portion equals P / n (post-grace adjusted)
      const payingInstallments = Math.max(1, n - input.graceOnPrincipalPayment);
      principalDue = input.principal / payingInstallments;
    } else {
      // Declining balance + equal installments: principal = EMI - interest
      principalDue = (emi ?? 0) - interestDue;
    }

    // Clamp the final installment to fully pay off the balance (rounding).
    if (i === n) {
      principalDue = balance;
    }

    balance = balance - principalDue;
    if (Math.abs(balance) < 0.01) balance = 0;

    rows.push({
      installmentNumber: i,
      dueDate,
      daysInPeriod,
      principalDue: round2(principalDue),
      interestDue: round2(interestDue),
      totalDue: round2(principalDue + interestDue),
      balanceAfter: round2(Math.max(0, balance)),
    });

    prevDate = dueDate;
  }

  const totalPrincipal = round2(rows.reduce((s, x) => s + x.principalDue, 0));
  const totalInterest = round2(rows.reduce((s, x) => s + x.interestDue, 0));
  const totalPayment = round2(totalPrincipal + totalInterest);

  return {
    rows,
    totals: {
      totalPrincipal,
      totalInterest,
      totalPayment,
      emi: emi !== null ? round2(emi) : null,
    },
    effectivePeriodicRate: r,
  };
}
