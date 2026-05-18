"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { useMemos } from "@/lib/memo-store";
import { ApprovalCategory, BudgetStatus, approvalLabels, getApprovalLevel } from "@/lib/approval";
import {
  IconFileText, IconMail, IconSparkles, IconTag, IconBuilding,
  IconUpload, IconPaperclip, IconX, IconRefresh,
  IconCheck, IconArrowRight, IconCircle, IconUsers, IconCrown,
} from "@/components/icons";
import { useRouter } from "next/navigation";

export default function CreatePage() {
  const { dispatch } = useMemos();
  const router = useRouter();

  const [subject, setSubject] = useState("ขออนุมัติซื้ออุปกรณ์สำนักงาน Q2/2026");
  const [category, setCategory] = useState<ApprovalCategory>("general-purchase");
  const [department, setDepartment] = useState("HR&GA");
  const [amount, setAmount] = useState(32000);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus>("in-budget");
  const [description, setDescription] = useState("ขออนุมัติซื้ออุปกรณ์สำนักงานสำหรับสนับสนุนการดำเนินงานของแผนก HR&GA ในไตรมาส 2/2026 ประกอบด้วยอุปกรณ์เครื่องเขียน วัสดุสิ้นเปลือง และอุปกรณ์ IT พื้นฐาน");

  const approvalLevel = getApprovalLevel({ category, amount, budgetStatus });
  const tierClass = approvalLevel === "Managing Director" ? "md" : approvalLevel === "General Manager" ? "gm" : "mgr";

  const handleSubmit = (status: "draft" | "pending") => {
    const now = new Date();
    const id = `EM-${now.getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;
    dispatch({
      type: "ADD_MEMO",
      memo: {
        id,
        title: subject,
        requester: "อำภา หิงคำ",
        department,
        category,
        amount,
        status,
        currentStep: approvalLevel,
        cycleHours: 0,
        updatedAt: now.toLocaleDateString("th-TH"),
      },
    });
    router.push(status === "pending" ? "/queue" : "/");
  };

  return (
    <div className="em-art">
      <Sidebar />
      <div className="em-work">
        <Topbar
          crumbs={["Create Memo", "New Draft"]}
          title="Create E-Memo"
          actions={
            <>
              <button className="em-btn" onClick={() => handleSubmit("draft")}><IconFileText size={15} /> Save Draft</button>
              <button className="em-btn primary" onClick={() => handleSubmit("pending")}><IconMail size={15} /> Send to Approval</button>
            </>
          }
        />
        <div className="em-content">

          {/* Stepper */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px" }}>
            <StepDot n="1" label="Memo Details" active />
            <div style={{ flex: 1, height: 1, background: "var(--line-2)", maxWidth: 60 }} />
            <StepDot n="2" label="Approver & Routing" />
            <div style={{ flex: 1, height: 1, background: "var(--line-2)", maxWidth: 60 }} />
            <StepDot n="3" label="Review & Send" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 16, alignItems: "start" }}>

            {/* Form */}
            <div className="em-card">
              <div className="em-card-head">
                <div>
                  <h3>Memo Details</h3>
                  <div className="em-sub">กรอกข้อมูลพื้นฐาน — ระบบจะเลือกผู้อนุมัติให้อัตโนมัติตาม Approval Matrix</div>
                </div>
                <span className="em-tier mgr"><IconSparkles size={11} /> AI Assist</span>
              </div>
              <div className="em-card-body em-form-grid">

                <div className="em-field">
                  <label className="em-label">Subject <span className="req">*</span></label>
                  <input className="em-input" value={subject} onChange={e => setSubject(e.target.value)} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="em-field">
                    <label className="em-label">Category <span className="req">*</span></label>
                    <div className="em-input-prefix" style={{ paddingLeft: 12 }}>
                      <IconTag size={14} style={{ color: "var(--muted)" }} />
                      <select style={{ border: 0, padding: 0, height: 32, background: "transparent", flex: 1, outline: "none", fontSize: 13 }}
                        value={category} onChange={e => setCategory(e.target.value as ApprovalCategory)}>
                        {Object.entries(approvalLabels).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="em-field">
                    <label className="em-label">Department <span className="req">*</span></label>
                    <div className="em-input-prefix" style={{ paddingLeft: 12 }}>
                      <IconBuilding size={14} style={{ color: "var(--muted)" }} />
                      <select style={{ border: 0, padding: 0, height: 32, background: "transparent", flex: 1, outline: "none", fontSize: 13 }}
                        value={department} onChange={e => setDepartment(e.target.value)}>
                        <option>HR&amp;GA</option>
                        <option>Production</option>
                        <option>IT</option>
                        <option>Engineering</option>
                        <option>GA</option>
                        <option>Maintenance</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="em-field">
                    <label className="em-label">Amount (THB) <span className="req">*</span></label>
                    <div className="em-input-prefix">
                      <span className="pre">฿</span>
                      <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} />
                      <span style={{ color: "var(--muted)", fontSize: 11.5, fontWeight: 600 }}>THB</span>
                    </div>
                    <div className="em-help">Manager ≤ 10,000 · GM ≤ 50,000 · MD &gt; 50,000</div>
                  </div>
                  <div className="em-field">
                    <label className="em-label">Budget Status <span className="req">*</span></label>
                    <div className="em-radio-row">
                      {(["in-budget", "over-budget", "no-budget"] as BudgetStatus[]).map(s => (
                        <label key={s} className={`em-radio${budgetStatus === s ? " active" : ""}`} onClick={() => setBudgetStatus(s)}>
                          <span className="em-radio-mark" />
                          {s === "in-budget" ? "ในงบ" : s === "over-budget" ? "เกินงบ" : "ไม่มีงบ"}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="em-field">
                  <label className="em-label">Description / เหตุผลการขอ <span className="req">*</span></label>
                  <textarea className="em-textarea" value={description} onChange={e => setDescription(e.target.value)} />
                </div>

                <div className="em-field">
                  <label className="em-label">Attachments</label>
                  <div className="em-upload">
                    <div className="em-upload-ico"><IconUpload size={18} /></div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                      <span style={{ color: "var(--ink)", fontWeight: 600 }}>ลากไฟล์มาวาง หรือคลิกเพื่อเลือก</span>
                      <span style={{ fontSize: 11.5 }}>PDF, DOCX, XLSX, JPG · สูงสุด 25 MB</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                    <AttachItem name="ใบเสนอราคา-3-บริษัท.pdf" size="412 KB" />
                    <AttachItem name="รายการอุปกรณ์-Q2-2026.xlsx" size="86 KB" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Recommended approver */}
              <div className="em-card" style={{ overflow: "hidden", position: "relative" }}>
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(70% 80% at 100% 0%,rgba(59,130,246,0.10),transparent 60%)" }} />
                <div className="em-card-head">
                  <div>
                    <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <IconSparkles size={15} style={{ color: "var(--primary)" }} /> Recommended Approver
                    </h3>
                    <div className="em-sub">คำนวณจาก category, amount, และ budget</div>
                  </div>
                  <span className="em-tier mgr">Auto</span>
                </div>
                <div className="em-card-body" style={{ display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>
                  <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--primary-grad-soft)", border: "1px solid var(--primary-soft)", display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--primary-grad)", display: "grid", placeItems: "center", color: "#fff", boxShadow: "0 6px 14px rgba(37,99,235,0.30)", flexShrink: 0 }}>
                      {approvalLevel === "Managing Director" ? <IconCrown size={20} /> : <IconUsers size={20} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="em-eyebrow" style={{ color: "var(--primary)" }}>Tier · {tierClass.toUpperCase()}</div>
                      <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--ink)" }}>{approvalLevel}</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <RuleChip label="Amount" value={`฿${amount.toLocaleString()}`} />
                    <RuleChip label="Budget" value={budgetStatus === "in-budget" ? "ในงบ" : budgetStatus === "over-budget" ? "เกินงบ" : "ไม่มีงบ"} tone={budgetStatus === "in-budget" ? "emerald" : "rose"} />
                    <RuleChip label="Category" value={approvalLabels[category].split(" ")[0]} />
                    <RuleChip label="Limit" value={amount <= 10000 ? "≤ ฿10,000" : amount <= 50000 ? "≤ ฿50,000" : "> ฿50,000"} tone="primary" />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <MiniStep done title="Manager / Top Section" sub="ภายในวงเงินผู้จัดการ" />
                    <MiniStep current={approvalLevel === "General Manager"} done={approvalLevel === "Managing Director"} title="General Manager" sub="อนุมัติขั้นสุดท้ายสำหรับเอกสารนี้" />
                    <MiniStep current={approvalLevel === "Managing Director"} muted={approvalLevel !== "Managing Director"} title="Managing Director" sub={approvalLevel !== "Managing Director" ? "ไม่จำเป็นภายใต้ 50,000 THB" : "ต้องการอนุมัติจาก MD"} />
                  </div>
                </div>
              </div>

              {/* Draft preview */}
              <div className="em-card">
                <div className="em-card-head">
                  <div>
                    <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <IconSparkles size={15} style={{ color: "var(--primary)" }} /> AI Draft Preview
                    </h3>
                    <div className="em-sub">ร่างจดหมายภาษาไทย — แก้ไขได้ก่อนส่ง</div>
                  </div>
                  <button className="em-btn sm ghost"><IconRefresh size={13} /> Regenerate</button>
                </div>
                <div className="em-card-body" style={{ paddingTop: 6 }}>
                  <div style={{ padding: 18, borderRadius: 10, background: "linear-gradient(180deg,#FAFBFF 0%,#FFFFFF 100%)", border: "1px solid var(--line)", fontSize: 13, lineHeight: 1.75, color: "var(--ink-2)", fontFamily: '"Noto Sans Thai",Inter,sans-serif' }}>
                    <div style={{ textAlign: "center", fontWeight: 700, marginBottom: 12, color: "var(--ink)" }}>บันทึกข้อความ</div>
                    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 14px", marginBottom: 12, fontSize: 12.5 }}>
                      <span style={{ color: "var(--muted)" }}>เรื่อง</span>
                      <span style={{ fontWeight: 600 }}>{subject}</span>
                      <span style={{ color: "var(--muted)" }}>เรียน</span>
                      <span style={{ fontWeight: 600 }}>{approvalLevel}</span>
                      <span style={{ color: "var(--muted)" }}>จาก</span>
                      <span>HR&amp;GA · อำภา หิงคำ</span>
                    </div>
                    <hr className="em-divider" style={{ margin: "10px 0 14px" }} />
                    <p style={{ marginBottom: 10 }}>
                      ขออนุมัติรายการ {approvalLabels[category]} วงเงิน <strong>฿{amount.toLocaleString()}</strong> เพื่อสนับสนุนการดำเนินงานของแผนก {department}
                    </p>
                    <p style={{ marginBottom: 10 }}>{description}</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepDot({ n, label, active }: { n: string; label: string; active?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 24, height: 24, borderRadius: 999, display: "grid", placeItems: "center", background: active ? "var(--primary-grad)" : "var(--surface)", color: active ? "#fff" : "var(--muted)", border: active ? 0 : "1px solid var(--line-2)", fontSize: 11, fontWeight: 700, boxShadow: active ? "0 4px 10px -2px rgba(37,99,235,0.45)" : "none" }}>{n}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: active ? "var(--ink)" : "var(--muted)" }}>{label}</div>
    </div>
  );
}

function AttachItem({ name, size }: { name: string; size: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-2)" }}>
      <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center", flexShrink: 0 }}><IconPaperclip size={14} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>{size}</div>
      </div>
      <IconX size={14} style={{ color: "var(--muted)" }} />
    </div>
  );
}

function RuleChip({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    emerald: { bg: "var(--emerald-soft)", color: "var(--emerald)" },
    primary: { bg: "var(--primary-soft)", color: "var(--primary)" },
    rose: { bg: "var(--rose-soft)", color: "var(--rose)" },
  };
  const c = colors[tone || ""] || { bg: "var(--surface-2)", color: "var(--ink)" };
  return (
    <div style={{ padding: "8px 12px", background: c.bg, borderRadius: 8, border: "1px solid var(--line)" }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.10em", color: "var(--muted)" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: c.color, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function MiniStep({ title, sub, done, current, muted }: { title: string; sub: string; done?: boolean; current?: boolean; muted?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 8, background: current ? "var(--primary-soft)" : "transparent", border: current ? "1px solid var(--primary-soft)" : "1px solid transparent", opacity: muted ? 0.55 : 1 }}>
      <div style={{ width: 22, height: 22, borderRadius: 999, display: "grid", placeItems: "center", background: done ? "var(--emerald-soft)" : current ? "var(--primary-grad)" : "var(--slate-soft)", color: done ? "var(--emerald)" : current ? "#fff" : "var(--muted)", flexShrink: 0 }}>
        {done ? <IconCheck size={12} /> : current ? <IconArrowRight size={12} /> : <IconCircle size={10} />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{sub}</div>
      </div>
    </div>
  );
}
