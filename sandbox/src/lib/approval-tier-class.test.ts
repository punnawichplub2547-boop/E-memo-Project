import { describe, it, expect } from "vitest";
import { approvalTierClass } from "./approval-tier-class";

describe("approvalTierClass", () => {
  it("gives each tier its own colour modifier", () => {
    expect(approvalTierClass("Managing Director")).toBe("md");
    expect(approvalTierClass("General Manager")).toBe("gm");
    expect(approvalTierClass("Manager / Top Section")).toBe("mgr");
  });

  // Supervisor has no dedicated .em-tier colour in globals.css; the manager
  // palette is the intended fallback, not an accident.
  it("falls back to the manager palette for Supervisor", () => {
    expect(approvalTierClass("Supervisor")).toBe("mgr");
  });

  // The bug this closes: every tier rendered in the Manager colour, on the very
  // card whose job is to show the gap between the Book1 recommendation and the
  // route actually picked. A test that only checked one level would not have
  // caught it, so all four are asserted and they must differ where the CSS does.
  it("does not collapse MD and GM onto the Manager colour", () => {
    expect(approvalTierClass("Managing Director")).not.toBe("mgr");
    expect(approvalTierClass("General Manager")).not.toBe("mgr");
    expect(approvalTierClass("Managing Director")).not.toBe(approvalTierClass("General Manager"));
  });
});
