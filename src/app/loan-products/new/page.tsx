"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { fineract, formatError } from "@/lib/fineract";

type Form = {
  // Identity
  name: string;
  shortName: string;
  description: string;
  externalId: string;
  startDate: string;        // dd MMMM yyyy or empty
  closeDate: string;        // dd MMMM yyyy or empty

  // Currency
  currencyCode: string;
  digitsAfterDecimal: number;

  // Schedule
  principal: number;
  minPrincipal: number | null;
  maxPrincipal: number | null;
  numberOfRepayments: number;
  minNumberOfRepayments: number | null;
  maxNumberOfRepayments: number | null;
  repaymentEvery: number;
  repaymentFrequencyType: number;

  // Interest
  interestRatePerPeriod: number;
  minInterestRatePerPeriod: number | null;
  maxInterestRatePerPeriod: number | null;
  interestRateFrequencyType: number;
  amortizationType: number;
  interestType: number;
  interestCalculationPeriodType: number;
  isInterestRecalculationEnabled: boolean;

  // Grace & tolerance (optional)
  graceOnPrincipalPayment: number | null;
  graceOnInterestPayment: number | null;
  graceOnArrearsAgeing: number | null;
  inArrearsTolerance: number | null;
  graceOnInterestCharged: number | null;

  // Processing
  transactionProcessingStrategyCode: string;
  daysInYearType: number;
  daysInMonthType: number;
  minimumDaysBetweenDisbursalAndFirstRepayment: number | null;
  allowPartialPeriodInterestCalculation: boolean;
  canDefineInstallmentAmount: boolean;
  multiDisburseLoan: boolean;
  maxTrancheCount: number | null;
  outstandingLoanBalance: number | null;

  // Accounting (None = 1, Cash = 2, Accrual-periodic = 3, Accrual-upfront = 4)
  accountingRule: number;
  // GL account mappings used when accountingRule != 1 (None)
  fundSourceAccountId: number | null;
  loanPortfolioAccountId: number | null;
  transfersInSuspenseAccountId: number | null;
  interestOnLoanAccountId: number | null;
  incomeFromFeeAccountId: number | null;
  incomeFromPenaltyAccountId: number | null;
  incomeFromRecoveryAccountId: number | null;
  writeOffAccountId: number | null;
  overpaymentLiabilityAccountId: number | null;
};

const initial: Form = {
  name: "Standard Microloan",
  shortName: "SML1",
  description: "",
  externalId: "",
  startDate: "",
  closeDate: "",

  currencyCode: "USD",
  digitsAfterDecimal: 2,

  principal: 10000,
  minPrincipal: null,
  maxPrincipal: null,
  numberOfRepayments: 12,
  minNumberOfRepayments: null,
  maxNumberOfRepayments: null,
  repaymentEvery: 1,
  repaymentFrequencyType: 2,

  interestRatePerPeriod: 18,
  minInterestRatePerPeriod: null,
  maxInterestRatePerPeriod: null,
  interestRateFrequencyType: 3,
  amortizationType: 1,
  interestType: 0,
  interestCalculationPeriodType: 1,
  isInterestRecalculationEnabled: false,

  graceOnPrincipalPayment: null,
  graceOnInterestPayment: null,
  graceOnArrearsAgeing: null,
  inArrearsTolerance: null,
  graceOnInterestCharged: null,

  transactionProcessingStrategyCode: "mifos-standard-strategy",
  daysInYearType: 365,
  daysInMonthType: 30,
  minimumDaysBetweenDisbursalAndFirstRepayment: null,
  allowPartialPeriodInterestCalculation: false,
  canDefineInstallmentAmount: false,
  multiDisburseLoan: false,
  maxTrancheCount: null,
  outstandingLoanBalance: null,

  accountingRule: 1,                       // 1 = None
  fundSourceAccountId: null,
  loanPortfolioAccountId: null,
  transfersInSuspenseAccountId: null,
  interestOnLoanAccountId: null,
  incomeFromFeeAccountId: null,
  incomeFromPenaltyAccountId: null,
  incomeFromRecoveryAccountId: null,
  writeOffAccountId: null,
  overpaymentLiabilityAccountId: null,
};

