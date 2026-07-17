// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PriceComparison, RequestItem } from "@/lib/approval";
import { useMemoAiAssist } from "./useMemoAiAssist";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const baseInput = {
  category: "general-purchase" as const,
  amount: 1000,
  department: "IT",
  budgetStatus: "in-budget" as const,
};

const blankVendorRow: PriceComparison[] = [
  { id: "1", vendorName: "", offeredPrice: 0, discount: 0, vatEnabled: false, netPrice: 0, remark: "", isSelected: true },
];
const blankRequestItem: RequestItem[] = [{ id: "1", name: "", unit: "ชิ้น", qty: 1, unitPrice: 0 }];

describe("useMemoAiAssist — AI draft", () => {
  it("calls applyBulkData with subject/description on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ subject: "หัวข้อ AI", description: "รายละเอียด AI" }) }));
    const applyBulkData = vi.fn();
    const { result } = renderHook(() => useMemoAiAssist({
      ...baseInput, priceComparisons: blankVendorRow, requestItems: blankRequestItem, applyBulkData,
    }));
    await act(async () => { await result.current.handleAiSuggest(); });
    expect(applyBulkData).toHaveBeenCalledWith({ title: "หัวข้อ AI", description: "รายละเอียด AI" });
    expect(result.current.aiError).toBeNull();
  });

  it.each([
    ["not_configured", "ยังไม่ได้ตั้งค่า THAILLM_API_KEY ใน .env.local"],
    ["quota_exceeded", "Rate limit — รอ 1 นาทีแล้วลองใหม่"],
    ["parse_error", "AI ตอบผิดรูปแบบ — ลองใหม่อีกครั้ง"],
    ["something_else", "AI ไม่พร้อมใช้งานขณะนี้"],
  ])("sets the right Thai error message for %s", async (error, expectedPrefix) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ error }) }));
    const { result } = renderHook(() => useMemoAiAssist({
      ...baseInput, priceComparisons: blankVendorRow, requestItems: blankRequestItem, applyBulkData: vi.fn(),
    }));
    await act(async () => { await result.current.handleAiSuggest(); });
    expect(result.current.aiError).toContain(expectedPrefix);
  });
});

describe("useMemoAiAssist — PDF extract", () => {
  it.each([
    ["pdf_only", "รองรับเฉพาะไฟล์ PDF เท่านั้น"],
    ["file_too_large", "ไฟล์ใหญ่เกิน 10 MB"],
    ["no_text_in_pdf", "PDF นี้ไม่มีข้อความ (อาจเป็น scan) — กรอกด้วยตนเอง"],
    ["something_else", "ดึงข้อมูลจาก PDF ไม่สำเร็จ — ลองใหม่"],
  ])("sets the right Thai error message for %s", async (error, expected) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ error }) }));
    const { result } = renderHook(() => useMemoAiAssist({
      ...baseInput, priceComparisons: blankVendorRow, requestItems: blankRequestItem, applyBulkData: vi.fn(),
    }));
    await act(async () => { await result.current.handlePdfUpload(new File(["x"], "quote.pdf")); });
    expect(result.current.pdfError).toBe(expected);
  });

  it("replaces the blank first vendor row instead of appending", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ vendor: "ACME", totalAmount: 5000, items: [] }),
    }));
    const applyBulkData = vi.fn();
    const { result } = renderHook(() => useMemoAiAssist({
      ...baseInput, priceComparisons: blankVendorRow, requestItems: blankRequestItem, applyBulkData,
    }));
    await act(async () => { await result.current.handlePdfUpload(new File(["x"], "quote.pdf")); });
    const call = applyBulkData.mock.calls[0][0];
    expect(call.priceComparisons).toHaveLength(1);
    expect(call.priceComparisons[0].vendorName).toBe("ACME");
  });

  it("appends a new vendor row when the existing rows already have data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ vendor: "ACME", totalAmount: 5000, items: [] }),
    }));
    const existingRows: PriceComparison[] = [
      { id: "1", vendorName: "เดิม", offeredPrice: 1000, discount: 0, vatEnabled: false, netPrice: 1000, remark: "", isSelected: true },
    ];
    const applyBulkData = vi.fn();
    const { result } = renderHook(() => useMemoAiAssist({
      ...baseInput, priceComparisons: existingRows, requestItems: blankRequestItem, applyBulkData,
    }));
    await act(async () => { await result.current.handlePdfUpload(new File(["x"], "quote.pdf")); });
    const call = applyBulkData.mock.calls[0][0];
    expect(call.priceComparisons).toHaveLength(2);
    expect(call.priceComparisons[0].isSelected).toBe(false);
    expect(call.priceComparisons[1].vendorName).toBe("ACME");
  });
});
