"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  MemoAttachment,
  PriceComparison,
  ReadAction,
  RequestItem,
} from "@/lib/approval";
import { isAllowedAttachmentFile, MAX_ATTACHMENT_BYTES } from "@/lib/attachments";
import { coerceNonNegativeNumber, coercePositiveInteger } from "@/lib/number-input";
import { formatTimestamp } from "@/lib/format-timestamp";
import { generateMemoId } from "@/lib/memo-id";
import {
  IconChevRight, IconFileText, IconMail, IconRoute, IconSparkles,
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
import { useCreateMemoAssistant } from "./_hooks/useCreateMemoAssistant";
import { usePrototypeUser } from "@/lib/prototype-user-context";
import { canResubmitMemo } from "@/lib/prototype-users";

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

const ASSISTANT_TABS_ID = "create-assistant-tabs";
const ASSISTANT_PANEL_ID = "create-assistant-tabpanel";

function CreatePageContent() {
  const searchParams = useSearchParams();
  const reviseId = searchParams.get("revise") ?? null;
  const { memos, dispatch } = useMemos();
  const { user } = usePrototypeUser();
  const router = useRouter();
  const issuer = {
    name: user.name,
    department: user.department,
    role: user.roleLabel,
  };

  // Compute revision context before any useState so lazy initializers can reference it.
  // reviseMemo is null when reviseId is absent, not found, or not in a resubmittable state.
  const reviseMemo = reviseId ? (memos.find(m => m.id === reviseId) ?? null) : null;
  const isRevisionMode = reviseMemo !== null && (
    reviseMemo.status === "returned" ||
    (reviseMemo.status === "rejected" && reviseMemo.rejectDisposition === "revision-allowed")
  ) && canResubmitMemo(user, reviseMemo);

  // ── Content fields — seed from reviseMemo in revision mode, else use defaults ──
  const [subject, setSubject] = useState(() =>
    isRevisionMode ? (reviseMemo!.title ?? "") : "ขออนุมัติซื้ออุปกรณ์สำนักงาน Q2/2026"
  );
  const [category, setCategory] = useState<ApprovalCategory>(() =>
    isRevisionMode ? (reviseMemo!.category ?? "general-purchase") : "general-purchase"
  );
  const [department, setDepartment] = useState(() =>
    isRevisionMode ? (reviseMemo!.department ?? issuer.department) : issuer.department
  );
  const [amount, setAmount] = useState(() =>
    isRevisionMode ? (reviseMemo!.amount ?? 0) : 32000
  );
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus>(() =>
    isRevisionMode ? (reviseMemo!.budgetStatus ?? "in-budget") : "in-budget"
  );
  const [description, setDescription] = useState(() =>
    isRevisionMode
      ? (reviseMemo!.description ?? "")
      : "ขออนุมัติซื้ออุปกรณ์สำนักงานสำหรับสนับสนุนการดำเนินงานของแผนก HR&GA"
  );
  const [isPriceAdjustment, setIsPriceAdjustment] = useState(() =>
    isRevisionMode ? (reviseMemo!.isPriceAdjustment ?? false) : false
  );
  const [followsProductionPlan, setFollowsProductionPlan] = useState(() =>
    isRevisionMode ? (reviseMemo!.followsProductionPlan ?? false) : false
  );
  const [isDeadStockOrSlowMovement, setIsDeadStockOrSlowMovement] = useState(() =>
    isRevisionMode ? (reviseMemo!.isDeadStockOrSlowMovement ?? false) : false
  );
  const [deptMonthlyOverBudgetTotal, setDeptMonthlyOverBudgetTotal] = useState(() =>
    isRevisionMode ? (reviseMemo!.departmentMonthlyOverBudgetTotal ?? 0) : 0
  );
  const [readRecipients, setReadRecipients] = useState(() =>
    isRevisionMode ? (reviseMemo!.readRecipients?.join(", ") ?? "") : "HR&GA, ACC/FIN"
  );
  const [accountCode, setAccountCode] = useState(() =>
    isRevisionMode ? (reviseMemo!.accountCode ?? "") : "GA-OPS-2026"
  );
  const [budgetPlan, setBudgetPlan] = useState(() =>
    isRevisionMode ? (reviseMemo!.budgetPlan ?? 0) : 150000
  );
  const [budgetUsed, setBudgetUsed] = useState(() =>
    isRevisionMode ? (reviseMemo!.budgetUsed ?? 0) : 68000
  );
  const [priceComparisons, setPriceComparisons] = useState<PriceComparison[]>(() => {
    if (isRevisionMode && (reviseMemo!.priceComparisons?.length ?? 0) > 0) {
      return reviseMemo!.priceComparisons!;
    }
    return [{ id: "1", vendorName: "", offeredPrice: 0, discount: 0, vatEnabled: false, netPrice: 0, remark: "", isSelected: true }];
  });
  const [selectedVendorReason, setSelectedVendorReason] = useState(() =>
    isRevisionMode ? (reviseMemo!.selectedVendorReason ?? "") : ""
  );
  const [requestItems, setRequestItems] = useState<RequestItem[]>(() => {
    if (isRevisionMode && (reviseMemo!.requestItems?.length ?? 0) > 0) {
      return reviseMemo!.requestItems!;
    }
    return [{ id: "1", name: "", unit: "ชิ้น", qty: 1, unitPrice: 0 }];
  });
  const [priceAdjustmentReason, setPriceAdjustmentReason] = useState(() =>
    isRevisionMode ? (reviseMemo!.priceAdjustmentReason ?? "") : ""
  );

  // ── Routing fields — always default to fresh recommendation (user decision) ──
  // The recommendation is recomputed from the prefilled content fields, so the
  // routing card shows the correct Book1 recommendation for the revised data.
  const [chosenApprover, setChosenApprover] = useState<ApprovalLevel | null>(null);
  const [skipGmStep, setSkipGmStep] = useState(false);
  const [routeOverrideReason, setRouteOverrideReason] = useState("");

  // ── UI / AI state — always defaults ──
  const [currentDateTime, setCurrentDateTime] = useState<Date | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // ── Assistant panel state — extracted to hook for localStorage persistence ──
  const { assistantExpanded, assistantTab, assistantHydrated, setAssistantExpanded, setAssistantTab } =
    useCreateMemoAssistant();

  const addAttachmentFiles = (files: File[]) => {
    setAttachmentError(null);
    const invalid = files.find((file) => file.size > MAX_ATTACHMENT_BYTES || !isAllowedAttachmentFile(file.name, file.type));
    if (invalid) {
      setAttachmentError(`${invalid.name} is not allowed or exceeds 10 MB.`);
      return;
    }
    setAttachmentFiles((prev) => [...prev, ...files]);
  };

  const removeAttachmentFile = (index: number) => {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
    setAttachmentError(null);
  };

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
    // Only wipe the override reason when the selected vendor actually changes.
    const currentSelected = priceComparisons.find(r => r.isSelected);
    if (currentSelected?.id !== id) setSelectedVendorReason("");
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

  const uploadSelectedAttachments = async (memoId: string): Promise<MemoAttachment[] | undefined> => {
    if (attachmentFiles.length === 0) return undefined;
    const formData = new FormData();
    formData.append("memoId", memoId);
    for (const file of attachmentFiles) formData.append("files", file);

    const response = await fetch("/api/attachments", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: "Unable to upload attachments" }));
      throw new Error(String(body.error ?? "Unable to upload attachments"));
    }
    const body = await response.json() as { attachments: MemoAttachment[] };
    return body.attachments.length > 0 ? body.attachments : undefined;
  };

  const handleSubmit = async (status: "draft" | "pending") => {
    if (status === "pending" && !canSubmitPending) return;
    if (status === "draft" && isRevisionMode) return; // Save Draft is not available in revision mode
    if (isSubmitting) return;

    const now = new Date();
    const stamp = formatTimestamp(now);
    setIsSubmitting(true);
    setAttachmentError(null);

    if (isRevisionMode) {
      // Dispatch SUBMIT_REVISION — applies new content to the existing memo and increments revision.
      dispatch({
        type: "SUBMIT_REVISION",
        id: reviseMemo!.id,
        title: subject,
        category,
        department,
        amount,
        description: description.trim() || undefined,
        budgetStatus,
        accountCode: accountCode.trim() || undefined,
        budgetPlan,
        budgetUsed,
        requestItems: requestItems.filter(r => r.name.trim() || r.unitPrice > 0),
        priceComparisons,
        selectedVendorId: selectedVendor?.id,
        selectedVendorReason: selectedNotLowest ? cleanVendorReason : undefined,
        priceAdjustmentReason: effectiveIsPriceAdjustment && priceAdjustmentReason.trim() ? priceAdjustmentReason.trim() : undefined,
        isPriceAdjustment: effectiveIsPriceAdjustment || undefined,
        followsProductionPlan: effectiveFollowsProductionPlan || undefined,
        isDeadStockOrSlowMovement: effectiveIsDeadStock || undefined,
        departmentMonthlyOverBudgetTotal: showDeptMonthly && deptMonthlyOverBudgetTotal > 0 ? deptMonthlyOverBudgetTotal : undefined,
        readRecipients: orderedReadRecipients,
        readActions: orderedReadRecipients.length > 0
          ? orderedReadRecipients.map((r): ReadAction => ({ recipient: r, status: "pending" }))
          : undefined,
        recommendedFinalApprover: recommendation.recommendedFinalApprover,
        recommendedRoute: routeReview.recommendedRoute,
        selectedRoute,
        routeMode: routeReview.mode,
        routeOverrideReason: routeReview.requiresReason ? cleanOverrideReason : undefined,
        notifyMD: recommendation.notifyMD,
        updatedAt: stamp,
      });
      router.push("/queue");
      return;
    }

    // Normal new-memo path
    const id = generateMemoId(now);
    const createdTimestamp = formatTimestamp(now);
    let attachments: MemoAttachment[] | undefined;
    try {
      attachments = await uploadSelectedAttachments(id);
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : "Unable to upload attachments");
      setIsSubmitting(false);
      return;
    }
    dispatch({
      type: "ADD_MEMO",
      memo: {
        id, title: subject, requester: user.name, department, category, amount, status,
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
        attachments,
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
          crumbs={isRevisionMode
            ? ["Approval Queue", `${reviseMemo!.id} → แก้ไข`]
            : ["สร้าง Memo", "ฉบับร่างใหม่"]}
          title={isRevisionMode ? "แก้ไขและส่งใหม่" : "สร้าง E-Memo"}
          actions={<>
            {!isRevisionMode && (
              <button className="em-btn" disabled={isSubmitting} onClick={() => handleSubmit("draft")}>
                <IconFileText size={15} /> Save Draft
              </button>
            )}
            <button className="em-btn primary" disabled={!canSubmitPending || isSubmitting} onClick={() => handleSubmit("pending")}>
              <IconMail size={15} />
              {isRevisionMode
                ? `ส่งแก้ไข (Rev.${(reviseMemo!.revisionNo ?? 0) + 1})`
                : "Send to Approval"}
            </button>
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

          {/* Revision mode banner — shows memo ID, target revision, return/reject reason, and cancel */}
          {isRevisionMode && (
            <div style={{
              padding: "10px 16px",
              borderRadius: "var(--r-md)",
              background: "rgba(251,191,36,0.10)",
              border: "1px solid rgba(180,83,9,0.22)",
              color: "var(--amber)",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 4,
            }}>
              <strong>แก้ไขและส่งใหม่:</strong>
              <span>{reviseMemo!.id}</span>
              <span style={{
                fontWeight: 700,
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                borderRadius: 4,
                padding: "1px 6px",
                fontSize: 11,
              }}>
                Rev.{(reviseMemo!.revisionNo ?? 0) + 1}
              </span>
              {reviseMemo!.returnReason && (
                <span style={{ color: "var(--muted)", fontSize: 12 }}>
                  เหตุผลที่ส่งกลับ: {reviseMemo!.returnReason}
                </span>
              )}
              {reviseMemo!.rejectReason && (
                <span style={{ color: "var(--muted)", fontSize: 12 }}>
                  ปฏิเสธ: {reviseMemo!.rejectReason}
                </span>
              )}
              <span style={{ color: "var(--muted)", fontSize: 12, fontStyle: "italic" }}>
                เส้นทางอนุมัติคำนวณใหม่จากข้อมูลที่แก้ไข
              </span>
              <button
                type="button"
                className="em-btn sm ghost"
                style={{ marginLeft: "auto" }}
                onClick={() => router.push("/queue")}
              >
                ยกเลิก
              </button>
            </div>
          )}

          <div className="em-create-stepper">
            <StepDot n="1" label="รายละเอียด Memo" active />
            <div className="em-create-step-connector is-first" aria-hidden="true" />
            <StepDot n="2" label="เส้นทางอนุมัติ" active />
            <div className="em-create-step-connector is-second" aria-hidden="true" />
            <StepDot n="3" label="ตรวจทานและส่ง" active />
            <span className="em-create-step-note">แบบฟอร์มเดียว</span>
          </div>

          <div className={`em-create-top-shell ${assistantExpanded ? "is-expanded" : "is-collapsed"}${assistantHydrated ? " is-ready" : ""}`}>
            <div className="em-create-main-col">
              <MemoDetailsCard
                subject={subject}
                category={category}
                department={department}
                amount={amount}
                budgetStatus={budgetStatus}
                clockTimeLabel={clockTimeLabel}
                clockDateLabel={clockDateLabel}
                issuer={issuer}
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

            {/* Assistant column — single unified tree; CSS drives desktop/mobile layout */}
            <div className={`em-create-assistant-col ${assistantExpanded ? "is-expanded" : "is-collapsed"}`}>

              {/* Icon rail: display:none by default; CSS shows it on desktop when collapsed */}
              <div className="em-create-assistant-rail" aria-label="Assistant rail">
                <button
                  type="button"
                  className={`em-create-assistant-rail-btn ${assistantTab === "routing" ? "is-active" : ""}`}
                  onClick={() => { setAssistantTab("routing"); setAssistantExpanded(true); }}
                  title="Approver Routing"
                  aria-label="Open Approver Routing panel"
                >
                  <IconRoute size={18} />
                </button>
                <button
                  type="button"
                  className={`em-create-assistant-rail-btn ${assistantTab === "draft" ? "is-active" : ""}`}
                  onClick={() => { setAssistantTab("draft"); setAssistantExpanded(true); }}
                  title="AI Draft Preview"
                  aria-label="Open AI Draft Preview panel"
                >
                  <IconSparkles size={18} />
                </button>
              </div>

              {/* Full panel: always rendered; CSS hides it on desktop when collapsed */}
              <div className="em-create-assistant-panel">
                <div className="em-create-assistant-head">
                  <div
                    id={ASSISTANT_TABS_ID}
                    className="em-tabs em-create-assistant-tabs"
                    role="tablist"
                    aria-label="Create memo assistant tabs"
                  >
                    <button
                      id="create-assistant-tab-routing"
                      type="button"
                      role="tab"
                      aria-controls={ASSISTANT_PANEL_ID}
                      aria-selected={assistantTab === "routing"}
                      tabIndex={assistantTab === "routing" ? 0 : -1}
                      className={`em-tab ${assistantTab === "routing" ? "active" : ""}`}
                      onClick={() => setAssistantTab("routing")}
                    >
                      <IconRoute size={14} />
                      Approver Routing
                    </button>
                    <button
                      id="create-assistant-tab-draft"
                      type="button"
                      role="tab"
                      aria-controls={ASSISTANT_PANEL_ID}
                      aria-selected={assistantTab === "draft"}
                      tabIndex={assistantTab === "draft" ? 0 : -1}
                      className={`em-tab ${assistantTab === "draft" ? "active" : ""}`}
                      onClick={() => setAssistantTab("draft")}
                    >
                      <IconSparkles size={14} />
                      AI Draft Preview
                    </button>
                  </div>
                  {/* Collapse button: display:none by default; CSS shows it on desktop only */}
                  <button
                    type="button"
                    className="em-btn sm ghost em-create-assistant-collapse"
                    onClick={() => setAssistantExpanded(false)}
                    aria-label="Collapse assistant panel"
                    title="Collapse assistant panel to icon rail"
                  >
                    <IconChevRight size={14} />
                  </button>
                </div>

                {/* Both panes always mounted; CSS hides inactive pane via data-tab attribute */}
                <div
                  id={ASSISTANT_PANEL_ID}
                  className="em-create-assistant-body"
                  role="tabpanel"
                  aria-labelledby={assistantTab === "routing" ? "create-assistant-tab-routing" : "create-assistant-tab-draft"}
                  data-tab={assistantTab}
                >
                  <div className="em-create-tab-pane" data-pane="routing">
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
                    <div style={{
                      marginTop: 12,
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--r-md)",
                      padding: "12px 14px",
                    }}>
                      <div className="em-eyebrow" style={{ fontSize: 11, marginBottom: 8 }}>
                        ผู้รับทราบ / Read Recipients
                      </div>
                      <div className="em-field">
                        <textarea
                          className="em-textarea"
                          style={{ minHeight: 60 }}
                          value={readRecipients}
                          placeholder="ACC/FIN, QA/QC, Production Manager"
                          onChange={(e) => setReadRecipients(e.target.value)}
                        />
                        <div className="em-help">คั่นด้วย comma หรือขึ้นบรรทัดใหม่ · ลำดับจะถูกบันทึกตามที่ระบุ</div>
                        {orderedReadRecipients.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                            {orderedReadRecipients.map((r, i) => (
                              <span key={`${r}-${i}`} className="em-tier" style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}>
                                {i + 1}. {r}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="em-create-tab-pane" data-pane="draft">
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
                      issuerName={user.name}
                    />
                  </div>
                </div>
              </div>

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
                budgetPlan={budgetPlan}
                setBudgetPlan={setBudgetPlan}
                budgetUsed={budgetUsed}
                setBudgetUsed={setBudgetUsed}
                budgetRemaining={budgetRemaining}
              />

              {isRevisionMode ? (
                <section className="em-card" style={{ display: "grid", gap: 8, alignContent: "start" }}>
                  <div className="em-eyebrow">Attachments</div>
                  <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>
                    Existing attachments stay with this memo. Attachment changes during revision are deferred for the prototype.
                  </div>
                </section>
              ) : (
                <AttachmentsCard
                  files={attachmentFiles}
                  error={attachmentError}
                  onFilesAdded={addAttachmentFiles}
                  onRemoveFile={removeAttachmentFile}
                />
              )}

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

// Suspense wrapper required for useSearchParams() in Next.js App Router.
// When a revise= param is present we wait for DB hydration to settle before
// mounting the form, so the lazy useState initializers always see the real memo
// data rather than the seed-only snapshot that exists on a hard reload.
function CreatePageWithParams() {
  const searchParams = useSearchParams();
  const reviseId = searchParams.get("revise") ?? null;
  const { hydrated } = useMemos();

  if (reviseId && !hydrated) {
    return (
      <div className="em-art">
        <Sidebar />
        <div className="em-work" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 14, color: "var(--muted)" }}>กำลังโหลดข้อมูล...</span>
        </div>
      </div>
    );
  }

  return <CreatePageContent key={reviseId ?? "new"} />;
}

export default function CreatePage() {
  return (
    <Suspense fallback={null}>
      <CreatePageWithParams />
    </Suspense>
  );
}