// GL account types (Fineract enum codes for type filtering)
const TYPE_ASSET = 1;
const TYPE_LIABILITY = 2;
const TYPE_INCOME = 4;
const TYPE_EXPENSE = 5;

type GLAccount = {
  id: number;
  name: string;
  glCode: string;
  type?: { id?: number; value?: string };
};

export default function NewLoanProductPage() {
  const router = useRouter();
  const [f, setF] = useState<Form>(initial);
  const [showAdvanced, setShowAdvanced] = useState(false);
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

  // Helpers for filtering GL accounts to ones of a given type, used by selects
  function accountsOfType(typeIds: number[]): GLAccount[] {
    return glAccounts.filter((a) => typeIds.includes(a.type?.id ?? 0));
  }

  function update<K extends keyof Form>(k: K, v: Form[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  /**
   * Build the request body. Strips null/empty optional fields so Fineract
   * doesn't see them at all — sending null on these often produces "must be
   * one of ..." errors. We send the field only when the user set a value.
   */
  function buildBody(): Record<string, unknown> {
    const body: Record<string, unknown> = {
      // Required core
      name: f.name,
      shortName: f.shortName,
      currencyCode: f.currencyCode,
      digitsAfterDecimal: f.digitsAfterDecimal,
      principal: f.principal,
      numberOfRepayments: f.numberOfRepayments,
      repaymentEvery: f.repaymentEvery,
      repaymentFrequencyType: f.repaymentFrequencyType,
      interestRatePerPeriod: f.interestRatePerPeriod,
      interestRateFrequencyType: f.interestRateFrequencyType,
      amortizationType: f.amortizationType,
      interestType: f.interestType,
      interestCalculationPeriodType: f.interestCalculationPeriodType,
      isInterestRecalculationEnabled: f.isInterestRecalculationEnabled,
      transactionProcessingStrategyCode: f.transactionProcessingStrategyCode,
      daysInYearType: f.daysInYearType,
      daysInMonthType: f.daysInMonthType,
      accountingRule: f.accountingRule,
      locale: "en",
      dateFormat: "dd MMMM yyyy",
    };

    // GL account mappings — only sent for Cash accounting (rule 2).
    // Required fields per Fineract for Cash mode on a loan product.
    if (f.accountingRule === 2) {
      const mappings = {
        fundSourceAccountId: f.fundSourceAccountId,
        loanPortfolioAccountId: f.loanPortfolioAccountId,
        transfersInSuspenseAccountId: f.transfersInSuspenseAccountId,
        interestOnLoanAccountId: f.interestOnLoanAccountId,
        incomeFromFeeAccountId: f.incomeFromFeeAccountId,
        incomeFromPenaltyAccountId: f.incomeFromPenaltyAccountId,
        incomeFromRecoveryAccountId: f.incomeFromRecoveryAccountId,
        writeOffAccountId: f.writeOffAccountId,
        overpaymentLiabilityAccountId: f.overpaymentLiabilityAccountId,
      };
      for (const [key, val] of Object.entries(mappings)) {
        if (val !== null && val !== undefined) body[key] = val;
      }
    }

    // Optional strings — only include if non-empty
    if (f.description.trim()) body.description = f.description.trim();
    if (f.externalId.trim()) body.externalId = f.externalId.trim();
    if (f.startDate.trim()) body.startDate = f.startDate.trim();
    if (f.closeDate.trim()) body.closeDate = f.closeDate.trim();

    // Optional numbers — only include if user set a value
    const optionalNumbers: Array<keyof Form> = [
      "minPrincipal", "maxPrincipal",
      "minNumberOfRepayments", "maxNumberOfRepayments",
      "minInterestRatePerPeriod", "maxInterestRatePerPeriod",
      "graceOnPrincipalPayment", "graceOnInterestPayment",
      "graceOnArrearsAgeing", "inArrearsTolerance", "graceOnInterestCharged",
      "minimumDaysBetweenDisbursalAndFirstRepayment",
      "maxTrancheCount", "outstandingLoanBalance",
    ];
    for (const key of optionalNumbers) {
      const v = f[key];
      if (v !== null && v !== undefined && !Number.isNaN(v)) body[key] = v;
    }

    // Booleans that have functional defaults — only include when true,
    // since some Fineract versions reject explicit `false` on these.
    if (f.allowPartialPeriodInterestCalculation) {
      body.allowPartialPeriodInterestCalculation = true;
    }
    if (f.canDefineInstallmentAmount) {
      body.canDefineInstallmentAmount = true;
    }
    if (f.multiDisburseLoan) {
      body.multiDisburseLoan = true;
      // When multi-disburse is on, maxTrancheCount and outstandingLoanBalance
      // become required. We send what the user gave; defaults of 2 and the
      // principal are reasonable if they didn't.
      if (body.maxTrancheCount === undefined) body.maxTrancheCount = 2;
      if (body.outstandingLoanBalance === undefined) body.outstandingLoanBalance = f.principal;
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
        path: "/loanproducts",
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
          <div className="page-eyebrow">POST /loanproducts</div>
          <h1 className="page-title">New loan product</h1>
          <p className="page-sub">
            Defines the template — currency, principal range, schedule, interest — applied to every loan originated from it.
          </p>
        </div>
      </header>

      {success && (
        <div className="alert alert-good">
          <div className="alert-label">Created · resource {success.resourceId}</div>
          <div>The product is now visible in Fineract. You can originate loans against it.</div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={() => router.push("/loan-products")}>
              View products
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => { setSuccess(null); setF({ ...initial, name: "", shortName: "" }); }}
            >
              Create another
            </button>
          </div>
        </div>
      )}

      {err && (
        <div className="alert alert-bad">
          <div className="alert-label">{err.title}</div>
          <pre style={{
            margin: 0, fontFamily: "var(--font-display)",
            fontSize: 12, whiteSpace: "pre-wrap",
          }}>{err.detail}</pre>
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
        {/* === Identity === */}
        <section className="field-group">
          <div>
            <div className="field-group-title">Identity</div>
            <div className="field-group-hint">How the product appears to staff and in reports.</div>
          </div>
          <div className="field-grid">
            <TextField label="Name" code="name" value={f.name}
              onChange={(v) => update("name", v)} required maxLength={100} />
            <TextField label="Short code" code="shortName" value={f.shortName}
              onChange={(v) => update("shortName", v)} required maxLength={4}
              hint="≤ 4 characters, unique." />
          </div>

          {showAdvanced && (
            <div className="field-grid" style={{ marginTop: 24 }}>
              <TextAreaField label="Description" code="description" value={f.description}
                onChange={(v) => update("description", v)}
                hint="Internal notes about this product's purpose or terms." />
              <TextField label="External ID" code="externalId" value={f.externalId}
                onChange={(v) => update("externalId", v)}
                hint="Optional reference code for integrations." />
              <TextField label="Start date" code="startDate" value={f.startDate}
                onChange={(v) => update("startDate", v)}
                hint="dd MMMM yyyy (e.g. 01 January 2026). Product unavailable before this." />
              <TextField label="Close date" code="closeDate" value={f.closeDate}
                onChange={(v) => update("closeDate", v)}
                hint="dd MMMM yyyy. Product retired after this date." />
            </div>
          )}
        </section>

        {/* === Currency === */}
        <section className="field-group">
          <div>
            <div className="field-group-title">Currency</div>
            <div className="field-group-hint">ISO code and decimal precision for amounts.</div>
          </div>
          <div className="field-grid">
            <TextField label="Currency code" code="currencyCode" value={f.currencyCode}
              onChange={(v) => update("currencyCode", v.toUpperCase())} required maxLength={3} />
            <NumField label="Decimal places" code="digitsAfterDecimal" value={f.digitsAfterDecimal}
              onChange={(v) => update("digitsAfterDecimal", v)} min={0} max={4} />
          </div>
        </section>

        {/* === Schedule === */}
        <section className="field-group">
          <div>
            <div className="field-group-title">Schedule</div>
            <div className="field-group-hint">Default principal and how the schedule is built.</div>
          </div>
          <div className="field-grid">
            <NumField label="Default principal" code="principal" value={f.principal}
              onChange={(v) => update("principal", v)} min={0} />
            <NumField label="Repayments" code="numberOfRepayments" value={f.numberOfRepayments}
              onChange={(v) => update("numberOfRepayments", v)} min={1} />
            <NumField label="Every" code="repaymentEvery" value={f.repaymentEvery}
              onChange={(v) => update("repaymentEvery", v)} min={1} hint="e.g. 1 with 'months' = monthly." />
            <SelectField label="Frequency" code="repaymentFrequencyType" value={f.repaymentFrequencyType}
              onChange={(v) => update("repaymentFrequencyType", v)}
              options={[ [0, "Days"], [1, "Weeks"], [2, "Months"] ]} />
          </div>

          {showAdvanced && (
            <div className="field-grid" style={{ marginTop: 24 }}>
              <NullableNumField label="Min principal" code="minPrincipal" value={f.minPrincipal}
                onChange={(v) => update("minPrincipal", v)}
                hint="Minimum the loan officer can disburse. Blank = no minimum." />
              <NullableNumField label="Max principal" code="maxPrincipal" value={f.maxPrincipal}
                onChange={(v) => update("maxPrincipal", v)}
                hint="Maximum the loan officer can disburse. Blank = no maximum." />
              <NullableNumField label="Min repayments" code="minNumberOfRepayments" value={f.minNumberOfRepayments}
                onChange={(v) => update("minNumberOfRepayments", v)}
                hint="Minimum installments allowed at origination." />
              <NullableNumField label="Max repayments" code="maxNumberOfRepayments" value={f.maxNumberOfRepayments}
                onChange={(v) => update("maxNumberOfRepayments", v)}
                hint="Maximum installments allowed at origination." />
            </div>
          )}
        </section>

        {/* === Interest === */}
        <section className="field-group">
          <div>
            <div className="field-group-title">Interest</div>
            <div className="field-group-hint">Rate, calculation method, and amortization style.</div>
          </div>
          <div className="field-grid">
            <NumField label="Rate" code="interestRatePerPeriod" value={f.interestRatePerPeriod}
              onChange={(v) => update("interestRatePerPeriod", v)} step="0.01"
              hint="Percent, in the chosen frequency." />
            <SelectField label="Rate frequency" code="interestRateFrequencyType"
              value={f.interestRateFrequencyType}
              onChange={(v) => update("interestRateFrequencyType", v)}
              options={[ [2, "Per month"], [3, "Per year"] ]} />
            <SelectField label="Amortization" code="amortizationType" value={f.amortizationType}
              onChange={(v) => update("amortizationType", v)}
              options={[ [0, "Equal principal"], [1, "Equal installments"] ]} />
            <SelectField label="Interest method" code="interestType" value={f.interestType}
              onChange={(v) => update("interestType", v)}
              options={[ [0, "Declining balance"], [1, "Flat"] ]} />
            <SelectField label="Calc period" code="interestCalculationPeriodType"
              value={f.interestCalculationPeriodType}
              onChange={(v) => update("interestCalculationPeriodType", v)}
              options={[ [0, "Daily"], [1, "Same as repayment period"] ]} />
            <SelectField label="Interest recalc" code="isInterestRecalculationEnabled"
              value={f.isInterestRecalculationEnabled ? "true" : "false"}
              onChange={(v) => update("isInterestRecalculationEnabled", v === "true")}
              options={[ ["false", "Disabled"], ["true", "Enabled"] ]}
              hint="Sandbox uses disabled." />
          </div>

          {showAdvanced && (
            <div className="field-grid" style={{ marginTop: 24 }}>
              <NullableNumField label="Min rate" code="minInterestRatePerPeriod" value={f.minInterestRatePerPeriod}
                onChange={(v) => update("minInterestRatePerPeriod", v)} step="0.01"
                hint="Minimum rate a loan officer can apply." />
              <NullableNumField label="Max rate" code="maxInterestRatePerPeriod" value={f.maxInterestRatePerPeriod}
                onChange={(v) => update("maxInterestRatePerPeriod", v)} step="0.01"
                hint="Maximum rate a loan officer can apply." />
              <NullableNumField label="Grace on principal" code="graceOnPrincipalPayment"
                value={f.graceOnPrincipalPayment}
                onChange={(v) => update("graceOnPrincipalPayment", v)}
                hint="Installments where no principal is collected." />
              <NullableNumField label="Grace on interest" code="graceOnInterestPayment"
                value={f.graceOnInterestPayment}
                onChange={(v) => update("graceOnInterestPayment", v)}
                hint="Installments where no interest is collected." />
              <NullableNumField label="Interest-free moratorium" code="graceOnInterestCharged"
                value={f.graceOnInterestCharged}
                onChange={(v) => update("graceOnInterestCharged", v)}
                hint="Installments where interest doesn't accrue at all." />
              <NullableNumField label="Arrears tolerance" code="inArrearsTolerance"
                value={f.inArrearsTolerance}
                onChange={(v) => update("inArrearsTolerance", v)}
                hint="Amount under which arrears is not flagged." />
              <NullableNumField label="Days before arrears flag" code="graceOnArrearsAgeing"
                value={f.graceOnArrearsAgeing}
                onChange={(v) => update("graceOnArrearsAgeing", v)}
                hint="Days overdue before a loan is flagged as in arrears." />
            </div>
          )}
        </section>

        {/* === Processing === */}
        <section className="field-group">
          <div>
            <div className="field-group-title">Processing</div>
            <div className="field-group-hint">How payments allocate and where they post.</div>
          </div>
          <div className="field-grid">
            <SelectField label="Repayment strategy" code="transactionProcessingStrategyCode"
              value={f.transactionProcessingStrategyCode}
              onChange={(v) => update("transactionProcessingStrategyCode", v)}
              options={[
                ["mifos-standard-strategy", "Mifos standard"],
                ["heavensfamily-strategy", "Heavensfamily"],
                ["creocore-strategy", "Creocore (early payment)"],
                ["rbi-india-strategy", "RBI India"],
                ["principal-interest-penalties-fees-order-strategy", "Principal · Interest · Penalties · Fees"],
                ["interest-principal-penalties-fees-order-strategy", "Interest · Principal · Penalties · Fees"],
                ["early-repayment-strategy", "Early repayment"],
              ]} />

            <SelectField label="Accounting" code="accountingRule"
              value={f.accountingRule}
              onChange={(v) => update("accountingRule", v)}
              options={[
                [1, "None (no GL postings)"],
                [2, "Cash (real-time GL postings)"],
              ]}
              hint={f.accountingRule === 1
                ? "Transactions don't post to general ledger."
                : "Transactions post to GL accounts mapped below."} />

            <SelectField label="Days in year" code="daysInYearType" value={f.daysInYearType}
              onChange={(v) => update("daysInYearType", v)}
              options={[ [360, "360"], [364, "364"], [365, "365"] ]} />
            <SelectField label="Days in month" code="daysInMonthType" value={f.daysInMonthType}
              onChange={(v) => update("daysInMonthType", v)}
              options={[ [1, "Actual"], [30, "30"] ]} />
          </div>

          {showAdvanced && (
            <div className="field-grid" style={{ marginTop: 24 }}>
              <NullableNumField label="Min days disburse → 1st repay"
                code="minimumDaysBetweenDisbursalAndFirstRepayment"
                value={f.minimumDaysBetweenDisbursalAndFirstRepayment}
                onChange={(v) => update("minimumDaysBetweenDisbursalAndFirstRepayment", v)}
                hint="Minimum gap from disbursement to first installment due date." />

              <SelectField label="Partial-period interest" code="allowPartialPeriodInterestCalculation"
                value={f.allowPartialPeriodInterestCalculation ? "true" : "false"}
                onChange={(v) => update("allowPartialPeriodInterestCalculation", v === "true")}
                options={[ ["false", "Whole-period only"], ["true", "Pro-rate partial periods"] ]}
                hint="How interest accrues for incomplete first/last periods." />

              <SelectField label="Custom installment amount" code="canDefineInstallmentAmount"
                value={f.canDefineInstallmentAmount ? "true" : "false"}
                onChange={(v) => update("canDefineInstallmentAmount", v === "true")}
                options={[ ["false", "Schedule-derived"], ["true", "Loan officer can override"] ]}
                hint="Whether the loan officer can set a fixed EMI manually." />

              <SelectField label="Multi-disburse / tranche" code="multiDisburseLoan"
                value={f.multiDisburseLoan ? "true" : "false"}
                onChange={(v) => update("multiDisburseLoan", v === "true")}
                options={[ ["false", "Single disbursement"], ["true", "Tranche disbursement"] ]}
                hint="Disburse the loan in multiple parts over time." />

              {f.multiDisburseLoan && (
                <>
                  <NullableNumField label="Max tranches" code="maxTrancheCount" value={f.maxTrancheCount}
                    onChange={(v) => update("maxTrancheCount", v)} min={2}
                    hint="Required when multi-disburse is on. Default 2." />
                  <NullableNumField label="Max outstanding balance" code="outstandingLoanBalance"
                    value={f.outstandingLoanBalance}
                    onChange={(v) => update("outstandingLoanBalance", v)}
                    hint="Max combined outstanding across tranches. Default = principal." />
                </>
              )}
            </div>
          )}
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
              <GLAccountField label="Fund source" code="fundSourceAccountId"
                value={f.fundSourceAccountId} onChange={(v) => update("fundSourceAccountId", v)}
                accounts={accountsOfType([TYPE_ASSET])}
                hint="Asset. Cash account funds get disbursed from." />
              <GLAccountField label="Loan portfolio" code="loanPortfolioAccountId"
                value={f.loanPortfolioAccountId} onChange={(v) => update("loanPortfolioAccountId", v)}
                accounts={accountsOfType([TYPE_ASSET])}
                hint="Asset. Where outstanding principal sits." />
              <GLAccountField label="Transfers in suspense" code="transfersInSuspenseAccountId"
                value={f.transfersInSuspenseAccountId} onChange={(v) => update("transfersInSuspenseAccountId", v)}
                accounts={accountsOfType([TYPE_LIABILITY])}
                hint="Liability. Suspense for in-flight transfers." />
              <GLAccountField label="Interest on loan" code="interestOnLoanAccountId"
                value={f.interestOnLoanAccountId} onChange={(v) => update("interestOnLoanAccountId", v)}
                accounts={accountsOfType([TYPE_INCOME])}
                hint="Income. Interest income earned." />
              <GLAccountField label="Income from fees" code="incomeFromFeeAccountId"
                value={f.incomeFromFeeAccountId} onChange={(v) => update("incomeFromFeeAccountId", v)}
                accounts={accountsOfType([TYPE_INCOME])}
                hint="Income. Fee income." />
              <GLAccountField label="Income from penalty" code="incomeFromPenaltyAccountId"
                value={f.incomeFromPenaltyAccountId} onChange={(v) => update("incomeFromPenaltyAccountId", v)}
                accounts={accountsOfType([TYPE_INCOME])}
                hint="Income. Penalty income." />
              <GLAccountField label="Income from recovery" code="incomeFromRecoveryAccountId"
                value={f.incomeFromRecoveryAccountId} onChange={(v) => update("incomeFromRecoveryAccountId", v)}
                accounts={accountsOfType([TYPE_INCOME])}
                hint="Income. Recoveries on written-off loans." />
              <GLAccountField label="Write-off" code="writeOffAccountId"
                value={f.writeOffAccountId} onChange={(v) => update("writeOffAccountId", v)}
                accounts={accountsOfType([TYPE_EXPENSE])}
                hint="Expense. Principal written off as uncollectable." />
              <GLAccountField label="Overpayment liability" code="overpaymentLiabilityAccountId"
                value={f.overpaymentLiabilityAccountId} onChange={(v) => update("overpaymentLiabilityAccountId", v)}
                accounts={accountsOfType([TYPE_LIABILITY])}
                hint="Liability. Customer overpayments." />
            </div>
          </section>
        )}

        {/* === Advanced toggle === */}
        <section style={{
          padding: "16px 0",
          borderTop: "1px solid var(--rule)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <div style={{
              fontFamily: "var(--font-display)",
              fontSize: 11,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
              marginBottom: 4,
            }}>
              Advanced settings
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
              {showAdvanced
                ? "Showing optional fields: limits, grace periods, tranches, etc."
                : "Hidden — defaults are fine for most products."}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowAdvanced((s) => !s)}
          >
            {showAdvanced ? "Hide" : "Show"}
          </button>
        </section>

        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Creating…" : "Create product"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setF(initial)}
            disabled={submitting}
          >
            Reset
          </button>
        </div>
      </form>
    </AppShell>
  );
}

/* ===== Field helpers ===== */

function TextField(p: {
  label: string; code: string; value: string;
  onChange: (v: string) => void;
  required?: boolean; maxLength?: number; hint?: string;
}) {
  return (
    <div className="field">
      <label className="field-label">
        {p.label}
        <span className="field-label-code">{p.code}</span>
      </label>
      <input
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        required={p.required}
        maxLength={p.maxLength}
      />
      {p.hint && <div className="field-hint">{p.hint}</div>}
    </div>
  );
}

function TextAreaField(p: {
  label: string; code: string; value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="field" style={{ gridColumn: "1 / -1" }}>
      <label className="field-label">
        {p.label}
        <span className="field-label-code">{p.code}</span>
      </label>
      <textarea
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        rows={3}
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 14,
          padding: "8px 12px",
          border: "1px solid var(--rule)",
          background: "white",
          color: "var(--ink)",
          borderRadius: 0,
          width: "100%",
          resize: "vertical",
        }}
      />
      {p.hint && <div className="field-hint">{p.hint}</div>}
    </div>
  );
}

