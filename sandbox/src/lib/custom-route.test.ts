import { describe, expect, it } from "vitest";
import {
  buildCustomRoute,
  buildCustomStepKey,
  customStepRole,
  findForgedCustomStep,
  describeCustomStep,
  describeCustomStepShort,
  findCustomApprover,
  isCustomRoute,
  isCustomStepKey,
  parseCustomRouteJson,
  parseCustomStepKey,
} from "./custom-route";

const people = [
  { userId: 42, name: "สมชาย ใจดี", approvalLevel: "Manager / Top Section", department: "IT" },
  { userId: 7, name: "สุภาพร เจริญสุข", approvalLevel: "General Manager", department: "PD" },
  { userId: 9, name: "วิทย์ ตระกูลงาม", approvalLevel: null, department: "QA" },
];

describe("custom step keys", () => {
  it("builds a 1-based token carrying the user id", () => {
    expect(buildCustomStepKey(1, 42)).toBe("person:1#42");
    expect(buildCustomStepKey(3, 9)).toBe("person:3#9");
  });

  it("round-trips through parseCustomStepKey", () => {
    expect(parseCustomStepKey("person:3#9")).toEqual({ index: 3, userId: 9 });
  });

  it("returns null for approval-level labels and malformed tokens", () => {
    expect(parseCustomStepKey("Manager / Top Section")).toBeNull();
    expect(parseCustomStepKey("Managing Director")).toBeNull();
    expect(parseCustomStepKey("person:0#5")).toBeNull(); // index must be >= 1
    expect(parseCustomStepKey("person:1#0")).toBeNull(); // userId must be >= 1
    expect(parseCustomStepKey("person:a#5")).toBeNull();
    expect(parseCustomStepKey("person:1")).toBeNull();
    expect(parseCustomStepKey("")).toBeNull();
  });

  it("isCustomStepKey mirrors parseCustomStepKey", () => {
    expect(isCustomStepKey("person:1#42")).toBe(true);
    expect(isCustomStepKey("General Manager")).toBe(false);
  });
});

describe("isCustomRoute", () => {
  it("is true only when every entry is a token", () => {
    expect(isCustomRoute(["person:1#42", "person:2#7"])).toBe(true);
  });

  it("is false for a level route, an empty route, and a mixed route", () => {
    expect(isCustomRoute(["Manager / Top Section", "General Manager"])).toBe(false);
    expect(isCustomRoute([])).toBe(false);
    expect(isCustomRoute(undefined)).toBe(false);
    expect(isCustomRoute(null)).toBe(false);
    expect(isCustomRoute(["person:1#42", "General Manager"])).toBe(false);
  });
});

describe("customStepRole", () => {
  it("marks the last position approve and everyone before it check", () => {
    expect(customStepRole(1, 3)).toBe("check");
    expect(customStepRole(2, 3)).toBe("check");
    expect(customStepRole(3, 3)).toBe("approve");
  });

  it("treats a single-person route as approve", () => {
    expect(customStepRole(1, 1)).toBe("approve");
  });
});

describe("buildCustomRoute", () => {
  it("produces positional tokens and a parallel approver snapshot", () => {
    const { route, approvers } = buildCustomRoute(people);
    expect(route).toEqual(["person:1#42", "person:2#7", "person:3#9"]);
    expect(approvers[0]).toEqual({
      stepKey: "person:1#42",
      userId: 42,
      name: "สมชาย ใจดี",
      approvalLevel: "Manager / Top Section",
      department: "IT",
    });
    expect(approvers[2].approvalLevel).toBeNull();
  });

  it("keeps duplicate people distinct by position", () => {
    const { route } = buildCustomRoute([people[0], people[1], people[0]]);
    expect(route).toEqual(["person:1#42", "person:2#7", "person:3#42"]);
    expect(new Set(route).size).toBe(3);
  });

  it("returns empty arrays for no people", () => {
    expect(buildCustomRoute([])).toEqual({ route: [], approvers: [] });
  });
});

describe("parseCustomRouteJson", () => {
  it("accepts both a JSON string and an already-parsed array", () => {
    const { approvers } = buildCustomRoute(people);
    expect(parseCustomRouteJson(JSON.stringify(approvers))).toEqual(approvers);
    expect(parseCustomRouteJson(approvers)).toEqual(approvers);
  });

  it("returns null for null, invalid JSON, non-arrays, and rows missing a userId", () => {
    expect(parseCustomRouteJson(null)).toBeNull();
    expect(parseCustomRouteJson("not json")).toBeNull();
    expect(parseCustomRouteJson("{}")).toBeNull();
    expect(parseCustomRouteJson([{ stepKey: "person:1#1", name: "x" }])).toBeNull();
  });
});

describe("display helpers", () => {
  it("finds an approver by step key", () => {
    const { approvers } = buildCustomRoute(people);
    expect(findCustomApprover(approvers, "person:2#7")?.name).toBe("สุภาพร เจริญสุข");
    expect(findCustomApprover(approvers, "person:9#7")).toBeNull();
    expect(findCustomApprover(undefined, "person:1#42")).toBeNull();
  });

  it("describes a custom step as name · level · role", () => {
    const { approvers } = buildCustomRoute(people);
    expect(describeCustomStep("person:1#42", approvers, 3)).toBe(
      "สมชาย ใจดี · Manager / Top Section · ตรวจ/เห็นชอบ",
    );
    expect(describeCustomStep("person:3#9", approvers, 3)).toBe("วิทย์ ตระกูลงาม · อนุมัติ");
  });

  it("falls back to a positional label when the snapshot is missing", () => {
    expect(describeCustomStep("person:4#88", null, 6)).toBe("ผู้อนุมัติลำดับที่ 4");
  });

  it("returns a non-token step unchanged", () => {
    expect(describeCustomStep("General Manager", null)).toBe("General Manager");
  });

  it("describeCustomStepShort gives just the person's name for compact cells", () => {
    const { approvers } = buildCustomRoute(people);
    expect(describeCustomStepShort("person:1#42", approvers)).toBe("สมชาย ใจดี");
    expect(describeCustomStepShort("person:3#9", approvers)).toBe("วิทย์ ตระกูลงาม");
  });

  it("describeCustomStepShort falls back positionally and passes level labels through", () => {
    expect(describeCustomStepShort("person:4#88", null)).toBe("ผู้อนุมัติลำดับที่ 4");
    expect(describeCustomStepShort("General Manager", null)).toBe("General Manager");
  });
});

// A person token is an authorization primitive: canActOnStep reads the user id
// straight out of the step string. Only the server may mint one, so any token
// arriving on a request that did not go through resolveCustomRouteFromRequest is
// forged and must be refused outright.
describe("findForgedCustomStep", () => {
  it("finds a token in a route the server did not build", () => {
    expect(findForgedCustomStep(["person:1#999", "Managing Director"])).toBe("person:1#999");
  });

  it("finds a token in any of the routes it is given", () => {
    expect(findForgedCustomStep(["General Manager"], ["person:2#6"])).toBe("person:2#6");
  });

  it("returns null for plain Book1 level routes", () => {
    expect(findForgedCustomStep(["Manager / Top Section", "General Manager"])).toBeNull();
  });

  it("tolerates missing, empty and non-string entries", () => {
    expect(findForgedCustomStep(undefined, null, [], [42, { userId: 9 }, null])).toBeNull();
  });

  it("ignores a value that merely looks like a token", () => {
    expect(findForgedCustomStep(["person:0#1", "person:abc", "person:1#0"])).toBeNull();
  });
});
