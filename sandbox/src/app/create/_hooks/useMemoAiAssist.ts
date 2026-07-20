"use client";

import { useRef, useState } from "react";
import { ApprovalCategory, BudgetStatus, PriceComparison, RequestItem } from "@/lib/approval";
import { coerceNonNegativeNumber, coercePositiveInteger } from "@/lib/number-input";
import { newClientRowId } from "@/lib/client-row-id";

export interface UseMemoAiAssistInput {
  category: ApprovalCategory;
  amount: number;
  department: string;
  budgetStatus: BudgetStatus;
  priceComparisons: PriceComparison[];
  requestItems: RequestItem[];
  applyBulkData: (data: Record<string, unknown>) => void;
}

export function useMemoAiAssist({
  category, amount, department, budgetStatus, priceComparisons, requestItems, applyBulkData,
}: UseMemoAiAssistInput) {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

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
        setAiError("ยังไม่ได้ตั้งค่า THAILLM_API_KEY ใน .env.local");
      } else if (data.error === "quota_exceeded") {
        setAiError("Rate limit — รอ 1 นาทีแล้วลองใหม่");
      } else if (data.error === "parse_error") {
        setAiError("AI ตอบผิดรูปแบบ — ลองใหม่อีกครั้ง");
      } else if (data.error) {
        setAiError(`AI ไม่พร้อมใช้งานขณะนี้${data.detail ? ` (${data.detail})` : ""}`);
      } else {
        applyBulkData({ title: data.subject, description: data.description });
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
        const bulk: Record<string, unknown> = {};
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
            id: newClientRowId(),
            vendorName: data.vendor ?? "",
            offeredPrice: vendorPrice,
            discount: 0,
            vatEnabled: false,
            netPrice: vendorPrice,
            remark: file.name,
            isSelected: true,
          };
          bulk.priceComparisons = isFirstBlank
            ? [newVendorRow]
            : [...priceComparisons.map(r => ({ ...r, isSelected: false })), newVendorRow];
        }
        // Pre-fill request items
        if (Array.isArray(data.items) && data.items.length > 0) {
          const isFirstItemBlank =
            requestItems.length === 1 && !requestItems[0].name && requestItems[0].unitPrice === 0;
          const newItems = data.items.map((it: { name: string; qty: number; unit: string; unitPrice: number }) => ({
            id: newClientRowId(),
            name: it.name,
            unit: it.unit || "ชิ้น",
            qty: coercePositiveInteger(it.qty),
            unitPrice: coerceNonNegativeNumber(it.unitPrice),
          }));
          bulk.requestItems = isFirstItemBlank ? newItems : [...requestItems, ...newItems];
        }
        if (Object.keys(bulk).length > 0) applyBulkData(bulk);
      }
    } catch {
      setPdfError("เชื่อมต่อ server ไม่ได้");
    } finally {
      setIsPdfLoading(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  return {
    isAiLoading, aiError, setAiError,
    isPdfLoading, pdfError, setPdfError,
    pdfInputRef,
    handleAiSuggest, handlePdfUpload,
  };
}
