import { describe, expect, it } from "vitest";
import {
  actorDisplayName,
  buildActionMetadata,
  calculateNextStep,
  canActOnStep,
  nowMysqlUtcDateTime,
  parseRouteJson,
} from "./workflow-rules";

const FULL_ROUTE = ["Manager / Top Section", "General Manager", "Managing Director"];

describe("canActOnStep", () => {
  it("manager can act at Manager / Top Section step", () => {
    expect(
      canActOnStep(
        { roles: ["manager"], approval_level: "Manager / Top Section" },
        "Manager / Top Section",
      ),
    ).toBe(true);
  });

  it("manager cannot act at General Manager step", () => {
    expect(
      canActOnStep(
        { roles: ["manager"], approval_level: "Manager / Top Section" },
        "General Manager",
      ),
    ).toBe(false);
  });

  it("GM can act at General Manager step", () => {
    expect(
      canActOnStep(
        { roles: ["general-manager"], approval_level: "General Manager" },
        "General Manager",
      ),
    ).toBe(true);
  });

  it("admin can act at any step", () => {
    expect(
      canActOnStep({ roles: ["admin", "requester"], approval_level: null }, "Managing Director"),
    ).toBe(true);
  });

  it("null approval_level without admin role grants nothing", () => {
    expect(
      canActOnStep({ roles: ["requester"], approval_level: null }, "Manager / Top Section"),
    ).toBe(false);
  });

  it("HR&GA-style user with no admin role and no approval_level cannot act (department is never checked)", () => {
    // canActOnStep deliberately has no department parameter — department name
    // alone must never grant workflow power (CLAUDE.md role/visibility decision).
    expect(
      canActOnStep({ roles: ["requester", "read-recipient"], approval_level: null }, "General Manager"),
    ).toBe(false);
  });
});

describe("parseRouteJson", () => {
  it("parses a JSON string route", () => {
    expect(parseRouteJson(JSON.stringify(FULL_ROUTE))).toEqual(FULL_ROUTE);
  });

  it("accepts an already-parsed array (mysql2 JSON column)", () => {
    expect(parseRouteJson([...FULL_ROUTE])).toEqual(FULL_ROUTE);
  });

  it("returns null for null, invalid JSON, empty arrays, and non-string entries", () => {
    expect(parseRouteJson(null)).toBeNull();
    expect(parseRouteJson("not-json{")).toBeNull();
    expect(parseRouteJson("[]")).toBeNull();
    expect(parseRouteJson([1, 2])).toBeNull();
    expect(parseRouteJson({ steps: FULL_ROUTE })).toBeNull();
  });
});

describe("calculateNextStep", () => {
  it("advances to the next route step and stays pending", () => {
    const result = calculateNextStep(JSON.stringify(FULL_ROUTE), "General Manager");
    expect(result).toEqual({
      ok: true,
      isFinal: false,
      nextCurrentStep: "Managing Director",
      nextStatus: "pending",
      nextWorkflowState: "Checked",
    });
  });

  it("final step approves and keeps the final approver label", () => {
    const result = calculateNextStep(JSON.stringify(FULL_ROUTE), "Managing Director");
    expect(result).toEqual({
      ok: true,
      isFinal: true,
      nextCurrentStep: "Managing Director",
      nextStatus: "approved",
      nextWorkflowState: "Approved",
    });
  });

  it("errors when the route is missing", () => {
    const result = calculateNextStep(null, "General Manager");
    expect(result.ok).toBe(false);
  });

  it("errors when the current step is not in the route", () => {
    const result = calculateNextStep(JSON.stringify(["Manager / Top Section"]), "General Manager");
    expect(result.ok).toBe(false);
  });
});

describe("buildActionMetadata", () => {
  it("includes source web", () => {
    expect(JSON.parse(buildActionMetadata("web"))).toEqual({ source: "web" });
  });

  it("merges extra telegram metadata and the source argument wins", () => {
    const parsed = JSON.parse(
      buildActionMetadata("telegram", {
        telegram_user_id: "123456",
        telegram_message_id: "789",
        source: "spoofed",
      }),
    );
    expect(parsed).toEqual({
      source: "telegram",
      telegram_user_id: "123456",
      telegram_message_id: "789",
    });
  });
});

describe("actorDisplayName", () => {
  it("joins first and last name", () => {
    expect(actorDisplayName({ first_name: "สมชาย", last_name: "รักษ์ดี" })).toBe("สมชาย รักษ์ดี");
  });

  it("trims when last name is empty", () => {
    expect(actorDisplayName({ first_name: "สมชาย", last_name: "" })).toBe("สมชาย");
  });
});

describe("nowMysqlUtcDateTime", () => {
  it("formats a Date as MySQL UTC", () => {
    expect(nowMysqlUtcDateTime(new Date(Date.UTC(2026, 5, 11, 9, 30, 5)))).toBe(
      "2026-06-11 09:30:05",
    );
  });

  it("defaults to now and matches the MySQL shape", () => {
    expect(nowMysqlUtcDateTime()).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});
