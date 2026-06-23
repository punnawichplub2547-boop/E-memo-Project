"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconSearch, IconCrown, IconUsers, IconArrowRight } from "./icons";
import { useMemos } from "@/lib/memo-store";
import { quickSearchMemos } from "@/lib/quick-search";

const MAX_RESULTS = 6;

// Inline topbar search: type to filter the memos this session can see, pick a
// result to jump straight to its queue drawer. Ctrl/Cmd+K (handled in Topbar)
// still opens the AI Search page.
export function TopbarSearch() {
  const router = useRouter();
  const { memos } = useMemos();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  const results = useMemo(
    () => quickSearchMemos(memos, query, MAX_RESULTS),
    [memos, query],
  );

  const trimmed = query.trim();
  const showMenu = open && trimmed.length > 0;

  // Close on outside click / Escape.
  useEffect(() => {
    if (!showMenu) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [showMenu]);

  // Clamp in render rather than via an effect: when results shrink, an out-of-
  // range index simply highlights nothing and Enter falls through to "see all".
  const activeRow = activeIndex >= 0 ? results[activeIndex] : undefined;

  function openMemo(memoId: string) {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
    router.push(`/queue?memo=${encodeURIComponent(memoId)}`);
  }

  function seeAll() {
    if (!trimmed) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      e.currentTarget.blur();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
      return;
    }
    if (e.key === "Enter") {
      if (activeRow) {
        openMemo(activeRow.id);
      } else {
        seeAll();
      }
    }
  }

  return (
    <div className="em-top-search" ref={rootRef}>
      <IconSearch size={15} style={{ color: "var(--muted)", flexShrink: 0 }} />
      <input
        className="em-top-search-input"
        type="text"
        value={query}
        placeholder="ค้นหา memo, ผู้อนุมัติ, แผนก, เลขเอกสาร…"
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveIndex(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={showMenu}
        aria-controls="em-top-search-menu"
        aria-autocomplete="list"
      />
      <span className="em-kbd">⌘K</span>

      {showMenu && (
        <div className="em-top-search-menu" id="em-top-search-menu" role="listbox">
          {results.length === 0 ? (
            <div className="em-top-search-empty">ไม่พบเมโมที่ตรงกับ “{trimmed}”</div>
          ) : (
            results.map((m, i) => {
              const isMd = m.currentStep === "Managing Director";
              const isGm = m.currentStep === "General Manager";
              return (
                <button
                  key={m.id}
                  type="button"
                  role="option"
                  aria-selected={i === activeIndex}
                  className={`em-top-search-item${i === activeIndex ? " is-active" : ""}`}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => openMemo(m.id)}
                >
                  <span className="em-id" style={{ fontSize: 11, flexShrink: 0 }}>{m.id}</span>
                  <span className="em-top-search-title">{m.title}</span>
                  <span className={`em-tier ${isMd ? "md" : isGm ? "gm" : "mgr"}`} style={{ height: 18, padding: "0 6px", fontSize: 10, flexShrink: 0 }}>
                    {isMd ? <IconCrown size={10} /> : <IconUsers size={10} />}
                    {isMd ? "MD" : isGm ? "GM" : "Mgr"}
                  </span>
                </button>
              );
            })
          )}
          <button type="button" className="em-top-search-all" onClick={seeAll}>
            ดูผลทั้งหมด <IconArrowRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
