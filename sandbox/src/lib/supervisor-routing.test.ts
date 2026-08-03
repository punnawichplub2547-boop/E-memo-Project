import { describe, expect, it } from "vitest";
import { applySupervisorRouting } from "./supervisor-routing";

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
