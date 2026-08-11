"use client";

import { useEffect, useRef, useState } from "react";
import { IconSearch } from "@/components/icons";
import type { CustomRoutePerson } from "../_hooks/useCustomRoute";

type SearchRow = {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  approvalLevel: string | null;
};

/** Search box for the custom-route tab. Uses scope=approver so the Managing
 *  Director is selectable here — the CC picker's default scope still hides them. */
export function ApproverPicker({ onPick }: { onPick: (person: CustomRoutePerson) => void }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    },
    [],
  );

  const runSearch = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      abortRef.current?.abort();
      setRows([]);
      setMessage("");
      setBusy(false);
      return;
    }
    setBusy(true);
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(
          `/api/users/search?scope=approver&q=${encodeURIComponent(value.trim())}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!res.ok) throw new Error("search failed");
        const body = (await res.json()) as { users?: SearchRow[] };
        const users = body.users ?? [];
        setRows(users);
        setMessage(users.length === 0 ? "ไม่พบผู้ใช้ที่ตรงกับคำค้น" : "");
      } catch (error) {
        // A superseded request is not a failure the user should be told about.
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRows([]);
        setMessage("ค้นหาผู้ใช้ไม่สำเร็จ");
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 250);
  };

  return (
    <div className="em-field" style={{ gap: 6 }}>
      <label className="em-label" style={{ fontSize: 11.5 }} htmlFor="em-approver-search">
        ค้นหาผู้อนุมัติ (ชื่อ หรือ อีเมล)
      </label>
      <div className="em-input-prefix" style={{ paddingLeft: 12 }}>
        <IconSearch size={14} style={{ color: "var(--muted)", flexShrink: 0 }} />
        <input
          id="em-approver-search"
          className="em-input"
          style={{ border: 0, background: "transparent", flex: 1, height: 32, minWidth: 0 }}
          placeholder="พิมพ์อย่างน้อย 2 ตัวอักษร"
          value={query}
          onChange={(e) => runSearch(e.target.value)}
        />
      </div>
      {busy && <div className="em-help">กำลังค้นหา…</div>}
      {!busy && message && <div className="em-help">{message}</div>}
      {rows.length > 0 && (
        <div className="em-approver-results">
          {rows.map((row) => (
            <button
              key={row.userId}
              type="button"
              className="em-approver-result"
              onClick={() => {
                onPick({
                  userId: row.userId,
                  name: `${row.firstName} ${row.lastName}`.trim(),
                  approvalLevel: row.approvalLevel,
                  department: row.department,
                });
                setQuery("");
                setRows([]);
                setMessage("");
              }}
            >
              <span style={{ fontWeight: 600 }}>
                {row.firstName} {row.lastName}
              </span>
              <span style={{ color: "var(--muted)", fontSize: 11.5 }}>
                {row.approvalLevel ?? "ไม่มีระดับอนุมัติ"} · {row.department}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
