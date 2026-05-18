"use client";

import React from "react";
import { IconSearch, IconBell } from "./icons";

interface TopbarProps {
  crumbs?: string[];
  title?: string;
  actions?: React.ReactNode;
  showSearch?: boolean;
}

export function Topbar({ crumbs = [], title, actions, showSearch = true }: TopbarProps) {
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
        <div className="em-top-search">
          <IconSearch size={15} />
          <span>ค้นหา memo, ผู้อนุมัติ, แผนก…</span>
          <span className="em-kbd">⌘K</span>
        </div>
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
