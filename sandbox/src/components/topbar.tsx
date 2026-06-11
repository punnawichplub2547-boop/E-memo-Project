"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { IconSearch, IconBell } from "./icons";

interface TopbarProps {
  crumbs?: string[];
  title?: string;
  actions?: React.ReactNode;
  showSearch?: boolean;
}

export function Topbar({ crumbs = [], title, actions, showSearch = true }: TopbarProps) {
  const router = useRouter();

  useEffect(() => {
    if (!showSearch) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push("/search");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showSearch, router]);

  return (
    <header className="em-topbar">
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        {crumbs.length > 0 && (
          <div className="em-crumbs">
            <span>Complete Auto Rubber</span>
            <span className="sep">/</span>
            <span>HR&amp;GA</span>
            <span className="sep">/</span>
            {crumbs.map((c, i) => (
              <React.Fragment key={i}>
                <strong>{c}</strong>
                {i < crumbs.length - 1 && <span className="sep">/</span>}
              </React.Fragment>
            ))}
          </div>
        )}
        {title && <div className="em-page-title">{title}</div>}
      </div>

      {showSearch && (
        <button
          type="button"
          className="em-top-search"
          onClick={() => router.push("/search")}
          title="ค้นหา memo (Ctrl+K)"
          style={{ cursor: "pointer", font: "inherit", textAlign: "left" }}
        >
          <IconSearch size={15} />
          <span>ค้นหา memo, ผู้อนุมัติ, แผนก…</span>
          <span className="em-kbd">⌘K</span>
        </button>
      )}

      <div className="em-top-actions">
        {actions}
        <div className="em-bell">
          <IconBell size={17} />
        </div>
      </div>
    </header>
  );
}
