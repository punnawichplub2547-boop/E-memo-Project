import { describe, expect, it } from "vitest";
import { applySupervisorRouting } from "./supervisor-routing";
import { buildCustomRoute, isCustomRoute } from "./custom-route";

describe("applySupervisorRouting", () => {
  it("prepends Supervisor to both routes when the department has an active Supervisor", () => {
    const result = applySupervisorRouting(
      ["Manager / Top Section", "General Manager"],
      ["Manager / Top Section", "General Manager"],
      true,
    );
    expect(result.selectedRoute).toEqual(["Supervisor", "Manager / Top Section", "General Manager"]);
    expect(result.recommendedRoute).toEqual(["Supervisor", "Manager / Top Section", "General Manager"]);
  });

  it("does NOT prepend when the department has no Supervisor (unchanged route)", () => {
    const result = applySupervisorRouting(
      ["Manager / Top Section", "General Manager"],
      ["Manager / Top Section"],
      false,
    );
    expect(result.selectedRoute).toEqual(["Manager / Top Section", "General Manager"]);
    expect(result.recommendedRoute).toEqual(["Manager / Top Section"]);
  });

  it("strips any client-supplied Supervisor before deciding (server is authoritative)", () => {
    // Client tried to inject Supervisor but the department has none → it must be removed.
    const result = applySupervisorRouting(
      ["Supervisor", "Manager / Top Section"],
      ["Supervisor", "Manager / Top Section"],
      false,
    );
    expect(result.selectedRoute).toEqual(["Manager / Top Section"]);
    expect(result.recommendedRoute).toEqual(["Manager / Top Section"]);
  });

  it("never double-prepends when the client already sent a Supervisor and the dept has one", () => {
    const result = applySupervisorRouting(
      ["Supervisor", "Manager / Top Section"],
      ["Manager / Top Section"],
      true,
    );
    expect(result.selectedRoute).toEqual(["Supervisor", "Manager / Top Section"]);
    expect(result.recommendedRoute).toEqual(["Supervisor", "Manager / Top Section"]);
  });

  it("treats undefined routes as empty and does not create a Supervisor-only route", () => {
    const result = applySupervisorRouting(undefined, undefined, true);
    expect(result.selectedRoute).toEqual([]);
    expect(result.recommendedRoute).toEqual([]);
  });
});

describe("applySupervisorRouting — custom per-person routes", () => {
  it("never prepends Supervisor to a custom per-person route", () => {
    const result = applySupervisorRouting(
      ["person:1#42", "person:2#7"],
      ["person:1#42", "person:2#7"],
      true,
    );
    expect(result.selectedRoute).toEqual(["person:1#42", "person:2#7"]);
    expect(result.recommendedRoute).toEqual(["person:1#42", "person:2#7"]);
  });

  it("leaves the route recognizable as custom (the all-or-nothing predicate)", () => {
    const { route } = buildCustomRoute([
      { userId: 42, name: "สมชาย ใจดี", approvalLevel: null, department: "IT" },
      { userId: 7, name: "สุภาพร เจริญสุข", approvalLevel: "General Manager", department: "PD" },
    ]);
    const result = applySupervisorRouting(route, route, true);
    expect(isCustomRoute(result.selectedRoute)).toBe(true);
    expect(isCustomRoute(result.recommendedRoute)).toBe(true);
  });

  it("still prepends Supervisor to a level route", () => {
    const result = applySupervisorRouting(["Manager / Top Section"], ["Manager / Top Section"], true);
    expect(result.selectedRoute).toEqual(["Supervisor", "Manager / Top Section"]);
  });
});
