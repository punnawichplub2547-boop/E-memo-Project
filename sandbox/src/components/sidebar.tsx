"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconGauge, IconPen, IconRoute, IconSearch,
  IconHistory, IconCrown, IconShield,
} from "./icons";

const mainItems = [
  { id: "dashboard", href: "/",        label: "Dashboard",       Icon: IconGauge },
  { id: "create",    href: "/create",   label: "Create Memo",     Icon: IconPen },
  { id: "queue",     href: "/queue",    label: "Approval Queue",  Icon: IconRoute,   badge: "4" },
  { id: "search",    href: "/search",   label: "AI Search",       Icon: IconSearch },
  { id: "history",   href: "/history",  label: "History",         Icon: IconHistory },
];

const execItems = [
  { id: "exec", href: "/queue?tier=md", label: "Executive Review", Icon: IconCrown, badge: "1", gold: true },
  { id: "audit", href: "/history",      label: "Audit Trail",      Icon: IconShield },
];

export function Sidebar() {
  const pathname = usePathname();

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
        {mainItems.map(({ id, href, label, Icon, badge }) => (
          <Link
            key={id}
            href={href}
            className={`em-nav-item${isActive(href) ? " active" : ""}`}
          >
            <Icon size={17} />
            <span>{label}</span>
            {badge && <span className="em-nav-badge">{badge}</span>}
          </Link>
        ))}

        <div className="em-nav-group-label" style={{ marginTop: 14 }}>Executive</div>
        {execItems.map(({ id, href, label, Icon, badge, gold }) => (
          <Link
            key={id}
            href={href}
            className={`em-nav-item${gold ? " gold" : ""}${isActive(href) && id !== "audit" ? " active" : ""}`}
          >
            <Icon size={17} />
            <span>{label}</span>
            {badge && <span className="em-nav-badge">{badge}</span>}
          </Link>
        ))}
      </nav>

      <div className="em-side-footer">
        <div className="em-avatar">AH</div>
        <div style={{ minWidth: 0 }}>
          <div className="em-side-name">อำภา หิงคำ</div>
          <div className="em-side-role">HR&amp;GA · Manager</div>
        </div>
      </div>
    </aside>
  );
}
