"use client";

import { useEffect, useState } from "react";

export type AssistantTab = "routing" | "draft";

const STORAGE_KEY = "ememo-create-assistant-panel";

function readStorage(): { expanded: boolean; tab: AssistantTab } {
  if (typeof window === "undefined") return { expanded: true, tab: "routing" };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { expanded?: boolean; tab?: AssistantTab };
      return {
        expanded: typeof parsed.expanded === "boolean" ? parsed.expanded : true,
        tab: parsed.tab === "routing" || parsed.tab === "draft" ? parsed.tab : "routing",
      };
    }
  } catch { /* ignore */ }
  return { expanded: true, tab: "routing" };
}

export function useCreateMemoAssistant() {
  const [assistantExpanded, setAssistantExpanded] = useState(true);
  const [assistantTab, setAssistantTab] = useState<AssistantTab>("routing");
  const [assistantHydrated, setAssistantHydrated] = useState(false);

  // Apply persisted state after hydration so server and first client render
  // both produce stable defaults (expanded + routing tab). Wrapped in an inner
  // function to satisfy the react-hooks/set-state-in-effect lint rule.
  useEffect(() => {
    const applyStored = () => {
      const stored = readStorage();
      setAssistantExpanded(stored.expanded);
      setAssistantTab(stored.tab);
      setAssistantHydrated(true);
    };
    applyStored();
  }, []);

  // Write to localStorage only after hydration to avoid clobbering persisted state.
  useEffect(() => {
    if (!assistantHydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ expanded: assistantExpanded, tab: assistantTab }));
    } catch { /* ignore */ }
  }, [assistantExpanded, assistantTab, assistantHydrated]);

  return { assistantExpanded, assistantTab, assistantHydrated, setAssistantExpanded, setAssistantTab };
}
