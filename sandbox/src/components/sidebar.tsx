"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconGauge, IconPen, IconRoute, IconSearch,
  IconHistory, IconCrown, IconShield,
} from "./icons";
import { useMemos } from "@/lib/memo-store";
import { usePrototypeUser } from "@/lib/prototype-user-context";
import { getPrototypeUserInitials, PROTOTYPE_USERS } from "@/lib/prototype-users";

const mainItems = [
  { id: "dashboard", href: "/",        label: "Dashboard",       Icon: IconGauge },
  { id: "create",    href: "/create",   label: "Create Memo",     Icon: IconPen },
  { id: "queue",     href: "/queue",    label: "Approval Queue",  Icon: IconRoute },
  { id: "search",    href: "/search",   label: "AI Search",       Icon: IconSearch },
  { id: "history",   href: "/history",  label: "History",         Icon: IconHistory },
];

const execItems = [
  { id: "exec", href: "/queue?tier=md", label: "Executive Review", Icon: IconCrown, gold: true },
  { id: "audit", href: "/history",      label: "Audit Trail",      Icon: IconShield },
];

export function Sidebar() {
  const pathname = usePathname();
  const { memos } = useMemos();
  const { user, userId, setUserId } = usePrototypeUser();
  const pendingCount = memos.filter(m => m.status === "pending").length;
  const mdPendingCount = memos.filter(m => m.status === "pending" && m.currentStep === "Managing Director").length;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href.split("?")[0]);
  };

  return (
    <aside className="em-side">
      <div className="em-brand">
        <div className="em-brand-mark">EM</div>
        <div>
          <div className="em-brand-title">E-Memo</div>
          <div className="em-brand-sub">HR&amp;GA · Workflow</div>
        </div>
      </div>

      <nav className="em-nav">
        <div className="em-nav-group-label">Workflow</div>
        {mainItems.map(({ id, href, label, Icon }) => (
          <Link
            key={id}
            href={href}
            className={`em-nav-item${isActive(href) ? " active" : ""}`}
          >
            <Icon size={17} />
            <span>{label}</span>
            {id === "queue" && pendingCount > 0 && <span className="em-nav-badge">{pendingCount}</span>}
          </Link>
        ))}

        <div className="em-nav-group-label" style={{ marginTop: 14 }}>Executive</div>
        {execItems.map(({ id, href, label, Icon, gold }) => (
          <Link
            key={id}
            href={href}
            className={`em-nav-item${gold ? " gold" : ""}${isActive(href) && id !== "audit" ? " active" : ""}`}
          >
            <Icon size={17} />
            <span>{label}</span>
            {id === "exec" && mdPendingCount > 0 && <span className="em-nav-badge">{mdPendingCount}</span>}
          </Link>
        ))}
      </nav>

      <div className="em-side-footer">
        <div className="em-avatar">{getPrototypeUserInitials(user)}</div>
        <div style={{ minWidth: 0 }}>
          <select
            aria-label="Prototype user"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            style={{
              width: "100%",
              border: 0,
              outline: "none",
              background: "transparent",
              color: "var(--ink)",
              fontSize: 12.5,
              fontWeight: 700,
              padding: 0,
            }}
          >
            {PROTOTYPE_USERS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          <div className="em-side-role">{user.department} · {user.roleLabel}</div>
        </div>
      </div>
    </aside>
  );
}
