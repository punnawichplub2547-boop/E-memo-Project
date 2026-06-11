"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  IconGauge, IconPen, IconRoute, IconSearch,
  IconHistory, IconCrown, IconShield, IconBarChart,
} from "./icons";
import { useMemos } from "@/lib/memo-store";
import { usePrototypeUser } from "@/lib/prototype-user-context";
import { isPrototypeAdmin } from "@/lib/prototype-users";
import { useAuth } from "@/lib/auth-context";

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
  const router = useRouter();
  const { memos } = useMemos();
  const { user: protoUser } = usePrototypeUser();
  const { user: authUser, logout, loading: authLoading } = useAuth();
  const pendingCount = memos.filter(m => m.status === "pending").length;
  const mdPendingCount = memos.filter(m => m.status === "pending" && m.currentStep === "Managing Director").length;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href.split("?")[0]);
  };

  const isAdmin = authUser
    ? authUser.roles.includes("admin")
    : isPrototypeAdmin(protoUser);

  const canSeeExec = authUser
    ? authUser.roles.includes("admin") || authUser.roles.includes("managing-director")
    : protoUser.roles.includes("admin") || protoUser.roles.includes("managing-director");

  const canSeeReport = authUser
    ? authUser.roles.some(r => ["admin", "manager", "general-manager", "managing-director"].includes(r))
    : protoUser.roles.some(r => ["admin", "manager", "general-manager", "managing-director"].includes(r));

  // Display: prefer real auth user; fall back to prototype selector during transition.
  const displayName = authUser
    ? `${authUser.firstName} ${authUser.lastName}`
    : protoUser.name;
  const displayDept = authUser ? authUser.department : protoUser.department;
  const displayRole = authUser
    ? authUser.roles.includes("admin") ? "Admin"
      : authUser.roles.includes("managing-director") ? "Managing Director"
      : authUser.roles.includes("general-manager") ? "General Manager"
      : authUser.roles.includes("manager") ? "Manager / Top Section"
      : "Requester"
    : protoUser.roleLabel;
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((p: string) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

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

        {canSeeReport && (
          <Link
            href="/report"
            className={`em-nav-item${isActive("/report") ? " active" : ""}`}
          >
            <IconBarChart size={17} />
            <span>Monthly Report</span>
          </Link>
        )}

        {canSeeExec && (
          <>
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
          </>
        )}

        {isAdmin && (
          <>
            <div className="em-nav-group-label" style={{ marginTop: 14 }}>System</div>
            <Link href="/admin" className={`em-nav-item${isActive("/admin") ? " active" : ""}`}>
              <IconShield size={17} />
              <span>Admin Panel</span>
            </Link>
          </>
        )}
      </nav>

      <div className="em-side-footer">
        {authLoading ? (
          <>
            <div className="em-avatar" style={{ background: "var(--border)", color: "transparent" }}>?</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ height: 11, width: "70%", borderRadius: 4, background: "var(--border)", marginBottom: 5 }} />
              <div style={{ height: 9, width: "50%", borderRadius: 4, background: "var(--border)" }} />
            </div>
          </>
        ) : authUser ? (
          <>
            <Link
              href="/profile"
              style={{
                display: "flex", alignItems: "center", gap: 10,
                flex: 1, minWidth: 0, textDecoration: "none",
                padding: "6px 8px", borderRadius: 8, margin: "-6px -8px",
                transition: "background 150ms",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(37,99,235,0.07)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div className="em-avatar" style={{ flexShrink: 0 }}>{initials}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {displayName}
                </div>
                <div className="em-side-role">{displayDept} · {displayRole}</div>
              </div>
            </Link>
            <button
              onClick={async () => { await logout(); router.replace("/login"); }}
              title="ออกจากระบบ"
              style={{
                flexShrink: 0, background: "none", border: "1px solid var(--border)", cursor: "pointer",
                color: "var(--ink-muted,#94a3b8)", padding: "4px 10px", borderRadius: 6,
                fontSize: 11.5, fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap",
              }}
            >
              ออกจากระบบ
            </button>
          </>
        ) : null}
      </div>
    </aside>
  );
}
