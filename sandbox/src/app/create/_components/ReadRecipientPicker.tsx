"use client";
import { useRef, useState, useEffect } from "react";

type UserSuggestion = {
  email: string;
  firstName: string;
  lastName: string;
  department: string;
};

type Props = {
  value: string[];
  onChange: (emails: string[]) => void;
};

export function ReadRecipientPicker({ value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setSuggestions([]);
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleQueryChange(q: string) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, {
          signal: abortRef.current.signal,
        });
        const data = await res.json() as { users?: UserSuggestion[] };
        const results = data.users ?? [];
        setSuggestions(results);
        setOpen(results.length > 0);
      } catch {
        // AbortError from rapid typing — ignore
      }
    }, 250);
  }

  function addEmail(email: string) {
    if (!value.includes(email)) onChange([...value, email]);
    setQuery("");
    setSuggestions([]);
    setOpen(false);
  }

  function removeEmail(email: string) {
    onChange(value.filter(e => e !== email));
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      {/* chips */}
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {value.map((email, i) => (
            <span
              key={email}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 8px", borderRadius: 12,
                background: "var(--surface-2)", color: "var(--ink-2)", fontSize: 13,
              }}
            >
              <span>{i + 1}. {email}</span>
              <button
                type="button"
                onClick={() => removeEmail(email)}
                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--ink-muted)", fontSize: 14, lineHeight: 1, padding: "0 2px" }}
                aria-label={`ลบ ${email}`}
              >×</button>
            </span>
          ))}
        </div>
      )}
      {/* input */}
      <input
        className="em-input"
        type="text"
        value={query}
        onChange={e => handleQueryChange(e.target.value)}
        placeholder="พิมพ์ชื่อหรือ email เพื่อค้นหา…"
        autoComplete="off"
        style={{ width: "100%" }}
      />
      {/* dropdown */}
      {open && suggestions.length > 0 && (
        <ul style={{
          position: "absolute", zIndex: 999, top: "100%", left: 0, right: 0,
          margin: "2px 0 0", padding: 0, listStyle: "none",
          background: "var(--surface-raised)", border: "1px solid var(--border)",
          borderRadius: "var(--r-md)", boxShadow: "0 4px 16px rgba(0,0,0,.12)",
          maxHeight: 260, overflowY: "auto",
        }}>
          {suggestions.map(u => (
            <li
              key={u.email}
              onMouseDown={() => addEmail(u.email)}
              style={{ padding: "9px 12px", cursor: "pointer", borderBottom: "1px solid var(--line)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ fontWeight: 500, fontSize: 13, color: "var(--ink)" }}>
                {u.firstName} {u.lastName}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                {u.email} · {u.department}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="em-help" style={{ marginTop: 4 }}>
        พิมพ์อย่างน้อย 2 ตัวอักษร · MD จะไม่ปรากฏในรายการ
      </div>
    </div>
  );
}
