import { describe, it, expect } from "vitest";
import { quickSearchMemos, memoSearchHaystack } from "./quick-search";
import type { MemoRecord } from "./approval";

// Minimal MemoRecord factory — only the fields quick-search reads matter.
function memo(over: Partial<MemoRecord>): MemoRecord {
  return {
    id: "EM-2026-001",
    title: "ซื้อหมึกพิมพ์",
    requester: "สมชาย ขายความจริง",
    department: "IT",
    category: "general-purchase",
    amount: 1000,
    status: "pending",
    currentStep: "Manager / Top Section",
    selectedRoute: ["Manager / Top Section"],
    cycleHours: 1,
    createdAt: "01 Jun 2026 09:00",
    updatedAt: "01 Jun 2026 09:00",
    ...over,
  } as MemoRecord;
}

const sample: MemoRecord[] = [
  memo({ id: "EM-2026-001", title: "ซื้อหมึกพิมพ์", department: "IT", requester: "สมชาย ขายความจริง", currentStep: "Manager / Top Section", selectedRoute: ["Manager / Top Section"] }),
  memo({ id: "EM-2026-002", title: "จัดซื้ออะไหล่เครื่องจักร", department: "EN", requester: "วิชาญ ประสิทธิ์ชัย", currentStep: "Managing Director", selectedRoute: ["Manager / Top Section", "General Manager", "Managing Director"] }),
  memo({ id: "EM-2026-003", title: "งบอบรมพนักงาน", department: "HR&GA", requester: "ปุณณวิช ภูประเสริฐ", currentStep: "General Manager", selectedRoute: ["Manager / Top Section", "General Manager"] }),
];

describe("quickSearchMemos", () => {
  it("returns [] for an empty / blank query", () => {
    expect(quickSearchMemos(sample, "")).toEqual([]);
    expect(quickSearchMemos(sample, "   ")).toEqual([]);
  });

  it("matches by doc number (id)", () => {
    const r = quickSearchMemos(sample, "EM-2026-002");
    expect(r.map((m) => m.id)).toEqual(["EM-2026-002"]);
  });

  it("matches by title substring (Thai)", () => {
    const r = quickSearchMemos(sample, "อะไหล่");
    expect(r.map((m) => m.id)).toEqual(["EM-2026-002"]);
  });

  it("matches by department", () => {
    const r = quickSearchMemos(sample, "hr&ga");
    expect(r.map((m) => m.id)).toEqual(["EM-2026-003"]);
  });

  it("matches by requester", () => {
    const r = quickSearchMemos(sample, "วิชาญ");
    expect(r.map((m) => m.id)).toEqual(["EM-2026-002"]);
  });

  it("matches by approver tier / route (currentStep)", () => {
    const r = quickSearchMemos(sample, "Managing Director");
    expect(r.map((m) => m.id)).toEqual(["EM-2026-002"]);
  });

  it("matches a mid-route approver even when not the current step", () => {
    // EM-2026-002's route includes General Manager though its currentStep is MD
    const r = quickSearchMemos(sample, "General Manager");
    expect(r.map((m) => m.id).sort()).toEqual(["EM-2026-002", "EM-2026-003"]);
  });

  it("is case-insensitive", () => {
    expect(quickSearchMemos(sample, "em-2026-001").map((m) => m.id)).toEqual(["EM-2026-001"]);
  });

  it("AND-s multiple whitespace-separated terms", () => {
    // both terms must appear in the same memo's haystack
    expect(quickSearchMemos(sample, "จัดซื้อ EN").map((m) => m.id)).toEqual(["EM-2026-002"]);
    expect(quickSearchMemos(sample, "จัดซื้อ IT")).toEqual([]);
  });

  it("caps results at the given limit", () => {
    const many = Array.from({ length: 20 }, (_, i) => memo({ id: `EM-X-${i}`, title: "common" }));
    expect(quickSearchMemos(many, "common", 6)).toHaveLength(6);
  });
});

describe("memoSearchHaystack", () => {
  it("includes id, title, requester, department, category label, and route, lowercased", () => {
    const hay = memoSearchHaystack(sample[1]);
    expect(hay).toContain("em-2026-002");
    expect(hay).toContain("อะไหล่");
    expect(hay).toContain("en");
    expect(hay).toContain("managing director");
    expect(hay).toContain("general manager"); // from route
    expect(hay).toBe(hay.toLowerCase());
  });
});
