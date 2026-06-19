import { describe, it, expect } from "vitest";
import { buildAuditQuery, KNOWN_ACTION_TYPES } from "./audit-query";

describe("buildAuditQuery", () => {
  it("(a) no filters → empty whereSql, default limit 50, offset 0", () => {
    const q = buildAuditQuery({});
    expect(q.whereSql).toBe("");
    expect(q.params).toEqual([]);
    expect(q.limit).toBe(50);
    expect(q.offset).toBe(0);
  });

  it("(b) memo filter → memo_no LIKE with %wrapped% param", () => {
    const q = buildAuditQuery({ memo: "EM-2026" });
    expect(q.whereSql).toBe("WHERE m.memo_no LIKE ?");
    expect(q.params).toEqual(["%EM-2026%"]);
  });

  it("(b) action filter (known) → action_type = with exact param", () => {
    const q = buildAuditQuery({ action: "approve" });
    expect(q.whereSql).toBe("WHERE w.action_type = ?");
    expect(q.params).toEqual(["approve"]);
  });

  it("(b) actor filter → actor_name LIKE with %wrapped% param", () => {
    const q = buildAuditQuery({ actor: "สมชาย" });
    expect(q.whereSql).toBe("WHERE w.actor_name LIKE ?");
    expect(q.params).toEqual(["%สมชาย%"]);
  });

  it("(b) from filter → acted_at >= param", () => {
    const q = buildAuditQuery({ from: "2026-06-01" });
    expect(q.whereSql).toBe("WHERE w.acted_at >= ?");
    expect(q.params).toEqual(["2026-06-01"]);
  });

  it("(b) to filter → acted_at <= param", () => {
    const q = buildAuditQuery({ to: "2026-06-30" });
    expect(q.whereSql).toBe("WHERE w.acted_at <= ?");
    expect(q.params).toEqual(["2026-06-30"]);
  });

  it("(c) limit over 100 → clamped to 100", () => {
    expect(buildAuditQuery({ limit: 250 }).limit).toBe(100);
  });

  it("(c) limit below 1 → default 50", () => {
    expect(buildAuditQuery({ limit: 0 }).limit).toBe(50);
    expect(buildAuditQuery({ limit: -5 }).limit).toBe(50);
  });

  it("(c) limit not a number → default 50", () => {
    expect(buildAuditQuery({ limit: Number.NaN }).limit).toBe(50);
  });

  it("(c) limit valid in range → kept (and floored)", () => {
    expect(buildAuditQuery({ limit: 25 }).limit).toBe(25);
    expect(buildAuditQuery({ limit: 25.9 }).limit).toBe(25);
    expect(buildAuditQuery({ limit: 100 }).limit).toBe(100);
    expect(buildAuditQuery({ limit: 1 }).limit).toBe(1);
  });

  it("(c) offset negative → 0; valid kept; NaN → 0", () => {
    expect(buildAuditQuery({ offset: -10 }).offset).toBe(0);
    expect(buildAuditQuery({ offset: 30 }).offset).toBe(30);
    expect(buildAuditQuery({ offset: 30.7 }).offset).toBe(30);
    expect(buildAuditQuery({ offset: Number.NaN }).offset).toBe(0);
  });

  it("(d) action outside the known list → not added to where", () => {
    const q = buildAuditQuery({ action: "totally-made-up" });
    expect(q.whereSql).toBe("");
    expect(q.params).toEqual([]);
  });

  it("(d) every known action type is accepted", () => {
    for (const action of KNOWN_ACTION_TYPES) {
      const q = buildAuditQuery({ action });
      expect(q.whereSql).toBe("WHERE w.action_type = ?");
      expect(q.params).toEqual([action]);
    }
  });

  it("(e) multiple filters → AND-joined in stable order with params aligned", () => {
    const q = buildAuditQuery({
      memo: "EM-1",
      action: "reject",
      actor: "Jane",
      from: "2026-06-01",
      to: "2026-06-30",
      limit: 10,
      offset: 20,
    });
    expect(q.whereSql).toBe(
      "WHERE m.memo_no LIKE ? AND w.action_type = ? AND w.actor_name LIKE ? AND w.acted_at >= ? AND w.acted_at <= ?",
    );
    expect(q.params).toEqual(["%EM-1%", "reject", "%Jane%", "2026-06-01", "2026-06-30"]);
    expect(q.limit).toBe(10);
    expect(q.offset).toBe(20);
  });

  it("ignores empty / whitespace-only string filters", () => {
    const q = buildAuditQuery({ memo: "  ", action: "", actor: "   ", from: "", to: "" });
    expect(q.whereSql).toBe("");
    expect(q.params).toEqual([]);
  });

  it("trims surrounding whitespace on text filters before wrapping", () => {
    const q = buildAuditQuery({ memo: "  EM-9  " });
    expect(q.params).toEqual(["%EM-9%"]);
  });
});
