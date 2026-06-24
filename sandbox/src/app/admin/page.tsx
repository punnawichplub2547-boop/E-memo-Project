"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { useAdminUsers } from "@/lib/admin-users";
import { useMemos } from "@/lib/memo-store";
import { usePrototypeUser } from "@/lib/prototype-user-context";
import { isPrototypeAdmin } from "@/lib/prototype-users";
import { useAuth } from "@/lib/auth-context";
import type { PublicUser } from "@/lib/db-users";
import type { PrototypeRole, PrototypeUser } from "@/lib/prototype-users";
import type { ApprovalLevel, MemoStatus } from "@/lib/approval";
import { formatTimestamp } from "@/lib/format-timestamp";
import { DEPARTMENTS } from "@/lib/departments";
import { FilterDropdown } from "@/components/filter-dropdown";
import type { WorkflowAction } from "@/lib/db-memos";
import type { IssueReport, IssueStatus } from "@/lib/issue-reports";
import {
  IconUsers, IconFileText, IconShield, IconTrash,
  IconPen, IconRefresh, IconX, IconCheck, IconKey, IconSettings, IconUserPlus, IconReturn,
  IconHistory, IconFilter, IconArrowLeft, IconArrowRight, IconBell,
} from "@/components/icons";

const ALL_ROLES: { value: PrototypeRole; label: string }[] = [
  { value: "requester", label: "Requester" },
  { value: "manager", label: "Manager / Top Section" },
  { value: "general-manager", label: "General Manager" },
  { value: "senior-general-manager", label: "Sr. General Manager" },
  { value: "managing-director", label: "Managing Director" },
  { value: "read-recipient", label: "Read Recipient" },
  { value: "admin", label: "Admin" },
];

const APPROVAL_LEVELS: ApprovalLevel[] = [
  "Manager / Top Section",
  "General Manager",
  "Managing Director",
];

const STATUS_OPTIONS: MemoStatus[] = ["pending", "approved", "rejected", "returned", "draft"];

const statusColor: Record<MemoStatus, string> = {
  pending: "#3B82F6",
  approved: "#22C55E",
  rejected: "#EF4444",
  returned: "#F59E0B",
  draft: "#6B7280",
};

type Tab = "db-users" | "users" | "memos" | "audit" | "issues" | "system";

const AUDIT_ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All actions" },
  { value: "submit", label: "Submit" },
  { value: "save_draft", label: "Save draft" },
  { value: "check", label: "Check" },
  { value: "approve", label: "Approve" },
  { value: "return_for_revision", label: "Return" },
  { value: "reject", label: "Reject" },
  { value: "read", label: "Read" },
  { value: "skip_read", label: "Skip read" },
  { value: "resubmit", label: "Resubmit" },
  { value: "void", label: "Void" },
  { value: "restore", label: "Restore" },
];

const AUDIT_PAGE_SIZE = 50;
const ISSUES_PAGE_SIZE = 50;

type EditUserState = {
  name: string;
  department: string;
  roleLabel: string;
  roles: PrototypeRole[];
  approvalLevel: ApprovalLevel | "";
  readRecipientLabels: string;
};

type NewUserState = EditUserState & { id: string };

const emptyNewUser = (): NewUserState => ({
  id: "", name: "", department: "HR&GA", roleLabel: "Requester",
  roles: ["requester"], approvalLevel: "", readRecipientLabels: "",
});

