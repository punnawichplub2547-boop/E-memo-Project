"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { useAdminUsers } from "@/lib/admin-users";
import { useMemos } from "@/lib/memo-store";
import { usePrototypeUser } from "@/lib/prototype-user-context";
import { isPrototypeAdmin } from "@/lib/prototype-users";
import type { PrototypeRole, PrototypeUser } from "@/lib/prototype-users";
import type { ApprovalLevel, MemoStatus } from "@/lib/approval";
import { formatTimestamp } from "@/lib/format-timestamp";
import { DEPARTMENTS } from "@/lib/departments";
import {
  IconUsers, IconFileText, IconShield, IconTrash,
  IconPen, IconRefresh, IconX, IconCheck, IconKey, IconSettings, IconUserPlus, IconReturn,
} from "@/components/icons";

const ALL_ROLES: { value: PrototypeRole; label: string }[] = [
  { value: "requester", label: "Requester" },
  { value: "manager", label: "Manager / Top Section" },
  { value: "general-manager", label: "General Manager" },
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

type Tab = "users" | "memos" | "system";

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
  const { users, addUser, updateUser, deleteUser, resetToDefaults } = useAdminUsers();
  const { allMemos, dispatch } = useMemos();
  const adminCount = users.filter(isPrototypeAdmin).length;
  const [tab, setTab] = useState<Tab>("users");
  const stampNow = () => formatTimestamp(new Date());

  // Users tab state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditUserState | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState<NewUserState>(emptyNewUser);

  // Memos tab state
  const [confirmDeleteMemoId, setConfirmDeleteMemoId] = useState<string | null>(null);
  const [forceStatusId, setForceStatusId] = useState<string | null>(null);
  const [forceStatus, setForceStatus] = useState<MemoStatus>("pending");

  // System tab state
  const [dbStatus, setDbStatus] = useState<"checking" | "ok" | "error">("checking");
  const [aiStatus, setAiStatus] = useState<{ thaillm: boolean; groq: boolean } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

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

  if (!isPrototypeAdmin(user)) {
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
          <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
            {([ ["users", IconUsers, "User Management"], ["memos", IconFileText, "Memo Management"], ["system", IconSettings, "System"] ] as const).map(([t, Icon, label]) => (
              <button key={t} role="tab" aria-selected={tab === t}
                onClick={() => setTab(t as Tab)}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", border: "none", background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: tab === t ? "var(--accent)" : "var(--muted)", borderBottom: `2px solid ${tab === t ? "var(--accent)" : "transparent"}`, marginBottom: -1, transition: "color 150ms" }}
              >
                <Icon size={15} />{label}
              </button>
            ))}
          </div>

          {/* ── USERS TAB ──────────────────────────────────────────── */}
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

              <div className="em-card" style={{ padding: 0, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
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
                <strong>No passwords</strong> — this prototype uses a dropdown selector, not real auth. Phase 5 will add real login with hashed credentials and a Reset Password flow.
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
                  {allMemos.length} records ({allMemos.filter(m => m.deletedAt).length} voided) — Delete is reversible soft-delete (saved to DB). <span style={{ color: "var(--amber)" }}>Force status is in-memory only.</span>
                </div>
              </div>
              <div className="em-card" style={{ padding: 0, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.03)" }}>
                      {["ID", "Title", "Status", "Dept", "Amount", "Step", "Date", "Actions"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 11.5, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
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
                        <td style={{ padding: "10px 14px" }}>
                          {isVoided ? (
                            <button className="em-btn" style={{ padding: "4px 10px", fontSize: 12, color: "#047857" }} title="Restore memo" onClick={() => dispatch({ type: "RESTORE_MEMO", id: m.id, updatedAt: stampNow() })}><IconReturn size={12} /> Restore</button>
                          ) : confirmDeleteMemoId === m.id ? (
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <span style={{ fontSize: 11.5, color: "#EF4444" }}>Void?</span>
                              <button className="em-btn" style={{ padding: "4px 8px", fontSize: 11, color: "#EF4444" }} onClick={() => { dispatch({ type: "DELETE_MEMO", id: m.id, deletedAt: stampNow() }); setConfirmDeleteMemoId(null); }}><IconCheck size={11} /></button>
                              <button className="em-btn" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setConfirmDeleteMemoId(null)}><IconX size={11} /></button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button className="em-btn" style={{ padding: "4px 10px", fontSize: 12 }} title="Force status" onClick={() => { setForceStatusId(m.id); setForceStatus(m.status); setConfirmDeleteMemoId(null); }}><IconSettings size={12} /></button>
                              <button className="em-btn" style={{ padding: "4px 10px", fontSize: 12, color: "#EF4444" }} title="Void memo (reversible)" onClick={() => { setConfirmDeleteMemoId(m.id); setForceStatusId(null); }}><IconTrash size={12} /></button>
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
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Not Yet Implemented</div>
                <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>
                  Phase 5: Real authentication (JWT / session), hashed passwords, role-based route guards, email notifications, document attachment storage, and production-grade DB schema. This admin panel will become a real user management interface at that point.
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
          <input style={fieldStyle} placeholder="e.g. HR&GA, อำภา หิงคำ" value={state.readRecipientLabels} onChange={e => onChange({ ...state, readRecipientLabels: e.target.value })} />
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
