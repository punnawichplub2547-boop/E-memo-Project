import { describe, expect, it, vi } from "vitest";
import {
  resolveApprovalStepRecipients,
  resolveReadRecipientLabels,
  resolveRequesterRecipient,
} from "./notification-recipients";
import type { Pool } from "mysql2/promise";

function pool1(rows: unknown[]): Pool {
  return { query: vi.fn().mockResolvedValue([rows, undefined]) } as unknown as Pool;
}

describe("resolveApprovalStepRecipients", () => {
  it("returns user ids for active users at approval level", async () => {
    const result = await resolveApprovalStepRecipients("General Manager", pool1([{ id: 7 }, { id: 8 }]));
    expect(result).toEqual([7, 8]);
  });
  it("returns empty array when no match", async () => {
    expect(await resolveApprovalStepRecipients("MD", pool1([]))).toEqual([]);
  });
});

describe("resolveRequesterRecipient", () => {
  it("returns id when name matches", async () => {
    expect(await resolveRequesterRecipient("สมชาย รักษ์ดี", pool1([{ id: 5 }]))).toBe(5);
  });
  it("returns null when no match", async () => {
    expect(await resolveRequesterRecipient("ไม่มี", pool1([]))).toBeNull();
  });
});

describe("resolveReadRecipientLabels", () => {
  it("deduplicates results", async () => {
    const result = await resolveReadRecipientLabels(["HR&GA"], pool1([{ id: 4 }, { id: 4 }]));
    expect(result.filter(id => id === 4).length).toBe(1);
  });
});
