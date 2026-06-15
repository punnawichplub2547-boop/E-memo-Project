"use client";

import React, { useEffect, useRef, useState } from "react";
import { IconChevDown, IconCheck } from "./icons";

export type FilterOption = { value: string; label: string };

export function FilterDropdown({
  icon,
  label,
  options,
  selected,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  options: FilterOption[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === selected) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="em-filter-dd" ref={rootRef}>
      <button
        type="button"
        className="em-filter-chip"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {icon}
        <span className="em-filter-chip-label">{label}:</span>
        <strong>{current.label}</strong>
        <IconChevDown size={13} />
      </button>
      {open && (
        <div className="em-filter-menu" role="menu">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="menuitemradio"
              aria-checked={opt.value === selected}
              className={`em-filter-item${opt.value === selected ? " is-selected" : ""}`}
              onClick={() => { onSelect(opt.value); setOpen(false); }}
            >
              <span className="em-filter-check">{opt.value === selected && <IconCheck size={13} />}</span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
