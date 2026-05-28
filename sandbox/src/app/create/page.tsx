"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { useMemos } from "@/lib/memo-store";
import {
  ApprovalCategory,
  ApprovalLevel,
  analyzeApprovalRoute,
  buildApprovalFlow,
  BudgetStatus,
  computePriceRowTotals,
  getApprovalRecommendation,
  PriceComparison,
  ReadAction,
  RequestItem,
} from "@/lib/approval";
import { coerceNonNegativeNumber, coercePositiveInteger } from "@/lib/number-input";
import {
  IconFileText, IconMail,
} from "@/components/icons";
import { StepDot } from "./_components/StepDot";
import { AttachmentsCard } from "./_components/AttachmentsCard";
import { RequestItemsCard } from "./_components/RequestItemsCard";
import { BudgetCard } from "./_components/BudgetCard";
import { DraftPreviewPanel } from "./_components/DraftPreviewPanel";
import { DescriptionCard } from "./_components/DescriptionCard";
import { MemoDetailsCard } from "./_components/MemoDetailsCard";
import { RoutingCard } from "./_components/RoutingCard";
import { PriceComparisonCard } from "./_components/PriceComparisonCard";
import { useRouter } from "next/navigation";

// TODO: Promote ordered read/review recipients into sequential workflow steps
// once queue actions can advance per-reader. For now, the prototype preserves
// input order for audit and display without enforcing step-by-step read routing.
function parseReadRecipientsInput(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getEffectiveRequestQty(qty: number) {
  return qty > 0 ? qty : 1;
}

const mockLoggedInUser = {
  name: "อำภา หิงคำ",
  department: "HR&GA",
  role: "Manager"
};

export default function CreatePage() {
  const { dispatch } = useMemos();
  const router = useRouter();

  const [subject, setSubject] = useState("ขออนุมัติซื้ออุปกรณ์สำนักงาน Q2/2026");
  const [category, setCategory] = useState<ApprovalCategory>("general-purchase");
  const [department, setDepartment] = useState(mockLoggedInUser.department);
  const [amount, setAmount] = useState(32000);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus>("in-budget");
  const [description, setDescription] = useState("ขออนุมัติซื้ออุปกรณ์สำนักงานสำหรับสนับสนุนการดำเนินงานของแผนก HR&GA");

  const [currentDateTime, setCurrentDateTime] = useState<Date | null>(null);
  const [isPriceAdjustment, setIsPriceAdjustment] = useState(false);
  const [followsProductionPlan, setFollowsProductionPlan] = useState(false);
  const [isDeadStockOrSlowMovement, setIsDeadStockOrSlowMovement] = useState(false);
  const [deptMonthlyOverBudgetTotal, setDeptMonthlyOverBudgetTotal] = useState(0);
  const [chosenApprover, setChosenApprover] = useState<ApprovalLevel | null>(null);
  const [skipGmStep, setSkipGmStep] = useState(false);
  const [routeOverrideReason, setRouteOverrideReason] = useState("");
  const [readRecipients, setReadRecipients] = useState("HR&GA, ACC/FIN");
  const [accountCode, setAccountCode] = useState("GA-OPS-2026");
  const [budgetPlan, setBudgetPlan] = useState(150000);
  const [budgetUsed, setBudgetUsed] = useState(68000);
  const [priceComparisons, setPriceComparisons] = useState<PriceComparison[]>([
    { id: "1", vendorName: "", offeredPrice: 0, discount: 0, vatEnabled: false, netPrice: 0, remark: "", isSelected: true },
  ]);
  const [selectedVendorReason, setSelectedVendorReason] = useState("");
  const [requestItems, setRequestItems] = useState<RequestItem[]>([
    { id: "1", name: "", unit: "ชิ้น", qty: 1, unitPrice: 0 },
  ]);
  const [priceAdjustmentReason, setPriceAdjustmentReason] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const addRequestItem = () => {
    setRequestItems(prev => [...prev, {
      id: String(Date.now()), name: "", unit: "ชิ้น", qty: 1, unitPrice: 0,
    }]);
  };
  const removeRequestItem = (id: string) => {
    setRequestItems(prev => prev.length === 1 ? prev : prev.filter(r => r.id !== id));
  };
  const updateRequestItem = (id: string, updates: Partial<Omit<RequestItem, "id">>) => {
    const normalizedUpdates = {
      ...updates,
      ...(updates.qty !== undefined ? { qty: coercePositiveInteger(updates.qty) } : {}),
      ...(updates.unitPrice !== undefined ? { unitPrice: coerceNonNegativeNumber(updates.unitPrice) } : {}),
    };
    setRequestItems(prev => prev.map(r => r.id === id ? { ...r, ...normalizedUpdates } : r));
  };

  const addVendorRow = () => {
    setPriceComparisons(prev => [...prev, {
      id: String(Date.now()), vendorName: "", offeredPrice: 0, discount: 0, vatEnabled: false, netPrice: 0, remark: "", isSelected: false,
    }]);
  };
  const removeVendorRow = (id: string) => {
    setPriceComparisons(prev => {
      if (prev.length === 1) return prev;
      const removingSelected = prev.find(r => r.id === id)?.isSelected ?? false;
      const next = prev.filter(r => r.id !== id);
      if (removingSelected && next.length > 0) next[0] = { ...next[0], isSelected: true };
      return next;
    });
  };
  const updateVendorRow = (id: string, updates: Partial<PriceComparison>) => {
    setPriceComparisons(prev => prev.map(row => {
      if (row.id !== id) return row;
      const normalizedUpdates = {
        ...updates,
        ...(updates.offeredPrice !== undefined ? { offeredPrice: coerceNonNegativeNumber(updates.offeredPrice) } : {}),
        ...(updates.discount !== undefined ? { discount: coerceNonNegativeNumber(updates.discount) } : {}),
      };
      const merged: PriceComparison = {
        ...row,
        ...normalizedUpdates,
        // isSelected is owned by handleSelectVendor, not the per-field updater
        isSelected: row.isSelected,
      };
      const { netPrice } = computePriceRowTotals(merged);
      return { ...merged, netPrice };
    }));
  };
  const handleSelectVendor = (id: string) => {
    setPriceComparisons(prev => prev.map(row => ({ ...row, isSelected: row.id === id })));
    setSelectedVendorReason("");
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const supportsPriceAdjustment = category === "raw-material" || category === "fixed-asset";
  const supportsProductionPlan = category === "raw-material";
  const supportsDeadStock = category === "raw-material";
  const showDeptMonthly = budgetStatus !== "in-budget";

  const effectiveIsPriceAdjustment = supportsPriceAdjustment && isPriceAdjustment;
  const effectiveFollowsProductionPlan = supportsProductionPlan && followsProductionPlan;
  const effectiveIsDeadStock = supportsDeadStock && isDeadStockOrSlowMovement;

  const recommendation = useMemo(
    () =>
      getApprovalRecommendation({
        category, amount, budgetStatus,
        isPriceAdjustment: effectiveIsPriceAdjustment,
        followsProductionPlan: effectiveFollowsProductionPlan,
        isDeadStockOrSlowMovement: effectiveIsDeadStock,
        departmentMonthlyOverBudgetTotal: showDeptMonthly ? deptMonthlyOverBudgetTotal : 0,
      }),
    [category, amount, budgetStatus, effectiveIsPriceAdjustment, effectiveFollowsProductionPlan,
      effectiveIsDeadStock, deptMonthlyOverBudgetTotal, showDeptMonthly]
  );

  const effectiveApprover: ApprovalLevel = chosenApprover ?? recommendation.recommendedFinalApprover;
  const selectedRoute = useMemo(
    () =>
      effectiveApprover === "Managing Director" && skipGmStep
        ? buildApprovalFlow(effectiveApprover, { respectChosenOnly: true })
        : buildApprovalFlow(effectiveApprover),
    [effectiveApprover, skipGmStep]
  );
  const routeReview = useMemo(
    () =>
      analyzeApprovalRoute(
        recommendation.recommendedFinalApprover,
        selectedRoute
      ),
    [recommendation.recommendedFinalApprover, selectedRoute]
  );
  const flow = selectedRoute;
  const tierClass = effectiveApprover === "Managing Director" ? "md" : effectiveApprover === "General Manager" ? "gm" : "mgr";
  const isOverridden = routeReview.mode !== "recommended";
  const budgetRemaining = budgetPlan - budgetUsed - amount;
  const cleanOverrideReason = routeOverrideReason.trim();
  const orderedReadRecipients = useMemo(
    () => parseReadRecipientsInput(readRecipients),
    [readRecipients]
  );
  const firstCheckingStep = selectedRoute[0] ?? "Manager / Top Section";
  const selectedVendor = priceComparisons.find(r => r.isSelected) ?? priceComparisons[0];
  const hasPricedVendor = priceComparisons.some(r => r.offeredPrice > 0);
  const validPrices = priceComparisons.filter(r => r.offeredPrice > 0).map(r => r.netPrice);
  const lowestNetPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
  const lowestOfferVendorNames = priceComparisons
    .filter((row) => row.offeredPrice > 0 && row.netPrice === lowestNetPrice)
    .map((row) => row.vendorName.trim())
    .filter(Boolean);
  const lowestOfferSummary =
    lowestNetPrice > 0
      ? `${lowestOfferVendorNames.length > 0 ? `${lowestOfferVendorNames.join(", ")} · ` : ""}฿${lowestNetPrice.toLocaleString()}`
      : "—";
  const selectedVendorSummary =
    selectedVendor && selectedVendor.vendorName.trim().length > 0
      ? `${selectedVendor.vendorName.trim()} · ฿${selectedVendor.netPrice.toLocaleString()}`
      : selectedVendor && selectedVendor.netPrice > 0
        ? `฿${selectedVendor.netPrice.toLocaleString()}`
        : "—";
  const selectedNotLowest = priceComparisons.length > 1 && lowestNetPrice > 0 && (selectedVendor?.netPrice ?? 0) > lowestNetPrice;
  const selectedVendorTotals = selectedVendor ? computePriceRowTotals(selectedVendor) : null;
  const selectedVendorVat = Boolean(selectedVendor?.vatEnabled);
  const selectedVendorVatAmount = selectedVendorTotals?.vatAmount ?? 0;
  const cleanVendorReason = selectedVendorReason.trim();
  const canSubmitPending = (!routeReview.requiresReason || cleanOverrideReason.length > 0) && (!selectedNotLowest || cleanVendorReason.length > 0);
  const currentDateLabel = useMemo(
    () => currentDateTime
      ? new Intl.DateTimeFormat("th-TH", { dateStyle: "full", timeStyle: "short" }).format(currentDateTime)
      : "",
    [currentDateTime]
  );
  const clockDateLabel = useMemo(
    () => currentDateTime
      ? new Intl.DateTimeFormat("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(currentDateTime)
      : "",
    [currentDateTime]
  );
  const clockTimeLabel = useMemo(
    () => currentDateTime
      ? new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(currentDateTime)
      : "--:--:--",
    [currentDateTime]
  );
  const requestItemsGrandTotal = useMemo(
    () => requestItems.reduce((sum, r) => sum + Math.round(getEffectiveRequestQty(r.qty) * r.unitPrice), 0),
    [requestItems]
  );

  const handleAiSuggest = async () => {
    setIsAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, amount, department, budgetStatus }),
      });
      const data = await res.json();
      if (data.error === "not_configured") {
        setAiError("ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน .env.local");
      } else if (data.error === "quota_exceeded") {
        setAiError("Rate limit — รอ 1 นาทีแล้วลองใหม่");
      } else if (data.error === "parse_error") {
        setAiError("AI ตอบผิดรูปแบบ — ลองใหม่อีกครั้ง");
      } else if (data.error) {
        setAiError(`AI ไม่พร้อมใช้งานขณะนี้${data.detail ? ` (${data.detail})` : ""}`);
      } else {
        if (data.subject) setSubject(data.subject);
        if (data.description) setDescription(data.description);
      }
    } catch {
      setAiError("เชื่อมต่อ AI ไม่ได้");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handlePdfUpload = async (file: File) => {
    setPdfError(null);
    setIsPdfLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/pdf-extract", { method: "POST", body: form });
      const data = await res.json();
      if (data.error === "not_configured") {
        setPdfError("ยังไม่ได้ตั้งค่า AI API key");
      } else if (data.error === "quota_exceeded") {
        setPdfError("Rate limit — รอ 1 นาทีแล้วลองใหม่");
      } else if (data.error === "pdf_only") {
        setPdfError("รองรับเฉพาะไฟล์ PDF เท่านั้น");
      } else if (data.error === "file_too_large") {
        setPdfError("ไฟล์ใหญ่เกิน 10 MB");
      } else if (data.error === "no_text_in_pdf") {
        setPdfError("PDF นี้ไม่มีข้อความ (อาจเป็น scan) — กรอกด้วยตนเอง");
      } else if (data.error) {
        setPdfError("ดึงข้อมูลจาก PDF ไม่สำเร็จ — ลองใหม่");
      } else {
        // Pre-fill vendor row
        if (data.vendor || data.items?.length > 0) {
          const totalFromItems = (data.items ?? []).reduce(
            (s: number, it: { qty: number; unitPrice: number }) =>
              s + Math.round(coercePositiveInteger(it.qty) * coerceNonNegativeNumber(it.unitPrice)),
            0
          );
          const vendorPrice = coerceNonNegativeNumber(data.totalAmount || totalFromItems);
          const isFirstBlank =
            priceComparisons.length === 1 &&
            !priceComparisons[0].vendorName &&
            priceComparisons[0].offeredPrice === 0;
          // VAT defaults to disabled — extracted PDF totals are ambiguous re: VAT inclusion.
          // User can toggle the per-row VAT 7% pill if the quote explicitly excludes VAT.
          const newVendorRow: PriceComparison = {
            id: String(Date.now()),
            vendorName: data.vendor ?? "",
            offeredPrice: vendorPrice,
            discount: 0,
            vatEnabled: false,
            netPrice: vendorPrice,
            remark: file.name,
            isSelected: true,
          };
          if (isFirstBlank) {
            setPriceComparisons([newVendorRow]);
          } else {
            setPriceComparisons(prev => [
              ...prev.map(r => ({ ...r, isSelected: false })),
              newVendorRow,
            ]);
          }
        }
        // Pre-fill request items
        if (Array.isArray(data.items) && data.items.length > 0) {
          const isFirstItemBlank =
            requestItems.length === 1 && !requestItems[0].name && requestItems[0].unitPrice === 0;
          const newItems = data.items.map((it: { name: string; qty: number; unit: string; unitPrice: number }, idx: number) => ({
            id: String(Date.now() + idx + 1),
            name: it.name,
            unit: it.unit || "ชิ้น",
            qty: coercePositiveInteger(it.qty),
            unitPrice: coerceNonNegativeNumber(it.unitPrice),
          }));
          if (isFirstItemBlank) {
            setRequestItems(newItems);
          } else {
            setRequestItems(prev => [...prev, ...newItems]);
          }
        }
      }
    } catch {
      setPdfError("เชื่อมต่อ server ไม่ได้");
    } finally {
      setIsPdfLoading(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  const handleSubmit = (status: "draft" | "pending") => {
    if (status === "pending" && !canSubmitPending) {
      return;
    }
    const now = new Date();
    const id = `EM-${now.getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;
    const createdTimestamp = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(now);
    dispatch({
      type: "ADD_MEMO",
      memo: {
        id, title: subject, requester: mockLoggedInUser.name, department, category, amount, status,
        currentStep: firstCheckingStep,
        workflowState: "Issued",
        recommendedFinalApprover: recommendation.recommendedFinalApprover,
        recommendedRoute: routeReview.recommendedRoute,
        selectedRoute,
        routeMode: routeReview.mode,
        routeOverrideReason: routeReview.requiresReason ? cleanOverrideReason : undefined,
        readRecipients: orderedReadRecipients,
        readActions: status === "pending" && orderedReadRecipients.length > 0
          ? orderedReadRecipients.map((r): ReadAction => ({ recipient: r, status: "pending" }))
          : undefined,
        description: description.trim() || undefined,
        budgetStatus,
        accountCode: accountCode.trim() || undefined,
        budgetPlan,
        budgetUsed,
        notifyMD: recommendation.notifyMD,
        priceComparisons,
        selectedVendorId: selectedVendor?.id,
        selectedVendorReason: selectedNotLowest ? cleanVendorReason : undefined,
        requestItems: requestItems.filter(r => r.name.trim() || r.unitPrice > 0),
        priceAdjustmentReason: effectiveIsPriceAdjustment && priceAdjustmentReason.trim() ? priceAdjustmentReason.trim() : undefined,
        isPriceAdjustment: effectiveIsPriceAdjustment || undefined,
        followsProductionPlan: effectiveFollowsProductionPlan || undefined,
        isDeadStockOrSlowMovement: effectiveIsDeadStock || undefined,
        departmentMonthlyOverBudgetTotal: showDeptMonthly && deptMonthlyOverBudgetTotal > 0 ? deptMonthlyOverBudgetTotal : undefined,
        cycleHours: 0, createdAt: createdTimestamp, updatedAt: createdTimestamp,
      },
    });
    router.push(status === "pending" ? "/queue" : "/");
  };

  return (
    <div className="em-art">
      <Sidebar />
      <div className="em-work">
        <Topbar
          crumbs={["สร้าง Memo", "ฉบับร่างใหม่"]}
          title="สร้าง E-Memo"
          actions={<>
            <button className="em-btn" onClick={() => handleSubmit("draft")}><IconFileText size={15} /> Save Draft</button>
            <button className="em-btn primary" disabled={!canSubmitPending} onClick={() => handleSubmit("pending")}><IconMail size={15} /> Send to Approval</button>
          </>}
        />
        <div className="em-content em-create-content">

          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handlePdfUpload(file);
            }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 2px 2px" }}>
            <StepDot n="1" label="รายละเอียด Memo" active />
            <div style={{ flex: 1, height: 1, background: "var(--line-2)", maxWidth: 60 }} />
            <StepDot n="2" label="เส้นทางอนุมัติ" active />
            <div style={{ flex: 1, height: 1, background: "var(--line-2)", maxWidth: 60 }} />
            <StepDot n="3" label="ตรวจทานและส่ง" active />
            <span style={{ fontSize: 10.5, color: "var(--muted)", marginLeft: 8, whiteSpace: "nowrap" }}>แบบฟอร์มเดียว</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 14, alignItems: "start" }}>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <MemoDetailsCard
              subject={subject}
              category={category}
              department={department}
              amount={amount}
              budgetStatus={budgetStatus}
              clockTimeLabel={clockTimeLabel}
              clockDateLabel={clockDateLabel}
              issuer={mockLoggedInUser}
              isAiLoading={isAiLoading}
              followsProductionPlan={followsProductionPlan}
              isDeadStockOrSlowMovement={isDeadStockOrSlowMovement}
              isPriceAdjustment={isPriceAdjustment}
              priceAdjustmentReason={priceAdjustmentReason}
              deptMonthlyOverBudgetTotal={deptMonthlyOverBudgetTotal}
              supportsPriceAdjustment={supportsPriceAdjustment}
              supportsProductionPlan={supportsProductionPlan}
              supportsDeadStock={supportsDeadStock}
              showDeptMonthly={showDeptMonthly}
              effectiveIsPriceAdjustment={effectiveIsPriceAdjustment}
              onSubjectChange={setSubject}
              onCategoryChange={(v) => { setCategory(v); setChosenApprover(null); }}
              onDepartmentChange={setDepartment}
              onAmountChange={(v) => { setAmount(v); setChosenApprover(null); }}
              onBudgetStatusChange={(v) => { setBudgetStatus(v); setChosenApprover(null); }}
              onFollowsProductionPlanChange={(v) => { setFollowsProductionPlan(v); setChosenApprover(null); }}
              onIsDeadStockChange={setIsDeadStockOrSlowMovement}
              onIsPriceAdjustmentChange={(v) => { setIsPriceAdjustment(v); setChosenApprover(null); }}
              onPriceAdjustmentReasonChange={setPriceAdjustmentReason}
              onDeptMonthlyChange={(v) => { setDeptMonthlyOverBudgetTotal(v); setChosenApprover(null); }}
              onAiSuggest={handleAiSuggest}
            />

            <DescriptionCard
              description={description}
              onDescriptionChange={(v) => { setDescription(v); setAiError(null); }}
              aiError={aiError}
              isPdfLoading={isPdfLoading}
              onPdfClick={() => pdfInputRef.current?.click()}
            />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              <RoutingCard
                effectiveApprover={effectiveApprover}
                tierClass={tierClass}
                isOverridden={isOverridden}
                effectiveIsDeadStock={effectiveIsDeadStock}
                skipGmStep={skipGmStep}
                routeOverrideReason={routeOverrideReason}
                routeReview={routeReview}
                recommendation={recommendation}
                flow={flow}
                onApproverChange={(v) => { setChosenApprover(v); setSkipGmStep(false); }}
                onReset={() => { setChosenApprover(null); setSkipGmStep(false); setRouteOverrideReason(""); }}
                onSkipGmChange={setSkipGmStep}
                onRouteOverrideReasonChange={setRouteOverrideReason}
              />

              <DraftPreviewPanel
                subject={subject}
                category={category}
                department={department}
                amount={amount}
                description={description}
                effectiveApprover={effectiveApprover}
                selectedRoute={selectedRoute}
                orderedReadRecipients={orderedReadRecipients}
                routeReview={routeReview}
                recommendation={recommendation}
                currentDateLabel={currentDateLabel}
                requestItems={requestItems}
                requestItemsGrandTotal={requestItemsGrandTotal}
                cleanOverrideReason={cleanOverrideReason}
                issuerName={mockLoggedInUser.name}
              />

            </div>
          </div>

          {/* Lower full-width section — moved out of the left column for spacious layout */}
          <div className="em-form-rows" style={{ display: "grid", gap: 14 }}>

            {/* Request Items — full width */}
            <RequestItemsCard
              requestItems={requestItems}
              amount={amount}
              requestItemsGrandTotal={requestItemsGrandTotal}
              addRequestItem={addRequestItem}
              removeRequestItem={removeRequestItem}
              updateRequestItem={updateRequestItem}
            />

            {/* Budget + Attachments — paired 2-col */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

              {/* Budget card */}
              <BudgetCard
                accountCode={accountCode}
                setAccountCode={setAccountCode}
                readRecipients={readRecipients}
                setReadRecipients={setReadRecipients}
                orderedReadRecipients={orderedReadRecipients}
                budgetPlan={budgetPlan}
                setBudgetPlan={setBudgetPlan}
                budgetUsed={budgetUsed}
                setBudgetUsed={setBudgetUsed}
                budgetRemaining={budgetRemaining}
              />

              {/* Attachments card */}
              <AttachmentsCard />

            </div>

            {/* Price Comparison — premium full-width financial decision card */}
            <PriceComparisonCard
              priceComparisons={priceComparisons}
              isPdfLoading={isPdfLoading}
              pdfError={pdfError}
              selectedVendor={selectedVendor}
              selectedVendorReason={selectedVendorReason}
              lowestNetPrice={lowestNetPrice}
              hasPricedVendor={hasPricedVendor}
              selectedNotLowest={selectedNotLowest}
              selectedVendorVat={selectedVendorVat}
              selectedVendorVatAmount={selectedVendorVatAmount}
              lowestOfferSummary={lowestOfferSummary}
              selectedVendorSummary={selectedVendorSummary}
              addVendorRow={addVendorRow}
              removeVendorRow={removeVendorRow}
              updateVendorRow={updateVendorRow}
              onSelectVendor={handleSelectVendor}
              onPdfButtonClick={() => pdfInputRef.current?.click()}
              onClearPdfError={() => setPdfError(null)}
              onSelectedVendorReasonChange={setSelectedVendorReason}
            />

          </div>
        </div>
      </div>
    </div>
  );
}