export default function AdminPage() {
  const { user } = usePrototypeUser();
  const { user: authUser } = useAuth();
  const { users, addUser, updateUser, deleteUser, resetToDefaults } = useAdminUsers();
  const { allMemos, dispatch } = useMemos();
  const adminCount = users.filter(isPrototypeAdmin).length;
  const [tab, setTab] = useState<Tab>("db-users");
  const stampNow = () => formatTimestamp(new Date());

  // DB users tab state
  const [dbUsers, setDbUsers] = useState<PublicUser[]>([]);
  const [dbUsersLoading, setDbUsersLoading] = useState(false);
  const [dbUsersError, setDbUsersError] = useState("");
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [approveRoles, setApproveRoles] = useState<string[]>(["requester"]);
  const [approveLevel, setApproveLevel] = useState<string>("");

  // Prototype users tab state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditUserState | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState<NewUserState>(emptyNewUser);

  // Change role (DB users tab) state
  const [changeRoleId, setChangeRoleId] = useState<number | null>(null);
  const [changeRoleRoles, setChangeRoleRoles] = useState<string[]>([]);
  const [changeRoleLevel, setChangeRoleLevel] = useState<string>("");

  // Memos tab state
  const [confirmDeleteMemoId, setConfirmDeleteMemoId] = useState<string | null>(null);
  const [confirmDestroyMemoId, setConfirmDestroyMemoId] = useState<string | null>(null);
  const [forceStatusId, setForceStatusId] = useState<string | null>(null);
  const [forceStatus, setForceStatus] = useState<MemoStatus>("pending");

  // System tab state
  const [dbStatus, setDbStatus] = useState<"checking" | "ok" | "error">("checking");
  const [aiStatus, setAiStatus] = useState<{ thaillm: boolean; groq: boolean } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Audit log tab state
  const [auditRows, setAuditRows] = useState<WorkflowAction[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [auditMemo, setAuditMemo] = useState("");
  const [auditActor, setAuditActor] = useState("");
  const [auditAction, setAuditAction] = useState("");
  const [auditFrom, setAuditFrom] = useState("");
  const [auditTo, setAuditTo] = useState("");
  const [auditPage, setAuditPage] = useState(0);
  // Committed filter values — only updated when the user hits "Apply", so typing
  // in the text boxes does not fire a request per keystroke.
  const [auditQuery, setAuditQuery] = useState({ memo: "", actor: "", action: "", from: "", to: "" });

  // Issue-reports tab state
  const [issueRows, setIssueRows] = useState<IssueReport[]>([]);
  const [issueTotal, setIssueTotal] = useState(0);
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueError, setIssueError] = useState("");
  const [issueStatusFilter, setIssueStatusFilter] = useState<"" | IssueStatus>("");
  const [issuePage, setIssuePage] = useState(0);
  // Bumped to force a refetch (e.g. after toggling a report's status).
  const [issueRefresh, setIssueRefresh] = useState(0);

  useEffect(() => {
    if (tab !== "issues") return;
    const controller = new AbortController();
    // Defer the loading-state reset off the synchronous effect path (mirrors the
    // audit effect) to avoid cascading renders / the set-state-in-effect lint.
    const raf = requestAnimationFrame(() => {
      if (controller.signal.aborted) return;
      setIssueLoading(true);
      setIssueError("");
    });
    const params = new URLSearchParams();
    if (issueStatusFilter) params.set("status", issueStatusFilter);
    params.set("limit", String(ISSUES_PAGE_SIZE));
    params.set("offset", String(issuePage * ISSUES_PAGE_SIZE));
    fetch(`/api/admin/issues?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: { rows: IssueReport[]; total: number }) => {
        setIssueRows(data.rows);
        setIssueTotal(data.total);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setIssueError("โหลดรายการแจ้งปัญหาไม่สำเร็จ ตรวจสอบการเชื่อมต่อ DB");
        setIssueRows([]);
        setIssueTotal(0);
      })
      .finally(() => { if (!controller.signal.aborted) setIssueLoading(false); });
    return () => { controller.abort(); cancelAnimationFrame(raf); };
  }, [tab, issueStatusFilter, issuePage, issueRefresh]);

  async function toggleIssueStatus(id: number, next: IssueStatus) {
    try {
      const res = await fetch(`/api/admin/issues/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("request failed");
      setIssueRefresh(n => n + 1);
    } catch {
      setIssueError("อัปเดตสถานะไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  useEffect(() => {
    if (tab !== "db-users") return;
    const timer = window.setTimeout(() => {
      setDbUsersLoading(true);
      setDbUsersError("");
      fetch("/api/admin/users")
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then((data: { users: PublicUser[] }) => setDbUsers(data.users))
        .catch(() => setDbUsersError("Failed to load users. Check DB connection."))
        .finally(() => setDbUsersLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [tab]);

  useEffect(() => {
    if (tab !== "system") return;
    const checkStatus = async () => {
      setDbStatus("checking");
      fetch("/api/memos", { cache: "no-store" })
        .then(r => setDbStatus(r.ok ? "ok" : "error"))
        .catch(() => setDbStatus("error"));
      fetch("/api/admin/status")
        .then(r => r.json())
        .then(d => setAiStatus(d as { thaillm: boolean; groq: boolean }))
        .catch(() => {});
    };
    void checkStatus();
  }, [tab]);

  useEffect(() => {
    if (tab !== "audit") return;
    const controller = new AbortController();
    // Defer the loading-state reset off the synchronous effect path (runs next frame,
    // well before any network response) to avoid cascading renders.
    const raf = requestAnimationFrame(() => {
      if (controller.signal.aborted) return;
      setAuditLoading(true);
      setAuditError("");
    });
    const params = new URLSearchParams();
    if (auditQuery.memo) params.set("memo", auditQuery.memo);
    if (auditQuery.actor) params.set("actor", auditQuery.actor);
    if (auditQuery.action) params.set("action", auditQuery.action);
    if (auditQuery.from) params.set("from", auditQuery.from);
    if (auditQuery.to) params.set("to", auditQuery.to);
    params.set("limit", String(AUDIT_PAGE_SIZE));
    params.set("offset", String(auditPage * AUDIT_PAGE_SIZE));
    fetch(`/api/admin/audit?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: { rows: WorkflowAction[]; total: number }) => {
        setAuditRows(data.rows);
        setAuditTotal(data.total);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setAuditError("Failed to load audit log. Check DB connection.");
        setAuditRows([]);
        setAuditTotal(0);
      })
      .finally(() => { if (!controller.signal.aborted) setAuditLoading(false); });
    return () => { controller.abort(); cancelAnimationFrame(raf); };
  }, [tab, auditQuery, auditPage]);

  function applyAuditFilters() {
    setAuditPage(0);
    setAuditQuery({ memo: auditMemo.trim(), actor: auditActor.trim(), action: auditAction, from: auditFrom, to: auditTo });
  }

  function clearAuditFilters() {
    setAuditMemo(""); setAuditActor(""); setAuditAction(""); setAuditFrom(""); setAuditTo("");
    setAuditPage(0);
    setAuditQuery({ memo: "", actor: "", action: "", from: "", to: "" });
  }

  const isAdminAccess = authUser ? authUser.roles.includes("admin") : isPrototypeAdmin(user);

  if (!isAdminAccess) {
    return (
      <div className="em-art">
        <Sidebar />
        <div className="em-work">
          <Topbar crumbs={["Admin"]} title="Admin Panel" />
          <div className="em-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
            <div className="em-card" style={{ textAlign: "center", padding: "40px 48px" }}>
              <IconShield size={36} style={{ color: "var(--muted)", marginBottom: 12 }} />
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Access Denied</div>
              <div style={{ color: "var(--muted)", fontSize: 13 }}>Only admin users can access this page.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── User editing helpers ──────────────────────────────────────────────────

  function startEdit(u: PrototypeUser) {
    setEditingId(u.id);
    setEditState({
      name: u.name,
      department: u.department,
      roleLabel: u.roleLabel,
      roles: [...u.roles],
      approvalLevel: u.approvalLevel ?? "",
      readRecipientLabels: (u.readRecipientLabels ?? []).join(", "),
    });
  }

  function cancelEdit() { setEditingId(null); setEditState(null); }

  function saveEdit(id: string) {
    if (!editState) return;
    updateUser(id, {
      name: editState.name.trim(),
      department: editState.department,
      roleLabel: editState.roleLabel.trim(),
      roles: editState.roles,
      approvalLevel: editState.approvalLevel || undefined,
      readRecipientLabels: editState.readRecipientLabels
        ? editState.readRecipientLabels.split(",").map(s => s.trim()).filter(Boolean)
        : undefined,
    });
    setEditingId(null);
    setEditState(null);
  }

  function toggleRole(role: PrototypeRole, state: EditUserState, setter: (s: EditUserState) => void) {
    const has = state.roles.includes(role);
    setter({ ...state, roles: has ? state.roles.filter(r => r !== role) : [...state.roles, role] });
  }

  function submitNewUser() {
    if (!newUser.name.trim() || !newUser.id.trim()) return;
    const id = newUser.id.trim().toLowerCase().replace(/\s+/g, "-");
    if (users.find(u => u.id === id)) return;
    addUser({
      id,
      name: newUser.name.trim(),
      department: newUser.department,
      roleLabel: newUser.roleLabel.trim() || "Requester",
      roles: newUser.roles.length ? newUser.roles : ["requester"],
      approvalLevel: newUser.approvalLevel || undefined,
      readRecipientLabels: newUser.readRecipientLabels
        ? newUser.readRecipientLabels.split(",").map(s => s.trim()).filter(Boolean)
        : undefined,
    });
    setNewUser(emptyNewUser());
    setShowAddUser(false);
  }

  // ── Shared field styles ───────────────────────────────────────────────────
  const fieldStyle: React.CSSProperties = { fontSize: 12.5, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", outline: "none", width: "100%" };

  return (
    <div className="em-art">
      <Sidebar />
      <div className="em-work">
        <Topbar crumbs={["Admin"]} title="Admin Panel" showSearch={false} />
        <div className="em-content">

          {/* Tabs */}
          <div className="em-admin-tabs" style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
            {([ ["db-users", IconUsers, "Registered Users"], ["users", IconUsers, "Prototype Users"], ["memos", IconFileText, "Memos"], ["audit", IconHistory, "Audit Log"], ["issues", IconBell, "แจ้งปัญหา"], ["system", IconSettings, "System"] ] as const).map(([t, Icon, label]) => (
              <button key={t} role="tab" aria-selected={tab === t}
                onClick={() => setTab(t as Tab)}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", border: "none", background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: tab === t ? "var(--accent)" : "var(--muted)", borderBottom: `2px solid ${tab === t ? "var(--accent)" : "transparent"}`, marginBottom: -1, transition: "color 150ms" }}
              >
                <Icon size={15} />{label}
              </button>
            ))}
          </div>

          {/* ── REGISTERED USERS TAB ──────────────────────────────── */}
          {tab === "db-users" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Registered Users</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    Approve pending accounts and manage roles. Data is persisted to MySQL.
                  </div>
                </div>
                <button className="em-btn" onClick={() => { setDbUsersLoading(true); fetch("/api/admin/users").then(r => r.json()).then((d: { users: PublicUser[] }) => setDbUsers(d.users)).catch(() => {}).finally(() => setDbUsersLoading(false)); }}>
                  <IconRefresh size={14} /> Refresh
                </button>
              </div>

              {dbUsersLoading && <div style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</div>}
              {dbUsersError && <div style={{ color: "#f87171", fontSize: 13 }}>{dbUsersError}</div>}

              {/* Pending approvals */}
              {dbUsers.filter(u => u.status === "pending").length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                    Pending Approval ({dbUsers.filter(u => u.status === "pending").length})
                  </div>
                  <div className="em-card em-admin-table-card" style={{ padding: 0, overflow: "hidden" }}>
                    <table className="em-admin-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.03)" }}>
                          {["Employee ID", "Name", "Email", "Department", "Registered", "Actions"].map(h => (
                            <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 11.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dbUsers.filter(u => u.status === "pending").map(u => (
                          <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 12 }}>{u.employee_card_id}</td>
                            <td style={{ padding: "10px 14px", fontWeight: 600 }}>{u.first_name} {u.last_name}</td>
                            <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--muted)" }}>{u.email}</td>
                            <td style={{ padding: "10px 14px" }}>{u.department || "—"}</td>
                            <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--muted)" }}>{u.created_at?.slice(0, 10)}</td>
                            <td style={{ padding: "10px 14px" }}>
                              {approvingId === u.id ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 260 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Assign roles:</div>
                                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                    {(["requester","manager","general-manager","managing-director","read-recipient","admin"] as const).map(r => (
                                      <label key={r} style={{ fontSize: 11.5, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                                        <input type="checkbox" checked={approveRoles.includes(r)}
                                          onChange={e => setApproveRoles(prev => e.target.checked ? [...prev, r] : prev.filter(x => x !== r))} />
                                        {r}
                                      </label>
                                    ))}
                                  </div>
                                  {(approveRoles.includes("manager") || approveRoles.includes("general-manager") || approveRoles.includes("managing-director")) && (
                                    <select value={approveLevel} onChange={e => setApproveLevel(e.target.value)}
                                      style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", outline: "none" }}>
                                      <option value="">— Approval Level —</option>
                                      {APPROVAL_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                  )}
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button className="em-btn primary" style={{ fontSize: 12 }} onClick={async () => {
                                      await fetch(`/api/admin/users/${u.id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roles: approveRoles, approvalLevel: approveLevel || null }) });
                                      setApprovingId(null);
                                      setApproveRoles(["requester"]);
                                      setApproveLevel("");
                                      const fresh = await fetch("/api/admin/users").then(r => r.json()) as { users: PublicUser[] };
                                      setDbUsers(fresh.users);
                                    }}><IconCheck size={12} /> Approve</button>
                                    <button className="em-btn" style={{ fontSize: 12 }} onClick={() => { setApprovingId(null); setApproveRoles(["requester"]); setApproveLevel(""); }}>Cancel</button>
                                    <button className="em-btn" style={{ fontSize: 12, color: "#ef4444" }} onClick={async () => {
                                      if (!confirm(`Reject ${u.first_name} ${u.last_name}? This will delete their pending account.`)) return;
                                      await fetch(`/api/admin/users/${u.id}/reject`, { method: "POST" });
                                      const fresh = await fetch("/api/admin/users").then(r => r.json()) as { users: PublicUser[] };
                                      setDbUsers(fresh.users);
                                    }}>Reject</button>
                                  </div>
                                </div>
                              ) : (
                                <button className="em-btn primary" style={{ fontSize: 12 }} onClick={() => { setApprovingId(u.id); setApproveRoles(["requester"]); setApproveLevel(""); }}>
                                  <IconCheck size={12} /> Approve…
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Active / suspended users */}
              {dbUsers.filter(u => u.status !== "pending").length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                    Active Users ({dbUsers.filter(u => u.status === "active").length})
                  </div>
                  <div className="em-card em-admin-table-card" style={{ padding: 0, overflow: "hidden" }}>
                    <table className="em-admin-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.03)" }}>
                          {["Employee ID", "Name", "Email", "Dept", "Roles", "Status", "Actions"].map(h => (
                            <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 11.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dbUsers.filter(u => u.status !== "pending").map(u => {
                          let roles: string[] = [];
                          try { roles = JSON.parse(u.roles_json) as string[]; } catch {}
                          return (
                            <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                              <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 12 }}>{u.employee_card_id}</td>
                              <td style={{ padding: "10px 14px", fontWeight: 600 }}>{u.first_name} {u.last_name}</td>
                              <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--muted)" }}>{u.email}</td>
                              <td style={{ padding: "10px 14px" }}>{u.department || "—"}</td>
                              <td style={{ padding: "10px 14px" }}>
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                  {roles.map(r => (
                                    <span key={r} style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 12, background: r === "admin" ? "rgba(234,179,8,0.15)" : "rgba(59,130,246,0.12)", color: r === "admin" ? "#A16207" : "var(--accent)", border: `1px solid ${r === "admin" ? "rgba(234,179,8,0.3)" : "rgba(59,130,246,0.2)"}`, fontWeight: 600 }}>{r}</span>
                                  ))}
                                </div>
                              </td>
                              <td style={{ padding: "10px 14px" }}>
                                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 600, background: u.status === "active" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: u.status === "active" ? "#22c55e" : "#ef4444", border: `1px solid ${u.status === "active" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}` }}>
                                  {u.status}
                                </span>
                              </td>
                              <td style={{ padding: "10px 14px" }}>
                                {changeRoleId === u.id ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 300 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Assign roles:</div>
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                      {(["requester","manager","general-manager","senior-general-manager","managing-director","read-recipient","admin"] as const).map(r => (
                                        <label key={r} style={{ fontSize: 11.5, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                                          <input type="checkbox" checked={changeRoleRoles.includes(r)}
                                            onChange={e => setChangeRoleRoles(prev => e.target.checked ? [...prev, r] : prev.filter(x => x !== r))} />
                                          {r}
                                        </label>
                                      ))}
                                    </div>
                                    {(changeRoleRoles.includes("manager") || changeRoleRoles.includes("general-manager") || changeRoleRoles.includes("senior-general-manager") || changeRoleRoles.includes("managing-director")) && (
                                      <select value={changeRoleLevel} onChange={e => setChangeRoleLevel(e.target.value)}
                                        style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", outline: "none" }}>
                                        <option value="">— Approval Level —</option>
                                        {APPROVAL_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                                      </select>
                                    )}
                                    <div style={{ display: "flex", gap: 6 }}>
                                      <button className="em-btn primary" style={{ fontSize: 12 }} onClick={async () => {
                                        if (changeRoleRoles.length === 0) return;
                                        await fetch(`/api/admin/users/${u.id}/roles`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roles: changeRoleRoles, approvalLevel: changeRoleLevel || null }) });
                                        setChangeRoleId(null);
                                        const fresh = await fetch("/api/admin/users").then(r => r.json()) as { users: PublicUser[] };
                                        setDbUsers(fresh.users);
                                      }}><IconCheck size={12} /> Save</button>
                                      <button className="em-btn" style={{ fontSize: 12 }} onClick={() => setChangeRoleId(null)}>Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                    <button className="em-btn" style={{ fontSize: 12 }}
                                      disabled={authUser?.userId === u.id}
                                      title={authUser?.userId === u.id ? "Cannot change your own roles" : "Change roles"}
                                      onClick={() => { setChangeRoleId(u.id); setChangeRoleRoles(roles); setChangeRoleLevel(u.approval_level ?? ""); }}>
                                      <IconKey size={12} /> Change Role
                                    </button>
                                    <button className="em-btn" style={{ fontSize: 12, color: u.status === "active" ? "#ef4444" : "#22c55e" }}
                                      disabled={authUser?.userId === u.id}
                                      title={authUser?.userId === u.id ? "Cannot change your own account" : u.status === "active" ? "Suspend" : "Reactivate"}
                                      onClick={async () => {
                                        const nextStatus = u.status === "active" ? "suspended" : "active";
                                        await fetch(`/api/admin/users/${u.id}/roles`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
                                        const fresh = await fetch("/api/admin/users").then(r => r.json()) as { users: PublicUser[] };
                                        setDbUsers(fresh.users);
                                      }}>
                                      {u.status === "active" ? "Suspend" : "Reactivate"}
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!dbUsersLoading && !dbUsersError && dbUsers.length === 0 && (
                <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>
                  No registered users yet. Run the migration SQL to create the users table.
                </div>
              )}
            </div>
          )}

          {/* ── PROTOTYPE USERS TAB ────────────────────────────────── */}
          {tab === "users" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Prototype Users</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Changes persist in localStorage and take effect immediately.</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="em-btn" onClick={() => { resetToDefaults(); }}><IconRefresh size={14} /> Reset Defaults</button>
                  <button className="em-btn primary" onClick={() => setShowAddUser(v => !v)}><IconUserPlus size={14} /> Add User</button>
                </div>
              </div>

              {/* Add user form */}
              {showAddUser && (
                <div className="em-card" style={{ padding: 20 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
                    New Prototype User
                    <button className="em-btn" onClick={() => setShowAddUser(false)}><IconX size={13} /></button>
                  </div>
                  <UserForm state={newUser} onChange={setNewUser as (s: EditUserState) => void} fieldStyle={fieldStyle} toggleRole={(r) => toggleRole(r, newUser, setNewUser as (s: EditUserState) => void)} showId />
                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <button className="em-btn primary" onClick={submitNewUser}><IconCheck size={13} /> Create User</button>
                    <button className="em-btn" onClick={() => { setShowAddUser(false); setNewUser(emptyNewUser()); }}>Cancel</button>
                  </div>
                </div>
              )}

              <div className="em-card em-admin-table-card" style={{ padding: 0, overflow: "hidden" }}>
                <table className="em-admin-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.03)" }}>
                      {["Name", "Department", "Role Label", "Approval Level", "Roles", "Actions"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 11.5, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      editingId === u.id && editState ? (
                        <tr key={u.id} style={{ borderBottom: "1px solid var(--border)", background: "rgba(59,130,246,0.04)" }}>
                          <td colSpan={6} style={{ padding: "14px 14px" }}>
                            <UserForm state={editState} onChange={setEditState} fieldStyle={fieldStyle} toggleRole={(r) => toggleRole(r, editState, setEditState)} />
                            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                              <button className="em-btn primary" onClick={() => saveEdit(u.id)}><IconCheck size={13} /> Save</button>
                              <button className="em-btn" onClick={cancelEdit}>Cancel</button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                            {u.name}
                            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>id: {u.id}</div>
                          </td>
                          <td style={{ padding: "10px 14px" }}>{u.department}</td>
                          <td style={{ padding: "10px 14px" }}>{u.roleLabel}</td>
                          <td style={{ padding: "10px 14px", color: u.approvalLevel ? "var(--ink)" : "var(--muted)", fontSize: 12 }}>{u.approvalLevel ?? "—"}</td>
                          <td style={{ padding: "10px 14px" }}>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {u.roles.map(r => (
                                <span key={r} style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 12, background: r === "admin" ? "rgba(234,179,8,0.15)" : "rgba(59,130,246,0.12)", color: r === "admin" ? "#A16207" : "var(--accent)", border: `1px solid ${r === "admin" ? "rgba(234,179,8,0.3)" : "rgba(59,130,246,0.2)"}`, fontWeight: 600 }}>{r}</span>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button className="em-btn" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => startEdit(u)}><IconPen size={12} /> Edit</button>
                              <button className="em-btn" style={{ padding: "4px 10px", fontSize: 12, color: "#EF4444" }}
                                disabled={u.id === user.id || (isPrototypeAdmin(u) && adminCount <= 1)}
                                title={
                                  u.id === user.id
                                    ? "Cannot delete yourself"
                                    : isPrototypeAdmin(u) && adminCount <= 1
                                      ? "Cannot delete the last admin"
                                      : "Delete user"
                                }
                                onClick={() => { if (u.id !== user.id) deleteUser(u.id); }}
                              ><IconTrash size={12} /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ fontSize: 12, color: "var(--muted)", padding: "8px 0" }}>
                <IconKey size={12} style={{ verticalAlign: "middle", marginRight: 5 }} />
                <strong>Prototype-only users</strong> - these localStorage profiles remain for workflow simulation. Real login users are managed in the Registered Users tab.
              </div>
            </div>
          )}

          {/* ── MEMOS TAB ──────────────────────────────────────────── */}
          {/* Delete is a SOFT-delete (void): it persists memos.deleted_at to MySQL + a "void"
              audit row, hides the memo from all active views, and is reversible via Restore.
              Force status still uses the legacy UPDATE_STATUS action, which is in-memory only and
              intentionally bypasses the workflow_step_actions audit trail (see admin notice below). */}
          {tab === "memos" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>All Memos</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  {allMemos.length} records ({allMemos.filter(m => m.deletedAt).length} voided) — Void is reversible soft-delete. Delete forever removes the memo from MySQL. <span style={{ color: "var(--amber)" }}>Force status is in-memory only.</span>
                </div>
              </div>
              <div className="em-card" style={{ padding: 0, overflowX: "auto", overflowY: "hidden" }}>
                <table style={{ width: "100%", minWidth: 1280, borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.03)" }}>
                      {["ID", "Title", "Status", "Dept", "Amount", "Step", "Date", "Actions"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 11.5, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap", ...(h === "Actions" ? { position: "sticky" as const, right: 0, zIndex: 2, minWidth: 270, background: "var(--surface)" } : {}) }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allMemos.map(m => {
                      const isVoided = !!m.deletedAt;
                      return (
                      <tr key={m.id} style={{ borderBottom: "1px solid var(--border)", opacity: isVoided ? 0.55 : 1, background: isVoided ? "rgba(239,68,68,0.04)" : "transparent" }}>
                        <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11.5, color: "var(--muted)", whiteSpace: "nowrap" }}>{m.id}</td>
                        <td style={{ padding: "10px 14px", maxWidth: 240 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: isVoided ? "line-through" : "none" }}>{m.title}</span>
                            {isVoided && <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10, background: "rgba(239,68,68,0.14)", color: "#B91C1C", border: "1px solid rgba(239,68,68,0.3)" }}>VOIDED</span>}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{m.requester}</div>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {forceStatusId === m.id && !isVoided ? (
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <select value={forceStatus} onChange={e => setForceStatus(e.target.value as MemoStatus)} style={{ ...fieldStyle, width: "auto", fontSize: 12 }}>
                                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <button className="em-btn primary" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => { dispatch({ type: "UPDATE_STATUS", id: m.id, status: forceStatus }); setForceStatusId(null); }}><IconCheck size={11} /></button>
                              <button className="em-btn" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setForceStatusId(null)}><IconX size={11} /></button>
                            </div>
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, padding: "2px 9px", borderRadius: 12, background: `${statusColor[m.status]}20`, color: statusColor[m.status], border: `1px solid ${statusColor[m.status]}40` }}>
                              {m.status}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 12 }}>{m.department}</td>
                        <td style={{ padding: "10px 14px", fontSize: 12, whiteSpace: "nowrap" }}>฿{m.amount.toLocaleString()}</td>
                        <td style={{ padding: "10px 14px", fontSize: 11.5, color: "var(--muted)", whiteSpace: "nowrap" }}>{m.currentStep}</td>
                        <td style={{ padding: "10px 14px", fontSize: 11.5, color: "var(--muted)", whiteSpace: "nowrap" }}>{isVoided ? `voided ${m.deletedAt}` : m.createdAt}</td>
                        <td style={{ padding: "10px 14px", position: "sticky", right: 0, minWidth: 270, background: isVoided ? "rgba(254,242,242,0.98)" : "var(--surface)", boxShadow: "-10px 0 18px -18px rgba(15,23,42,0.35)" }}>
                          {isVoided ? (
                            confirmDestroyMemoId === m.id ? (
                              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <span style={{ fontSize: 11.5, color: "#B91C1C", fontWeight: 700 }}>Delete forever?</span>
                                <button className="em-btn" style={{ padding: "6px 10px", fontSize: 11.5, color: "#EF4444" }} onClick={() => { dispatch({ type: "DESTROY_MEMO", id: m.id }); setConfirmDestroyMemoId(null); }}><IconCheck size={12} /> Confirm</button>
                                <button className="em-btn" style={{ padding: "6px 10px", fontSize: 11.5 }} onClick={() => setConfirmDestroyMemoId(null)}><IconX size={12} /> Cancel</button>
                              </div>
                            ) : (
                              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <button className="em-btn" style={{ padding: "6px 10px", fontSize: 12, color: "#047857" }} title="Restore memo" onClick={() => dispatch({ type: "RESTORE_MEMO", id: m.id, updatedAt: stampNow() })}><IconReturn size={12} /> Restore</button>
                                <button className="em-btn" style={{ padding: "6px 10px", fontSize: 12, color: "#B91C1C" }} title="Delete permanently from database" onClick={() => { setConfirmDestroyMemoId(m.id); setConfirmDeleteMemoId(null); setForceStatusId(null); }}><IconTrash size={12} /> Delete forever</button>
                              </div>
                            )
                          ) : confirmDeleteMemoId === m.id ? (
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <span style={{ fontSize: 11.5, color: "#EF4444" }}>Void?</span>
                              <button className="em-btn" style={{ padding: "6px 10px", fontSize: 11.5, color: "#EF4444" }} onClick={() => { dispatch({ type: "DELETE_MEMO", id: m.id, deletedAt: stampNow() }); setConfirmDeleteMemoId(null); }}><IconCheck size={12} /> Confirm</button>
                              <button className="em-btn" style={{ padding: "6px 10px", fontSize: 11.5 }} onClick={() => setConfirmDeleteMemoId(null)}><IconX size={12} /> Cancel</button>
                            </div>
                          ) : confirmDestroyMemoId === m.id ? (
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <span style={{ fontSize: 11.5, color: "#B91C1C", fontWeight: 700 }}>Delete forever?</span>
                              <button className="em-btn" style={{ padding: "6px 10px", fontSize: 11.5, color: "#EF4444" }} onClick={() => { dispatch({ type: "DESTROY_MEMO", id: m.id }); setConfirmDestroyMemoId(null); }}><IconCheck size={12} /> Confirm</button>
                              <button className="em-btn" style={{ padding: "6px 10px", fontSize: 11.5 }} onClick={() => setConfirmDestroyMemoId(null)}><IconX size={12} /> Cancel</button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <button className="em-btn" style={{ padding: "6px 10px", fontSize: 12 }} title="Force status" onClick={() => { setForceStatusId(m.id); setForceStatus(m.status); setConfirmDeleteMemoId(null); setConfirmDestroyMemoId(null); }}><IconSettings size={12} /> Force</button>
                              <button className="em-btn" style={{ padding: "6px 10px", fontSize: 12, color: "#D97706" }} title="Void memo (reversible)" onClick={() => { setConfirmDeleteMemoId(m.id); setConfirmDestroyMemoId(null); setForceStatusId(null); }}><IconTrash size={12} /> Void</button>
                              <button className="em-btn" style={{ padding: "6px 10px", fontSize: 12, color: "#B91C1C" }} title="Delete permanently from database" onClick={() => { setConfirmDestroyMemoId(m.id); setConfirmDeleteMemoId(null); setForceStatusId(null); }}><IconTrash size={12} /> Delete forever</button>
                            </div>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                    {allMemos.length === 0 && (
                      <tr><td colSpan={8} style={{ padding: "32px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No memos.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── AUDIT LOG TAB ──────────────────────────────────────── */}
          {tab === "audit" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Audit Log / ประวัติการดำเนินการ</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  Every workflow action across all memos — including voided memos. Read-only. {auditTotal} total record{auditTotal === 1 ? "" : "s"}.
                </div>
              </div>

              {/* Filters */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 4 }}>Memo No.</label>
                  <input style={{ ...fieldStyle, width: 150 }} placeholder="EM-2026-…" value={auditMemo}
                    onChange={e => setAuditMemo(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") applyAuditFilters(); }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 4 }}>Actor</label>
                  <input style={{ ...fieldStyle, width: 150 }} placeholder="ชื่อผู้ดำเนินการ" value={auditActor}
                    onChange={e => setAuditActor(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") applyAuditFilters(); }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                  <FilterDropdown
                    icon={<IconFilter size={13} />}
                    label="Action"
                    options={AUDIT_ACTION_OPTIONS}
                    selected={auditAction}
                    onSelect={setAuditAction}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 4 }}>From</label>
                  <input type="date" style={{ ...fieldStyle, width: 150 }} value={auditFrom} onChange={e => setAuditFrom(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 4 }}>To</label>
                  <input type="date" style={{ ...fieldStyle, width: 150 }} value={auditTo} onChange={e => setAuditTo(e.target.value)} />
                </div>
                <button className="em-btn primary" style={{ padding: "6px 14px", fontSize: 12.5 }} onClick={applyAuditFilters}>Apply</button>
                <button className="em-btn" style={{ padding: "6px 14px", fontSize: 12.5 }} onClick={clearAuditFilters}>Clear</button>
              </div>

              {auditError && (
                <div className="em-card" style={{ padding: 14, fontSize: 13, color: "#B91C1C", background: "rgba(239,68,68,0.06)" }}>{auditError}</div>
              )}

              <div className="em-card" style={{ padding: 0, overflowX: "auto", overflowY: "hidden" }}>
                <table style={{ width: "100%", minWidth: 1000, borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.03)" }}>
                      {["Time", "Memo No.", "Action", "Step", "Actor", "Result", "Reason"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 11.5, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {auditRows.map((a, i) => (
                      <tr key={`${a.memoNo}-${a.actedAt}-${i}`} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "10px 14px", fontSize: 11.5, color: "var(--muted)", whiteSpace: "nowrap" }}>{a.actedAt}</td>
                        <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11.5, whiteSpace: "nowrap" }}>{a.memoNo}</td>
                        <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 4, background: "var(--surface-2, rgba(148,163,184,0.16))", color: "var(--ink-2, var(--ink))", letterSpacing: "0.02em" }}>{a.actionType}</span>
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{a.stepLabel ?? "—"}</td>
                        <td style={{ padding: "10px 14px", fontSize: 12, whiteSpace: "nowrap" }}>{a.actorName ?? "—"}</td>
                        <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{a.result ?? "—"}</td>
                        <td style={{ padding: "10px 14px", fontSize: 12, maxWidth: 320 }}>
                          <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.reason ?? undefined}>{a.reason ?? "—"}</span>
                        </td>
                      </tr>
                    ))}
                    {!auditLoading && auditRows.length === 0 && (
                      <tr><td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>{auditError ? "—" : "No audit records match the current filters."}</td></tr>
                    )}
                    {auditLoading && (
                      <tr><td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Loading…</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {auditTotal === 0
                    ? "0 records"
                    : `Showing ${auditPage * AUDIT_PAGE_SIZE + 1}–${Math.min((auditPage + 1) * AUDIT_PAGE_SIZE, auditTotal)} of ${auditTotal}`}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="em-btn" style={{ padding: "6px 12px", fontSize: 12.5 }}
                    disabled={auditPage === 0 || auditLoading}
                    onClick={() => setAuditPage(p => Math.max(0, p - 1))}>
                    <IconArrowLeft size={13} /> Prev
                  </button>
                  <button className="em-btn" style={{ padding: "6px 12px", fontSize: 12.5 }}
                    disabled={(auditPage + 1) * AUDIT_PAGE_SIZE >= auditTotal || auditLoading}
                    onClick={() => setAuditPage(p => p + 1)}>
                    Next <IconArrowRight size={13} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── ISSUE REPORTS TAB ──────────────────────────────────── */}
          {tab === "issues" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>แจ้งปัญหาจากผู้ใช้ / User Issue Reports</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  ปัญหาการใช้งานที่ผู้ใช้ส่งมาจากหน้าโปรไฟล์ — {issueTotal} รายการ
                </div>
              </div>

              {/* Status filter */}
              <div style={{ display: "flex", gap: 8 }}>
                {([ ["", "ทั้งหมด"], ["open", "ยังไม่จัดการ"], ["resolved", "จัดการแล้ว"] ] as const).map(([val, label]) => (
                  <button key={val || "all"} className={`em-btn${issueStatusFilter === val ? " primary" : ""}`}
                    style={{ padding: "6px 14px", fontSize: 12.5 }}
                    onClick={() => { setIssueStatusFilter(val); setIssuePage(0); }}>
                    {label}
                  </button>
                ))}
              </div>

              {issueError && (
                <div className="em-card" style={{ padding: 14, fontSize: 13, color: "#B91C1C", background: "rgba(239,68,68,0.06)" }}>{issueError}</div>
              )}

              <div className="em-card" style={{ padding: 0, overflowX: "auto", overflowY: "hidden" }}>
                <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.03)" }}>
                      {["เวลา", "ผู้แจ้ง", "แผนก", "รายละเอียด", "สถานะ", ""].map((h, i) => (
                        <th key={i} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 11.5, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {issueRows.map(r => (
                      <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "10px 14px", fontSize: 11.5, color: "var(--muted)", whiteSpace: "nowrap" }}>{r.createdAt}</td>
                        <td style={{ padding: "10px 14px", fontSize: 12, whiteSpace: "nowrap" }}>
                          <div style={{ fontWeight: 600 }}>{r.reporterName}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{r.reporterEmail}</div>
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{r.reporterDepartment}</td>
                        <td style={{ padding: "10px 14px", fontSize: 12, maxWidth: 380, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{r.description}</td>
                        <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
                            background: r.status === "resolved" ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.16)",
                            color: r.status === "resolved" ? "#16A34A" : "#D97706" }}>
                            {r.status === "resolved" ? "จัดการแล้ว" : "ยังไม่จัดการ"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                          {r.status === "open" ? (
                            <button className="em-btn" style={{ padding: "5px 10px", fontSize: 12, color: "#16A34A" }}
                              onClick={() => toggleIssueStatus(r.id, "resolved")}>
                              <IconCheck size={12} /> จัดการแล้ว
                            </button>
                          ) : (
                            <button className="em-btn" style={{ padding: "5px 10px", fontSize: 12 }}
                              onClick={() => toggleIssueStatus(r.id, "open")}>
                              <IconReturn size={12} /> เปิดใหม่
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!issueLoading && issueRows.length === 0 && (
                      <tr><td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>{issueError ? "—" : "ยังไม่มีรายการแจ้งปัญหา"}</td></tr>
                    )}
                    {issueLoading && (
                      <tr><td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>กำลังโหลด…</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {issueTotal === 0
                    ? "0 รายการ"
                    : `แสดง ${issuePage * ISSUES_PAGE_SIZE + 1}–${Math.min((issuePage + 1) * ISSUES_PAGE_SIZE, issueTotal)} จาก ${issueTotal}`}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="em-btn" style={{ padding: "6px 12px", fontSize: 12.5 }}
                    disabled={issuePage === 0 || issueLoading}
                    onClick={() => setIssuePage(p => Math.max(0, p - 1))}>
                    <IconArrowLeft size={13} /> ก่อนหน้า
                  </button>
                  <button className="em-btn" style={{ padding: "6px 12px", fontSize: 12.5 }}
                    disabled={(issuePage + 1) * ISSUES_PAGE_SIZE >= issueTotal || issueLoading}
                    onClick={() => setIssuePage(p => p + 1)}>
                    ถัดไป <IconArrowRight size={13} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── SYSTEM TAB ─────────────────────────────────────────── */}
          {tab === "system" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>System Status</div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                <StatusCard label="Database" value={dbStatus === "checking" ? "Checking…" : dbStatus === "ok" ? "Connected" : "Unavailable"} ok={dbStatus === "ok"} neutral={dbStatus === "checking"} note="In-memory seed fallback is active when DB is unavailable." />
                <StatusCard label="ThaiLLM (OpenThaiGPT)" value={aiStatus === null ? "Checking…" : aiStatus.thaillm ? "Configured" : "Key missing"} ok={!!aiStatus?.thaillm} neutral={aiStatus === null} note="Used for AI Draft and PDF extraction." />
                <StatusCard label="Groq (Llama 3.3 70B)" value={aiStatus === null ? "Checking…" : aiStatus.groq ? "Configured" : "Key missing"} ok={!!aiStatus?.groq} neutral={aiStatus === null} note="Used for AI Search ranking." />
              </div>

              <div className="em-card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Prototype State</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>Clears all localStorage keys used by this prototype (selected user, assistant panel state, admin user overrides).</div>
                {!confirmReset ? (
                  <button className="em-btn" style={{ color: "#EF4444" }} onClick={() => setConfirmReset(true)}><IconRefresh size={14} /> Clear localStorage &amp; Reload</button>
                ) : (
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#EF4444", fontWeight: 600 }}>This will reset all prototype state. Are you sure?</span>
                    <button className="em-btn" style={{ color: "#EF4444" }} onClick={() => {
                      const keys = ["hr-ememo-prototype-user", "em-admin-users", "em-create-assistant-open", "em-create-assistant-tab"];
                      keys.forEach(k => { try { localStorage.removeItem(k); } catch {} });
                      window.location.reload();
                    }}><IconCheck size={13} /> Yes, Reset</button>
                    <button className="em-btn" onClick={() => setConfirmReset(false)}><IconX size={13} /> Cancel</button>
                  </div>
                )}
              </div>

              <div className="em-card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Still Deferred</div>
                <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>
                  Login, hashed passwords, user approval, and role management are now active for the trial. Remaining production work: password reset, email notifications, full server-side permission coverage, and production-grade auth/session hardening.
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function UserForm({ state, onChange, fieldStyle, toggleRole, showId }: {
  state: EditUserState & { id?: string };
  onChange: (s: EditUserState & { id?: string }) => void;
  fieldStyle: React.CSSProperties;
  toggleRole: (r: PrototypeRole) => void;
  showId?: boolean;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
      {showId && (
        <div>
          <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 4 }}>User ID <span style={{ color: "#EF4444" }}>*</span></label>
          <input style={fieldStyle} placeholder="e.g. john-doe" value={(state as { id: string }).id ?? ""} onChange={e => onChange({ ...state, id: e.target.value })} />
        </div>
      )}
      <div>
        <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 4 }}>Name <span style={{ color: "#EF4444" }}>*</span></label>
        <input style={fieldStyle} placeholder="Full name" value={state.name} onChange={e => onChange({ ...state, name: e.target.value })} />
      </div>
      <div>
        <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 4 }}>Department</label>
        <select style={fieldStyle} value={state.department} onChange={e => onChange({ ...state, department: e.target.value })}>
          {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
        </select>
      </div>
      <div>
        <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 4 }}>Role Label</label>
        <input style={fieldStyle} placeholder="e.g. Requester" value={state.roleLabel} onChange={e => onChange({ ...state, roleLabel: e.target.value })} />
      </div>
      <div>
        <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 4 }}>Approval Level</label>
        <select style={fieldStyle} value={state.approvalLevel} onChange={e => onChange({ ...state, approvalLevel: e.target.value as ApprovalLevel | "" })}>
          <option value="">— none —</option>
          {APPROVAL_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
      <div style={{ gridColumn: showId ? "1 / -1" : undefined }}>
        <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 6 }}>Roles</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ALL_ROLES.map(({ value, label }) => (
            <label key={value} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={state.roles.includes(value)} onChange={() => toggleRole(value)} style={{ accentColor: "var(--accent)" }} />
              {label}
            </label>
          ))}
        </div>
      </div>
      {state.roles.includes("read-recipient") && (
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 4 }}>Read Recipient Labels <span style={{ fontWeight: 400 }}>(comma-separated)</span></label>
          <input style={fieldStyle} placeholder="e.g. HR&GA, ปุณณวิช ภูประเสิรฐ" value={state.readRecipientLabels} onChange={e => onChange({ ...state, readRecipientLabels: e.target.value })} />
        </div>
      )}
    </div>
  );
}

function StatusCard({ label, value, ok, neutral, note }: {
  label: string; value: string; ok: boolean; neutral: boolean; note: string;
}) {
  const color = neutral ? "var(--muted)" : ok ? "#22C55E" : "#EF4444";
  return (
    <div className="em-card" style={{ padding: 16 }}>
      <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>{note}</div>
    </div>
  );
}
