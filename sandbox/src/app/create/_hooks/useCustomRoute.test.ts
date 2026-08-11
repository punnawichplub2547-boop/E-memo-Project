// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useCustomRoute } from "./useCustomRoute";

const a = { userId: 42, name: "สมชาย ใจดี", approvalLevel: "Manager / Top Section", department: "IT" };
const b = { userId: 7, name: "สุภาพร เจริญสุข", approvalLevel: "General Manager", department: "PD" };
const c = { userId: 9, name: "วิทย์ ตระกูลงาม", approvalLevel: null, department: "QA" };

afterEach(cleanup);

describe("useCustomRoute", () => {
  it("starts on the Book1 tab with no people", () => {
    const { result } = renderHook(() => useCustomRoute({ currentUserId: 1 }));
    expect(result.current.routeSource).toBe("book1");
    expect(result.current.people).toEqual([]);
    expect(result.current.customRoutePayload).toBeUndefined();
  });

  it("adds people in order and derives check/approve roles", () => {
    const { result } = renderHook(() => useCustomRoute({ currentUserId: 1 }));
    act(() => { result.current.setRouteSource("custom"); });
    act(() => { result.current.addPerson(a); });
    act(() => { result.current.addPerson(b); });
    act(() => { result.current.addPerson(c); });
    expect(result.current.people.map((p) => p.userId)).toEqual([42, 7, 9]);
    expect(result.current.roleOf(0)).toBe("check");
    expect(result.current.roleOf(1)).toBe("check");
    expect(result.current.roleOf(2)).toBe("approve");
  });

  it("treats a single person as the approver", () => {
    const { result } = renderHook(() => useCustomRoute({ currentUserId: 1 }));
    act(() => { result.current.addPerson(a); });
    expect(result.current.roleOf(0)).toBe("approve");
  });

  it("allows the same person twice (Q2: no guard)", () => {
    const { result } = renderHook(() => useCustomRoute({ currentUserId: 1 }));
    act(() => { result.current.addPerson(a); });
    act(() => { result.current.addPerson(a); });
    expect(result.current.people).toHaveLength(2);
    expect(result.current.people.map((p) => p.userId)).toEqual([42, 42]);
  });

  it("moves and removes people", () => {
    const { result } = renderHook(() => useCustomRoute({ initialPeople: [a, b, c], currentUserId: 1 }));
    act(() => { result.current.movePerson(0, 1); });
    expect(result.current.people.map((p) => p.userId)).toEqual([7, 42, 9]);
    act(() => { result.current.movePerson(0, -1); });
    expect(result.current.people.map((p) => p.userId)).toEqual([7, 42, 9]); // no-op at the top
    act(() => { result.current.movePerson(2, 1); });
    expect(result.current.people.map((p) => p.userId)).toEqual([7, 42, 9]); // no-op at the bottom
    act(() => { result.current.removePerson(1); });
    expect(result.current.people.map((p) => p.userId)).toEqual([7, 9]);
  });

  it("ignores a move or remove with an out-of-range index", () => {
    const { result } = renderHook(() => useCustomRoute({ initialPeople: [a, b], currentUserId: 1 }));
    act(() => { result.current.movePerson(5, -1); });
    act(() => { result.current.removePerson(9); });
    expect(result.current.people.map((p) => p.userId)).toEqual([42, 7]);
  });

  it("clears every picked person", () => {
    const { result } = renderHook(() => useCustomRoute({ initialPeople: [a, b], currentUserId: 1 }));
    act(() => { result.current.clearPeople(); });
    expect(result.current.people).toEqual([]);
  });

  it("flags a self-pick without blocking it", () => {
    const { result } = renderHook(() => useCustomRoute({ initialPeople: [a, b], currentUserId: 42 }));
    expect(result.current.selfPickedIndexes).toEqual([0]);
    expect(result.current.canSubmitCustom).toBe(true);
  });

  it("flags every position a self-pick appears in, and none when the user is unknown", () => {
    const { result } = renderHook(() => useCustomRoute({ initialPeople: [a, b, a], currentUserId: 42 }));
    expect(result.current.selfPickedIndexes).toEqual([0, 2]);

    const anon = renderHook(() => useCustomRoute({ initialPeople: [a, b], currentUserId: null }));
    expect(anon.result.current.selfPickedIndexes).toEqual([]);
  });

  it("cannot submit an empty custom route", () => {
    const { result } = renderHook(() => useCustomRoute({ currentUserId: 1 }));
    act(() => { result.current.setRouteSource("custom"); });
    expect(result.current.canSubmitCustom).toBe(false);
  });

  it("can always submit while the Book1 tab is active", () => {
    const { result } = renderHook(() => useCustomRoute({ currentUserId: 1 }));
    expect(result.current.canSubmitCustom).toBe(true);
  });

  it("emits a payload of user ids only, in order, when on the custom tab", () => {
    const { result } = renderHook(() => useCustomRoute({ initialPeople: [a, b], currentUserId: 1 }));
    act(() => { result.current.setRouteSource("custom"); });
    expect(result.current.customRoutePayload).toEqual([{ userId: 42 }, { userId: 7 }]);
  });

  it("emits no payload while the Book1 tab is active, even with people picked", () => {
    const { result } = renderHook(() => useCustomRoute({ initialPeople: [a, b], currentUserId: 1 }));
    expect(result.current.routeSource).toBe("book1");
    expect(result.current.customRoutePayload).toBeUndefined();
  });

  it("keeps the picked people when the user switches tabs back and forth", () => {
    const { result } = renderHook(() => useCustomRoute({ initialPeople: [a], currentUserId: 1, initialSource: "custom" }));
    act(() => { result.current.setRouteSource("book1"); });
    act(() => { result.current.setRouteSource("custom"); });
    expect(result.current.people.map((p) => p.userId)).toEqual([42]);
    expect(result.current.customRoutePayload).toEqual([{ userId: 42 }]);
  });

  it("starts on the custom tab when seeded with people from a revision", () => {
    const { result } = renderHook(() => useCustomRoute({ initialPeople: [a], currentUserId: 1, initialSource: "custom" }));
    expect(result.current.routeSource).toBe("custom");
    expect(result.current.people.map((p) => p.userId)).toEqual([42]);
  });
});
