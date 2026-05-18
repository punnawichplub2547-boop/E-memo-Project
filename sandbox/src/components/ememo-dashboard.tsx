"use client";

import {
  Bell,
  Bot,
  CheckCircle2,
  Clock3,
  FileSearch,
  FileText,
  Filter,
  Gauge,
  History,
  Mail,
  PenLine,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Users
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  ApprovalCategory,
  approvalLabels,
  getApprovalLevel,
  getDashboardMetrics,
  seedMemos
} from "@/lib/approval";

const navItems = [
  { label: "Dashboard", icon: Gauge },
  { label: "Create Memo", icon: PenLine },
  { label: "Approval Queue", icon: Route },
  { label: "AI Search", icon: FileSearch },
  { label: "History", icon: History }
];

const statusLabel = {
  draft: "Draft",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected"
};

export function EMemoDashboard() {
  const [category, setCategory] =
    useState<ApprovalCategory>("general-purchase");
  const [amount, setAmount] = useState(9200);
  const [query, setQuery] = useState("ซื้ออุปกรณ์สำนักงาน");

  const metrics = getDashboardMetrics(seedMemos);
  const approvalLevel = getApprovalLevel({
    category,
    amount,
    budgetStatus: "in-budget"
  });

  const filteredMemos = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return seedMemos.filter((memo) =>
      [memo.title, memo.id, memo.requester, approvalLabels[memo.category]]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [query]);

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand-block">
          <div className="brand-mark">EM</div>
          <div>
            <p className="brand-title">E-Memo</p>
            <p className="brand-subtitle">HR&GA Workflow</p>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <button
              className={item.label === "Dashboard" ? "nav-item active" : "nav-item"}
              key={item.label}
              type="button"
            >
              <item.icon aria-hidden="true" size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <ShieldCheck aria-hidden="true" size={20} />
          <div>
            <strong>Privacy Ready</strong>
            <span>Role-based access for internal memo data</span>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="page-kicker">Complete Auto Rubber Manufacturing</p>
            <h1>HR&GA E-Memo Approval Center</h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" type="button" aria-label="Notifications">
              <Bell size={18} />
            </button>
            <button className="primary-button" type="button">
              <FileText size={18} />
              New Memo
            </button>
          </div>
        </header>

        <section className="metric-grid" aria-label="Memo dashboard metrics">
          <MetricCard label="Total Memo" value={metrics.total} helper="active records" />
          <MetricCard label="Pending Approval" value={metrics.pending} helper="waiting owner action" tone="amber" />
          <MetricCard label="Approved" value={metrics.approved} helper="completed this cycle" tone="green" />
          <MetricCard label="Avg. Cycle" value={`${metrics.averageCycleHours}h`} helper="target under 24h" tone="blue" />
        </section>

        <section className="content-grid">
          <div className="panel memo-builder">
            <div className="panel-heading">
              <div>
                <h2>AI Draft Memo</h2>
                <p>สร้าง draft จากข้อมูลเบื้องต้น และเลือกผู้อนุมัติอัตโนมัติ</p>
              </div>
              <Sparkles aria-hidden="true" size={20} />
            </div>

            <div className="form-grid">
              <label>
                Category
                <select
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as ApprovalCategory)
                  }
                >
                  {Object.entries(approvalLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Amount (THB)
                <input
                  min={1}
                  type="number"
                  value={amount}
                  onChange={(event) => setAmount(Number(event.target.value))}
                />
              </label>
            </div>

            <div className="draft-preview">
              <div>
                <span className="small-label">Recommended approver</span>
                <strong>{approvalLevel}</strong>
              </div>
              <p>
                เรียนผู้อนุมัติ ขออนุมัติรายการ {approvalLabels[category]} วงเงิน{" "}
                {amount.toLocaleString("th-TH")} บาท เพื่อสนับสนุนการดำเนินงานของแผนก
                HR&GA โดยแนบเอกสารประกอบและเหตุผลการจัดซื้อไว้ในระบบแล้ว
              </p>
            </div>

            <div className="action-row">
              <button className="secondary-button" type="button">
                <UploadCloud size={17} />
                Attach Files
              </button>
              <button className="primary-button" type="button">
                <Mail size={17} />
                Send to Approval
              </button>
            </div>
          </div>

          <div className="panel approval-flow">
            <div className="panel-heading">
              <div>
                <h2>Workflow Status</h2>
                <p>ติดตามสถานะแบบ real-time จากผู้จัดการถึง MD</p>
              </div>
              <Clock3 aria-hidden="true" size={20} />
            </div>
            <div className="timeline">
              <FlowStep title="Requester" detail="Draft memo + attach files" done />
              <FlowStep title="Manager / Top Section" detail="Budget and document review" done />
              <FlowStep title="General Manager" detail="Amount threshold approval" current />
              <FlowStep title="Managing Director" detail="Required for MD-level rules" />
            </div>
          </div>
        </section>

        <section className="lower-grid">
          <div className="panel queue-panel">
            <div className="panel-heading">
              <div>
                <h2>Approval Queue</h2>
                <p>รายการเอกสารที่ต้องติดตามและอนุมัติ</p>
              </div>
              <button className="ghost-button" type="button">
                <Filter size={16} />
                Filter
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Memo ID</th>
                    <th>Subject</th>
                    <th>Owner</th>
                    <th>Approver</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {seedMemos.slice(0, 6).map((memo) => (
                    <tr key={memo.id}>
                      <td>{memo.id}</td>
                      <td>{memo.title}</td>
                      <td>{memo.requester}</td>
                      <td>{memo.currentStep}</td>
                      <td>
                        <span className={`status-pill ${memo.status}`}>
                          {statusLabel[memo.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel search-panel">
            <div className="panel-heading">
              <div>
                <h2>AI Search</h2>
                <p>ค้นหา Memo เก่าย้อนหลังด้วย keyword หรือเลขเอกสาร</p>
              </div>
              <Bot aria-hidden="true" size={20} />
            </div>
            <div className="search-box">
              <Search aria-hidden="true" size={18} />
              <input
                aria-label="Search memo"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="search-results">
              {filteredMemos.map((memo) => (
                <article key={memo.id}>
                  <span>{memo.id}</span>
                  <strong>{memo.title}</strong>
                  <small>{memo.updatedAt}</small>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone = "teal"
}: {
  label: string;
  value: number | string;
  helper: string;
  tone?: "teal" | "amber" | "green" | "blue";
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}

function FlowStep({
  title,
  detail,
  done,
  current
}: {
  title: string;
  detail: string;
  done?: boolean;
  current?: boolean;
}) {
  return (
    <div className={current ? "flow-step current" : "flow-step"}>
      <div className={done ? "flow-icon done" : "flow-icon"}>
        {done ? <CheckCircle2 size={17} /> : <Users size={17} />}
      </div>
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
    </div>
  );
}
