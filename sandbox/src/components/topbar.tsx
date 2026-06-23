"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NotificationBell } from "./notification-bell";
import { TopbarSearch } from "./topbar-search";
import { useAuth } from "@/lib/auth-context";

interface TopbarProps {
  crumbs?: string[];
  title?: string;
  actions?: React.ReactNode;
  showSearch?: boolean;
}

export function Topbar({ crumbs = [], title, actions, showSearch = true }: TopbarProps) {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const profileInitials = authUser
    ? `${authUser.firstName} ${authUser.lastName}`
        .split(/\s+/)
        .filter(Boolean)
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "";

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

      {showSearch && <TopbarSearch />}

      <div className="em-top-actions">
        {actions}
        {authUser && (
          <Link
            href="/profile"
            className="em-topbar-profile"
            aria-label="โปรไฟล์ของฉัน"
            title="โปรไฟล์ของฉัน"
          >
            {profileInitials || "?"}
          </Link>
        )}
        <NotificationBell />
      </div>
    </header>
  );
}