function NumField(p: {
  label: string; code: string; value: number;
  onChange: (v: number) => void;
  min?: number; max?: number; step?: string; hint?: string;
}) {
  return (
    <div className="field">
      <label className="field-label">
        {p.label}
        <span className="field-label-code">{p.code}</span>
      </label>
      <input
        type="number"
        value={p.value}
        onChange={(e) => p.onChange(Number(e.target.value))}
        min={p.min}
        max={p.max}
        step={p.step}
      />
      {p.hint && <div className="field-hint">{p.hint}</div>}
    </div>
  );
}

/**
 * Nullable number — empty string in the input means "don't send this field".
 * Allows users to leave optional fields truly blank rather than forcing 0.
 */
function NullableNumField(p: {
  label: string; code: string; value: number | null;
  onChange: (v: number | null) => void;
  min?: number; max?: number; step?: string; hint?: string;
}) {
  return (
    <div className="field">
      <label className="field-label">
        {p.label}
        <span className="field-label-code">{p.code}</span>
      </label>
      <input
        type="number"
        value={p.value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") p.onChange(null);
          else p.onChange(Number(raw));
        }}
        min={p.min}
        max={p.max}
        step={p.step}
        placeholder="—"
      />
      {p.hint && <div className="field-hint">{p.hint}</div>}
    </div>
  );
}

function SelectField<V extends string | number>(p: {
  label: string; code: string; value: V;
  onChange: (v: V) => void;
  options: Array<[V, string]>;
  hint?: string;
}) {
  return (
    <div className="field">
      <label className="field-label">
        {p.label}
        <span className="field-label-code">{p.code}</span>
      </label>
      <select
        value={String(p.value)}
        onChange={(e) => {
          const raw = e.target.value;
          const sample = p.options[0][0];
          const next = (typeof sample === "number" ? Number(raw) : raw) as V;
          p.onChange(next);
        }}
      >
        {p.options.map(([v, label]) => (
          <option key={String(v)} value={String(v)}>{label}</option>
        ))}
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
        {p.label}
        <span className="field-label-code">{p.code}</span>
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
