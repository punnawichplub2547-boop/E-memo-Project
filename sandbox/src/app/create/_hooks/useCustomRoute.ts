"use client";

import { useCallback, useMemo, useState } from "react";
import { customStepRole, type CustomStepRole } from "@/lib/custom-route";

export type CustomRoutePerson = {
  userId: number;
  name: string;
  approvalLevel: string | null;
  department: string | null;
};

export type RouteSource = "book1" | "custom";

export interface UseCustomRouteInput {
  initialPeople?: CustomRoutePerson[];
  initialSource?: RouteSource;
  /** users.id of the person filling in the form; used only for the self-pick warning. */
  currentUserId: number | null;
}

/** State for the "Customize route เอง" tab on /create. Holds only the picked
 *  people and the active tab — the route tokens themselves are built by the
 *  server at submit time (custom-route-server.ts), so nothing here is trusted. */
export function useCustomRoute({ initialPeople, initialSource, currentUserId }: UseCustomRouteInput) {
  const [routeSource, setRouteSource] = useState<RouteSource>(initialSource ?? "book1");
  const [people, setPeople] = useState<CustomRoutePerson[]>(() => initialPeople ?? []);

  // Q2: duplicates and any individual are allowed — no filtering here on purpose.
  const addPerson = useCallback(
    (person: CustomRoutePerson) => setPeople((prev) => [...prev, person]),
    [],
  );

  const removePerson = useCallback(
    (index: number) =>
      setPeople((prev) => (index < 0 || index >= prev.length ? prev : prev.filter((_, i) => i !== index))),
    [],
  );

  const clearPeople = useCallback(() => setPeople([]), []);

  const movePerson = useCallback(
    (index: number, direction: -1 | 1) =>
      setPeople((prev) => {
        const target = index + direction;
        if (index < 0 || index >= prev.length || target < 0 || target >= prev.length) return prev;
        const next = [...prev];
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      }),
    [],
  );

  const roleOf = useCallback(
    (index: number): CustomStepRole => customStepRole(index + 1, people.length),
    [people.length],
  );

  // Warning only. The server still refuses self-approval (workflow-rules
  // isSelfRequester), so a self-pick would stall the memo — the UI says so
  // instead of blocking the choice, per Q2.
  const selfPickedIndexes = useMemo(
    () =>
      currentUserId == null
        ? []
        : people.map((p, i) => (p.userId === currentUserId ? i : -1)).filter((i) => i >= 0),
    [people, currentUserId],
  );

  const canSubmitCustom = routeSource !== "custom" || people.length > 0;

  const customRoutePayload = useMemo(
    () =>
      routeSource === "custom" && people.length > 0 ? people.map((p) => ({ userId: p.userId })) : undefined,
    [routeSource, people],
  );

  return {
    routeSource,
    setRouteSource,
    people,
    addPerson,
    removePerson,
    movePerson,
    clearPeople,
    roleOf,
    selfPickedIndexes,
    canSubmitCustom,
    customRoutePayload,
  };
}

export type UseCustomRouteResult = ReturnType<typeof useCustomRoute>;
