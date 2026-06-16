"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { IconBell, IconCheck } from "./icons";
import { toSafeInternalPath } from "@/lib/safe-path";

type NotificationItem = {
  id: number;
  memoId: number | null;
  type: string;
  title: string;
  body: string | null;
  actionUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

const POLL_MS = 30_000;

// DB stores naive UTC datetimes ("YYYY-MM-DD HH:MM:SS"); treat them as UTC.
function parseUtc(value: string): number {
  const normalized = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const ms = Date.parse(normalized);
  return Number.isNaN(ms) ? Date.now() : ms;
}

function relativeThai(createdAt: string): string {
  const diffSec = Math.max(0, Math.round((Date.now() - parseUtc(createdAt)) / 1000));
  if (diffSec < 60) return "เมื่อสักครู่";
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min} นาทีที่แล้ว`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ชม.ที่แล้ว`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} วันที่แล้ว`;
  return new Date(parseUtc(createdAt)).toLocaleDateString("th-TH");
}

export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setItems([]);
          setUnread(0);
        }
        return;
      }
      const data = (await res.json()) as { notifications: NotificationItem[]; unreadCount: number };
      setItems(data.notifications ?? []);
      setUnread(data.unreadCount ?? 0);
    } catch {
      // network blip — keep previous state, retry on next poll
    }
  }, []);

  useEffect(() => {
    // load() only setState after an awaited fetch (never synchronously), so this is
    // not the cascading-render case the rule guards against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const computePanelPos = useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPanelPos({ top: rect.bottom + 8, right: Math.max(16, window.innerWidth - rect.right) });
  }, []);

  const toggleOpen = useCallback(() => {
    setOpen((v) => {
      const next = !v;
      if (next) {
        computePanelPos();
        void load(); // refresh immediately when opening
      }
      return next;
    });
  }, [load, computePanelPos]);

  // Close on outside click / Escape; reposition on resize.
  // The panel renders in a portal (see below), so "outside" must exclude both
  // the bell button (rootRef) and the portaled panel itself (panelRef).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onResize = () => computePanelPos();
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open, computePanelPos]);

  const handleItemClick = useCallback(
    async (item: NotificationItem) => {
      // Optimistic mark-read; persist in the background.
      if (!item.isRead) {
        setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
        setUnread((c) => Math.max(0, c - 1));
        fetch(`/api/notifications/${item.id}/read`, { method: "POST" }).catch(() => {});
      }
      setOpen(false);
      // action_url is a free-form column — only ever navigate to a same-origin path.
      const dest = toSafeInternalPath(item.actionUrl, window.location.origin);
      if (dest) router.push(dest);
    },
    [router],
  );

  const handleMarkAll = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
    } catch {
      // fall back to a reload on next poll
    }
    load();
  }, [load]);

  const badge = unread > 99 ? "99+" : String(unread);

  return (
    <div className="em-bell-wrap" ref={rootRef}>
      <button
        type="button"
        className={`em-bell${unread > 0 ? " has-unread" : ""}`}
        onClick={toggleOpen}
        aria-label={unread > 0 ? `การแจ้งเตือน ${unread} รายการที่ยังไม่อ่าน` : "การแจ้งเตือน"}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <IconBell size={17} />
        {unread > 0 && <span className="em-bell-badge">{badge}</span>}
      </button>

      {open &&
        panelPos &&
        createPortal(
          <div
            className="em-notif-panel"
            role="menu"
            ref={panelRef}
            style={{ top: panelPos.top, right: panelPos.right }}
          >
            <div className="em-notif-head">
              <span className="em-notif-title">การแจ้งเตือน</span>
              {unread > 0 && (
                <button type="button" className="em-notif-readall" onClick={handleMarkAll}>
                  <IconCheck size={13} /> อ่านทั้งหมด
                </button>
              )}
            </div>

            <div className="em-notif-list">
              {items.length === 0 ? (
                <div className="em-notif-empty">ยังไม่มีการแจ้งเตือน</div>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`em-notif-item${item.isRead ? "" : " is-unread"}`}
                    onClick={() => handleItemClick(item)}
                    role="menuitem"
                  >
                    {!item.isRead && <span className="em-notif-dot" aria-hidden />}
                    <span className="em-notif-body">
                      <span className="em-notif-item-title">{item.title}</span>
                      {item.body && <span className="em-notif-item-sub">{item.body}</span>}
                      <span className="em-notif-time">{relativeThai(item.createdAt)}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
