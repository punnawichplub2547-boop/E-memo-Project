"use client";

import { useMemo, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { useMemos } from "@/lib/memo-store";
import {
  ApprovalCategory,
  ApprovalLevel,
  approvalLabels,
  approvalLevels,
  analyzeApprovalRoute,
  buildApprovalFlow,
  BudgetStatus,
  getApprovalRecommendation,
  PriceComparison,
} from "@/lib/approval";
import {
  IconFileText, IconMail, IconSparkles, IconTag, IconBuilding,
  IconUpload, IconPaperclip, IconX, IconRefresh,
  IconArrowRight, IconCircle, IconUsers, IconCrown,
  IconBell, IconShield,
} from "@/components/icons";
import { useRouter } from "next/navigation";

// TODO: Promote ordered read/review recipients into sequential workflow steps
// once queue actions can advance per-reader. For now, the prototype preserves
// input order for audit and display without enforcing step-by-step read routing.
function parseReadRecipientsInput(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function CreatePage() {
  const { dispatch } = useMemos();
  const router = useRouter();

  const [subject, setSubject] = useState("ขออนุมัติซื้ออุปกรณ์สำนักงาน Q2/2026");
  const [category, setCategory] = useState<ApprovalCategory>("general-purchase");
  const [department, setDepartment] = useState("HR&GA");
  const [amount, setAmount] = useState(32000);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus>("in-budget");
  const [description, setDescription] = useState("ขออนุมัติซื้ออุปกรณ์สำนักงานสำหรับสนับสนุนการดำเนินงานของแผนก HR&GA");

  const [isPriceAdjustment, setIsPriceAdjustment] = useState(false);
  const [followsProductionPlan, setFollowsProductionPlan] = useState(false);
  const [isDeadStockOrSlowMovement, setIsDeadStockOrSlowMovement] = useState(false);
  const [deptMonthlyOverBudgetTotal, setDeptMonthlyOverBudgetTotal] = useState(0);
  const [chosenApprover, setChosenApprover] = useState<ApprovalLevel | null>(null);
  const [skipGmStep, setSkipGmStep] = useState(false);
  const [routeOverrideReason, setRouteOverrideReason] = useState("");
  const [readRecipients, setReadRecipients] = useState("HR&GA, ACC/FIN");
  const [accountCode, setAccountCode] = useState("GA-OPS-2026");
  const [budgetPlan, setBudgetPlan] = useState(150000);
  const [budgetUsed, setBudgetUsed] = useState(68000);
  const [priceComparisons, setPriceComparisons] = useState<PriceComparison[]>([
    { id: "1", vendorName: "", offeredPrice: 0, discount: 0, netPrice: 0, remark: "", isSelected: true },
  ]);
  const [selectedVendorReason, setSelectedVendorReason] = useState("");

  const addVendorRow = () => {
    setPriceComparisons(prev => [...prev, {
      id: String(Date.now()), vendorName: "", offeredPrice: 0, discount: 0, netPrice: 0, remark: "", isSelected: false,
    }]);
  };
  const removeVendorRow = (id: string) => {
    setPriceComparisons(prev => {
      if (prev.length === 1) return prev;
      const removingSelected = prev.find(r => r.id === id)?.isSelected ?? false;
      const next = prev.filter(r => r.id !== id);
      if (removingSelected && next.length > 0) next[0] = { ...next[0], isSelected: true };
      return next;
    });
  };
  const updateVendorRow = (id: string, updates: Partial<PriceComparison>) => {
    setPriceComparisons(prev => prev.map(row => {
      if (row.id !== id) return row;
      const offeredPrice = updates.offeredPrice ?? row.offeredPrice;
      const discount = updates.discount ?? row.discount;
      const next: PriceComparison = {
        id: row.id,
        vendorName: updates.vendorName ?? row.vendorName,
        offeredPrice,
        discount,
        netPrice: Math.max(0, offeredPrice - discount),
        remark: updates.remark !== undefined ? updates.remark : row.remark,
        isSelected: row.isSelected,
      };
      return next;
    }));
  };
  const handleSelectVendor = (id: string) => {
    setPriceComparisons(prev => prev.map(row => ({ ...row, isSelected: row.id === id })));
    setSelectedVendorReason("");
  };

  const supportsPriceAdjustment = category === "raw-material" || category === "fixed-asset";
  const supportsProductionPlan = category === "raw-material";
  const supportsDeadStock = category === "raw-material";
  const showDeptMonthly = budgetStatus !== "in-budget";

  const effectiveIsPriceAdjustment = supportsPriceAdjustment && isPriceAdjustment;
  const effectiveFollowsProductionPlan = supportsProductionPlan && followsProductionPlan;
  const effectiveIsDeadStock = supportsDeadStock && isDeadStockOrSlowMovement;

  const recommendation = useMemo(
    () =>
      getApprovalRecommendation({
        category, amount, budgetStatus,
        isPriceAdjustment: effectiveIsPriceAdjustment,
        followsProductionPlan: effectiveFollowsProductionPlan,
        isDeadStockOrSlowMovement: effectiveIsDeadStock,
        departmentMonthlyOverBudgetTotal: showDeptMonthly ? deptMonthlyOverBudgetTotal : 0,
      }),
    [category, amount, budgetStatus, effectiveIsPriceAdjustment, effectiveFollowsProductionPlan,
      effectiveIsDeadStock, deptMonthlyOverBudgetTotal, showDeptMonthly]
  );

  const effectiveApprover: ApprovalLevel = chosenApprover ?? recommendation.recommendedFinalApprover;
  const selectedRoute = useMemo(
    () =>
      effectiveApprover === "Managing Director" && skipGmStep
        ? buildApprovalFlow(effectiveApprover, { respectChosenOnly: true })
        : buildApprovalFlow(effectiveApprover),
    [effectiveApprover, skipGmStep]
  );
  const routeReview = useMemo(
    () =>
      analyzeApprovalRoute(
        recommendation.recommendedFinalApprover,
        selectedRoute
      ),
    [recommendation.recommendedFinalApprover, selectedRoute]
  );
  const flow = selectedRoute;
  const tierClass = effectiveApprover === "Managing Director" ? "md" : effectiveApprover === "General Manager" ? "gm" : "mgr";
  const isOverridden = routeReview.mode !== "recommended";
  const budgetRemaining = budgetPlan - budgetUsed - amount;
  const cleanOverrideReason = routeOverrideReason.trim();
  const orderedReadRecipients = useMemo(
    () => parseReadRecipientsInput(readRecipients),
    [readRecipients]
  );
  const firstCheckingStep = selectedRoute[0] ?? "Manager / Top Section";
  const selectedVendor = priceComparisons.find(r => r.isSelected) ?? priceComparisons[0];
  const validPrices = priceComparisons.filter(r => r.offeredPrice > 0).map(r => r.netPrice);
  const lowestNetPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
  const lowestOfferVendorNames = priceComparisons
    .filter((row) => row.offeredPrice > 0 && row.netPrice === lowestNetPrice)
    .map((row) => row.vendorName.trim())
    .filter(Boolean);
  const lowestOfferSummary =
    lowestNetPrice > 0
      ? `${lowestOfferVendorNames.length > 0 ? `${lowestOfferVendorNames.join(", ")} · ` : ""}฿${lowestNetPrice.toLocaleString()}`
      : "—";
  const selectedVendorSummary =
    selectedVendor && selectedVendor.vendorName.trim().length > 0
      ? `${selectedVendor.vendorName.trim()} · ฿${selectedVendor.netPrice.toLocaleString()}`
      : selectedVendor && selectedVendor.netPrice > 0
        ? `฿${selectedVendor.netPrice.toLocaleString()}`
        : "—";
  const selectedNotLowest = priceComparisons.length > 1 && lowestNetPrice > 0 && (selectedVendor?.netPrice ?? 0) > lowestNetPrice;
  const cleanVendorReason = selectedVendorReason.trim();
  const canSubmitPending = (!routeReview.requiresReason || cleanOverrideReason.length > 0) && (!selectedNotLowest || cleanVendorReason.length > 0);

  const handleSubmit = (status: "draft" | "pending") => {
    if (status === "pending" && !canSubmitPending) {
      return;
    }
    const now = new Date();
    const id = `EM-${now.getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;
    dispatch({
      type: "ADD_MEMO",
      memo: {
        id, title: subject, requester: "อำภา หิงคำ", department, category, amount, status,
        currentStep: firstCheckingStep,
        workflowState: "Issued",
        recommendedFinalApprover: recommendation.recommendedFinalApprover,
        recommendedRoute: routeReview.recommendedRoute,
        selectedRoute,
        routeMode: routeReview.mode,
        routeOverrideReason: routeReview.requiresReason ? cleanOverrideReason : undefined,
        readRecipients: orderedReadRecipients,
        priceComparisons,
        selectedVendorId: selectedVendor?.id,
        selectedVendorReason: selectedNotLowest ? cleanVendorReason : undefined,
        cycleHours: 0, updatedAt: now.toLocaleDateString("th-TH"),
      },
    });
    router.push(status === "pending" ? "/queue" : "/");
  };

  return (
    <div className="em-art">
      <Sidebar />
      <div className="em-work">
        <Topbar
          crumbs={["สร้าง Memo", "ฉบับร่างใหม่"]}
          title="สร้าง E-Memo"
          actions={<>
            <button className="em-btn" onClick={() => handleSubmit("draft")}><IconFileText size={15} /> Save Draft</button>
            <button className="em-btn primary" disabled={!canSubmitPending} onClick={() => handleSubmit("pending")}><IconMail size={15} /> Send to Approval</button>
          </>}
        />
        <div className="em-content">

          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px" }}>
            <StepDot n="1" label="รายละเอียด Memo" active />
            <div style={{ flex: 1, height: 1, background: "var(--line-2)", maxWidth: 60 }} />
            <StepDot n="2" label="เส้นทางอนุมัติ" />
            <div style={{ flex: 1, height: 1, background: "var(--line-2)", maxWidth: 60 }} />
            <StepDot n="3" label="ตรวจทานและส่ง" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 16, alignItems: "start" }}>

            <div className="em-card">
              <div className="em-card-head">
                <div>
                  <h3>รายละเอียด Memo</h3>
                  <div className="em-sub">กรอกข้อมูล - ระบบจะแนะนำผู้อนุมัติตาม Approval Matrix (Book1)</div>
                </div>
                <span className="em-tier mgr"><IconSparkles size={11} /> AI Assist</span>
              </div>
              <div className="em-card-body em-form-grid">

                <div className="em-field">
                  <label className="em-label">เรื่อง <span className="req">*</span></label>
                  <input className="em-input" value={subject} onChange={e => setSubject(e.target.value)} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="em-field">
                    <label className="em-label">หมวดรายการ <span className="req">*</span></label>
                    <div className="em-input-prefix" style={{ paddingLeft: 12 }}>
                      <IconTag size={14} style={{ color: "var(--muted)" }} />
                      <select style={{ border: 0, padding: 0, height: 32, background: "transparent", flex: 1, outline: "none", fontSize: 13 }}
                        value={category} onChange={e => { setCategory(e.target.value as ApprovalCategory); setChosenApprover(null); }}>
                        {Object.entries(approvalLabels).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
                      </select>
                    </div>
                  </div>
                  <div className="em-field">
                    <label className="em-label">แผนก <span className="req">*</span></label>
                    <div className="em-input-prefix" style={{ paddingLeft: 12 }}>
                      <IconBuilding size={14} style={{ color: "var(--muted)" }} />
                      <select style={{ border: 0, padding: 0, height: 32, background: "transparent", flex: 1, outline: "none", fontSize: 13 }}
                        value={department} onChange={e => setDepartment(e.target.value)}>
                        <option>HR&amp;GA</option><option>Production</option><option>IT</option>
                        <option>Engineering</option><option>GA</option><option>Maintenance</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="em-field">
                    <label className="em-label">จำนวนเงิน (THB) <span className="req">*</span></label>
                    <div className="em-input-prefix">
                      <span className="pre">฿</span>
                      <input type="number" value={amount} onChange={e => { setAmount(Number(e.target.value)); setChosenApprover(null); }} />
                      <span style={{ color: "var(--muted)", fontSize: 11.5, fontWeight: 600 }}>THB</span>
                    </div>
                    <div className="em-help">เกณฑ์ขึ้นกับหมวด - ดูแผงด้านขวาว่าเข้ากฎข้อใด</div>
                  </div>
                  <div className="em-field">
                    <label className="em-label">สถานะงบประมาณ <span className="req">*</span></label>
                    <div className="em-radio-row">
                      {(["in-budget", "over-budget", "no-budget"] as BudgetStatus[]).map(s => (
                        <label key={s} className={`em-radio${budgetStatus === s ? " active" : ""}`} onClick={() => { setBudgetStatus(s); setChosenApprover(null); }}>
                          <span className="em-radio-mark" />
                          {s === "in-budget" ? "ในงบ" : s === "over-budget" ? "เกินงบ" : "ไม่มีงบ"}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {(supportsPriceAdjustment || supportsProductionPlan || supportsDeadStock || showDeptMonthly) && (
                  <div className="em-field">
                    <label className="em-label">เงื่อนไขเพิ่มเติม (Book1)</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {supportsProductionPlan && (
                        <FlagCheckbox checked={followsProductionPlan} onChange={(v) => { setFollowsProductionPlan(v); setChosenApprover(null); }}
                          title="ซื้อตามแผนการผลิต (Book1 ข้อ 1.1)" sub="ระบบจะแนะนำ GM โดยไม่ดูจำนวนเงิน" />
                      )}
                      {supportsDeadStock && (
                        <FlagCheckbox checked={isDeadStockOrSlowMovement} onChange={setIsDeadStockOrSlowMovement}
                          title="Dead stock / Slow movement < KPI" sub="แสดงเป็นแท็กให้ผู้อนุมัติทราบ - ไม่กำหนด flow อัตโนมัติ" />
                      )}
                      {supportsPriceAdjustment && (
                        <FlagCheckbox checked={isPriceAdjustment} onChange={(v) => { setIsPriceAdjustment(v); setChosenApprover(null); }}
                          title="Supplier ปรับราคา (Book1 หมวด 1/2)" sub="ระบบจะแจ้ง MD ให้รับทราบ - flow อนุมัติยังตามวงเงิน" />
                      )}
                      {showDeptMonthly && (
                        <div className="em-field" style={{ gap: 4 }}>
                          <label className="em-label" style={{ fontSize: 11.5 }}>ยอด over-budget สะสมของแผนกในเดือนนี้ (บาท)</label>
                          <div className="em-input-prefix">
                            <span className="pre">฿</span>
                            <input type="number" min={0} value={deptMonthlyOverBudgetTotal}
                              onChange={(e) => { setDeptMonthlyOverBudgetTotal(Number(e.target.value)); setChosenApprover(null); }} />
                            <span style={{ color: "var(--muted)", fontSize: 11.5, fontWeight: 600 }}>THB</span>
                          </div>
                          <div className="em-help">โควต้า 10,000/แผนก/เดือน - เกินแล้วจะแนะนำ MD</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="em-field">
                  <label className="em-label">Description / เหตุผลการขอ <span className="req">*</span></label>
                  <textarea className="em-textarea" value={description} onChange={e => setDescription(e.target.value)} />
                </div>

                <div className="em-card" style={{ borderRadius: 10, boxShadow: "none" }}>
                  <div className="em-card-head" style={{ padding: "12px 14px" }}>
                    <div>
                      <h3 style={{ fontSize: 13 }}>แผนงบประมาณและการใช้จริง</h3>
                      <div className="em-sub" style={{ fontSize: 11.5 }}>ข้อมูลจากแบบฟอร์มกระดาษ</div>
                    </div>
                  </div>
                  <div className="em-card-body" style={{ padding: 14, display: "grid", gap: 10 }}>
                    <div style={{ display: "grid", gap: 10 }}>
                      <div className="em-field">
                        <label className="em-label">Account Code / รหัสบัญชี</label>
                        <input className="em-input" value={accountCode} onChange={(e) => setAccountCode(e.target.value)} />
                      </div>
                      <div className="em-field">
                        <label className="em-label">ผู้รับทราบ</label>
                        <textarea
                          className="em-textarea"
                          style={{ minHeight: 72 }}
                          value={readRecipients}
                          placeholder="ACC/FIN, QA/QC, Production Manager"
                          onChange={(e) => setReadRecipients(e.target.value)}
                        />
                        <div className="em-help">ผู้รับทราบ / ผู้ตรวจอ่านตามลำดับ · คั่นด้วย comma หรือขึ้นบรรทัดใหม่</div>
                        {orderedReadRecipients.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                            {orderedReadRecipients.map((recipient, index) => (
                              <span
                                key={`${recipient}-${index}`}
                                className="em-tier"
                                style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
                              >
                                {index + 1}. {recipient}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
                      <NumberField label="งบประมาณแผน" value={budgetPlan} onChange={setBudgetPlan} />
                      <NumberField label="งบที่ใช้ไป" value={budgetUsed} onChange={setBudgetUsed} />
                      <div className="em-field" style={{ gridColumn: "1 / -1" }}>
                        <label className="em-label">งบคงเหลือหลังรายการนี้</label>
                        <div className="em-input-prefix" style={{ background: "var(--surface-soft)", borderColor: "var(--primary-soft)" }}>
                          <span className="pre">฿</span>
                          <input readOnly value={budgetRemaining.toLocaleString()} style={{ fontWeight: 700, color: "var(--ink)" }} />
                          <span style={{ color: budgetRemaining < 0 ? "var(--rose)" : "var(--primary)", fontSize: 11.5, fontWeight: 700 }}>
                            {budgetRemaining < 0 ? "เกินงบ" : "คงเหลือ"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="em-card" style={{ borderRadius: 10, boxShadow: "none" }}>
                  <div className="em-card-head" style={{ padding: "12px 14px" }}>
                    <div>
                      <h3 style={{ fontSize: 13 }}>เปรียบเทียบราคา / Price Comparison</h3>
                      <div className="em-sub" style={{ fontSize: 11.5 }}>กรอกข้อมูลผู้เสนอราคา — ระบบคำนวณราคาสุทธิอัตโนมัติ</div>
                    </div>
                    <button type="button" className="em-btn sm ghost" onClick={addVendorRow} style={{ whiteSpace: "nowrap" }}>
                      + เพิ่มผู้ให้บริการ
                    </button>
                  </div>
                  <div className="em-card-body" style={{ padding: 14 }}>
                    <div style={{ overflowX: "auto" }}>
                      <table className="em-table" style={{ minWidth: 560 }}>
                        <thead>
                          <tr>
                            <th style={{ width: 32, textAlign: "center" }}>เลือก</th>
                            <th style={{ minWidth: 130 }}>ผู้ให้บริการ</th>
                            <th style={{ width: 110, textAlign: "right" }}>ราคาเสนอ (฿)</th>
                            <th style={{ width: 90, textAlign: "right" }}>ส่วนลด (฿)</th>
                            <th style={{ width: 120, textAlign: "right" }}>ราคาสุทธิ (฿)</th>
                            <th style={{ minWidth: 90 }}>หมายเหตุ</th>
                            <th style={{ width: 32 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {priceComparisons.map((row) => {
                            const isLowest = lowestNetPrice > 0 && row.offeredPrice > 0 && row.netPrice === lowestNetPrice && priceComparisons.length > 1;
                            return (
                              <tr key={row.id} style={{ background: row.isSelected ? "var(--surface-soft)" : undefined }}>
                                <td style={{ textAlign: "center" }}>
                                  <input
                                    type="radio"
                                    name="vendor-select"
                                    checked={row.isSelected}
                                    onChange={() => handleSelectVendor(row.id)}
                                    style={{ accentColor: "var(--primary)", width: 15, height: 15, cursor: "pointer" }}
                                  />
                                </td>
                                <td style={{ padding: "8px 10px" }}>
                                  <input
                                    className="em-table-input"
                                    value={row.vendorName}
                                    placeholder="ชื่อบริษัท / ผู้ให้บริการ"
                                    onChange={e => updateVendorRow(row.id, { vendorName: e.target.value })}
                                  />
                                </td>
                                <td style={{ padding: "8px 10px" }}>
                                  <input
                                    className="em-table-input num"
                                    type="number"
                                    min={0}
                                    value={row.offeredPrice || ""}
                                    placeholder="0"
                                    onChange={e => updateVendorRow(row.id, { offeredPrice: Number(e.target.value) || 0 })}
                                  />
                                </td>
                                <td style={{ padding: "8px 10px" }}>
                                  <input
                                    className="em-table-input num"
                                    type="number"
                                    min={0}
                                    value={row.discount || ""}
                                    placeholder="0"
                                    onChange={e => updateVendorRow(row.id, { discount: Number(e.target.value) || 0 })}
                                  />
                                </td>
                                <td style={{ padding: "8px 16px", textAlign: "right" }}>
                                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 6, fontVariantNumeric: "tabular-nums", fontWeight: 600, fontSize: 13 }}>
                                    ฿{row.netPrice.toLocaleString()}
                                    {isLowest && (
                                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--emerald)", background: "var(--emerald-soft)", padding: "1px 5px", borderRadius: 999, letterSpacing: "0.02em" }}>
                                        ต่ำสุด
                                      </span>
                                    )}
                                  </span>
                                </td>
                                <td style={{ padding: "8px 10px" }}>
                                  <input
                                    className="em-table-input"
                                    value={row.remark ?? ""}
                                    placeholder="หมายเหตุ"
                                    onChange={e => updateVendorRow(row.id, { remark: e.target.value })}
                                  />
                                </td>
                                <td style={{ padding: "8px 6px", textAlign: "center" }}>
                                  <button
                                    type="button"
                                    onClick={() => removeVendorRow(row.id)}
                                    disabled={priceComparisons.length === 1}
                                    style={{
                                      background: "none", border: "none",
                                      cursor: priceComparisons.length === 1 ? "default" : "pointer",
                                      color: "var(--rose)",
                                      opacity: priceComparisons.length === 1 ? 0.25 : 1,
                                      display: "grid", placeItems: "center", padding: 4,
                                    }}
                                  >
                                    <IconX size={13} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {priceComparisons.some(r => r.offeredPrice > 0) && (
                      <div style={{ display: "flex", marginTop: 10, borderRadius: 8, border: "1px solid var(--line)", overflow: "hidden", background: "var(--surface-2)" }}>
                        <PriceSummaryItem label="ราคาต่ำสุด" value={lowestNetPrice > 0 ? `฿${lowestNetPrice.toLocaleString()}` : "—"} />
                        <PriceSummaryItem label="ผู้ที่เลือก" value={selectedVendor?.vendorName || "—"} />
                        <PriceSummaryItem
                          label="ส่วนต่างจากต่ำสุด"
                          value={selectedNotLowest ? `+฿${((selectedVendor?.netPrice ?? 0) - lowestNetPrice).toLocaleString()}` : "฿0"}
                          warn={selectedNotLowest}
                        />
                      </div>
                    )}

                    {priceComparisons.some(r => r.offeredPrice > 0) && (
                      <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5 }}>
                        <strong style={{ color: "var(--ink)" }}>Quick summary:</strong> Lowest offer {lowestOfferSummary} · Selected vendor {selectedVendorSummary} · Difference from lowest {selectedNotLowest ? `+฿${((selectedVendor?.netPrice ?? 0) - lowestNetPrice).toLocaleString()}` : "฿0"}
                      </div>
                    )}

                    {selectedNotLowest && (
                      <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 8, background: "var(--amber-soft)", border: "1px solid rgba(180,83,9,0.22)" }}>
                        <div style={{ fontSize: 12.5, color: "var(--amber)", fontWeight: 700, marginBottom: 6 }}>
                          ราคาที่เลือกไม่ใช่ราคาต่ำสุด — กรุณาระบุเหตุผล
                        </div>
                        <div className="em-field" style={{ gap: 4 }}>
                          <label className="em-label" style={{ fontSize: 11.5 }}>
                            เหตุผลที่ไม่เลือกผู้เสนอราคาต่ำสุด <span className="req">*</span>
                          </label>
                          <textarea
                            className="em-textarea"
                            style={{ minHeight: 60 }}
                            placeholder="เช่น คุณภาพสินค้า, ประสบการณ์ผู้ขาย, ระยะเวลาส่งมอบ, บริการหลังการขาย"
                            value={selectedVendorReason}
                            onChange={e => setSelectedVendorReason(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="em-field">
                  <label className="em-label">เอกสารแนบ</label>
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

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              <div className="em-card" style={{ overflow: "hidden", position: "relative" }}>
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(70% 80% at 100% 0%,rgba(59,130,246,0.10),transparent 60%)" }} />
                <div className="em-card-head">
                  <div>
                    <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><IconSparkles size={15} style={{ color: "var(--primary)" }} /> Approver Routing</h3>
                    <div className="em-sub">ระบบแนะนำตาม Book1 - เลือกเองได้อิสระ</div>
                  </div>
                  <span className="em-tier mgr">{isOverridden ? "Overridden" : "Auto"}</span>
                </div>
                <div className="em-card-body" style={{ display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>

                  <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--primary-grad-soft)", border: "1px solid var(--primary-soft)", display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--primary-grad)", display: "grid", placeItems: "center", color: "#fff", boxShadow: "0 6px 14px rgba(37,99,235,0.30)", flexShrink: 0 }}>
                      {effectiveApprover === "Managing Director" ? <IconCrown size={20} /> : <IconUsers size={20} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="em-eyebrow" style={{ color: "var(--primary)" }}>Tier · {tierClass.toUpperCase()}</div>
                      <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--ink)" }}>{effectiveApprover}</div>
                    </div>
                  </div>

                  <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--line)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center", flexShrink: 0 }}><IconShield size={12} /></div>
                    <div style={{ flex: 1 }}>
                      <div className="em-eyebrow" style={{ marginBottom: 3 }}>เหตุผลจากกฎ</div>
                      <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>{recommendation.reason}</div>
                    </div>
                  </div>

                  {recommendation.notifyMD && (
                    <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--gold-soft)", border: "1px solid rgba(201,168,76,0.40)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(201,168,76,0.25)", color: "#7C5E0F", display: "grid", placeItems: "center", flexShrink: 0 }}><IconBell size={12} /></div>
                      <div style={{ flex: 1 }}>
                        <div className="em-eyebrow" style={{ marginBottom: 3, color: "#7C5E0F" }}>แจ้ง MD เพื่อทราบ</div>
                        <div style={{ fontSize: 12.5, color: "#5C4708", lineHeight: 1.5 }}>{recommendation.notifyMDReason}</div>
                      </div>
                    </div>
                  )}

                  {effectiveIsDeadStock && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <span className="em-tier" style={{ background: "var(--amber-soft)", color: "var(--amber)", borderColor: "rgba(180,83,9,0.30)" }}>Dead stock / Slow movement</span>
                    </div>
                  )}

                  <div className="em-field" style={{ gap: 4 }}>
                    <label className="em-label" style={{ fontSize: 11.5 }}>เลือกผู้อนุมัติสุดท้าย (override ได้)</label>
                    <div className="em-input-prefix" style={{ paddingLeft: 12 }}>
                      <IconUsers size={14} style={{ color: "var(--muted)" }} />
                      <select style={{ border: 0, padding: 0, height: 32, background: "transparent", flex: 1, outline: "none", fontSize: 13 }}
                        value={effectiveApprover}
                        onChange={(e) => {
                          setChosenApprover(e.target.value as ApprovalLevel);
                          setSkipGmStep(false);
                        }}>
                        {approvalLevels.map((lv) => (
                          <option key={lv} value={lv}>{lv}{lv === recommendation.recommendedFinalApprover ? " (แนะนำ)" : ""}</option>
                        ))}
                      </select>
                      {isOverridden && (
                        <button type="button" className="em-btn sm ghost" onClick={() => {
                          setChosenApprover(null);
                          setSkipGmStep(false);
                          setRouteOverrideReason("");
                        }}
                          title="คืนค่าตามที่ระบบแนะนำ" style={{ height: 26, padding: "0 8px" }}>
                          <IconRefresh size={11} /> Reset
                        </button>
                      )}
                    </div>
                    <div className="em-help">Manager ของแผนกต้องผ่านเสมอ - เลือกได้ว่าจะส่งต่อ GM/MD หรือไม่</div>
                  </div>

                  {effectiveApprover === "Managing Director" && (
                    <FlagCheckbox
                      checked={skipGmStep}
                      onChange={setSkipGmStep}
                      title="Skip GM step / ข้าม GM"
                      sub="ใช้เมื่อมีการคุยกันในชีวิตจริงแล้ว หรือ MD ขอให้ส่งตรง - ระบบจะบังคับใส่เหตุผล"
                    />
                  )}

                  <div style={{ padding: "10px 12px", borderRadius: 8, background: routeReview.mode === "exception" ? "var(--amber-soft)" : "var(--surface-2)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span className="em-eyebrow">Route status</span>
                      <span className={`em-tier ${routeReview.mode === "exception" ? "" : routeReview.mode === "escalated" ? "md" : "mgr"}`}>{routeReview.mode}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>{routeReview.reasonLabel}</div>
                  </div>

                  {routeReview.requiresReason && (
                    <div className="em-field">
                      <label className="em-label">Exception reason <span className="req">*</span></label>
                      <textarea
                        className="em-textarea"
                        style={{ minHeight: 72 }}
                        placeholder="ระบุเหตุผล เช่น คุยกับ GM แล้ว / เรื่องเร่งด่วน / MD ขอให้ส่งตรง"
                        value={routeOverrideReason}
                        onChange={(e) => setRouteOverrideReason(e.target.value)}
                      />
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {flow.map((step, idx) => (
                      <MiniStep key={step} title={step} current={step === effectiveApprover} firstMandatory={idx === 0}
                        sub={idx === 0 ? "บังคับเสมอ - ผู้จัดการแผนกตรวจสอบ"
                          : step === effectiveApprover ? "ผู้อนุมัติสุดท้ายที่เลือก" : "ผ่านเพื่อ review ก่อนส่งต่อ"} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="em-card">
                <div className="em-card-head">
                  <div>
                    <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><IconSparkles size={15} style={{ color: "var(--primary)" }} /> AI Draft Preview</h3>
                    <div className="em-sub">ร่างจดหมายภาษาไทย - แก้ไขได้ก่อนส่ง</div>
                  </div>
                  <button className="em-btn sm ghost"><IconRefresh size={13} /> Regenerate</button>
                </div>
                <div className="em-card-body" style={{ paddingTop: 6 }}>
                  <div style={{ padding: 18, borderRadius: 10, background: "linear-gradient(180deg,#FAFBFF 0%,#FFFFFF 100%)", border: "1px solid var(--line)", fontSize: 13, lineHeight: 1.75, color: "var(--ink-2)", fontFamily: '"Noto Sans Thai",Inter,sans-serif' }}>
                    <div style={{ textAlign: "center", fontWeight: 700, marginBottom: 12, color: "var(--ink)" }}>บันทึกข้อความ</div>
                    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 14px", marginBottom: 12, fontSize: 12.5 }}>
                      <span style={{ color: "var(--muted)" }}>เรื่อง</span><span style={{ fontWeight: 600 }}>{subject}</span>
                      <span style={{ color: "var(--muted)" }}>เรียน</span><span style={{ fontWeight: 600 }}>{effectiveApprover}</span>
                      <span style={{ color: "var(--muted)" }}>Route</span><span>{selectedRoute.join(" -> ")}</span>
                      <span style={{ color: "var(--muted)" }}>จาก</span><span>{department} · อำภา หิงคำ</span>
                      <span style={{ color: "var(--muted)" }}>Read / Review</span><span>{orderedReadRecipients.join(" -> ") || "—"}</span>
                      {routeReview.requiresReason && (<>
                        <span style={{ color: "var(--muted)" }}>Exception</span>
                        <span style={{ color: "#7C5E0F", fontWeight: 600 }}>{cleanOverrideReason || "ต้องระบุเหตุผลก่อนส่ง"}</span>
                      </>)}
                      {recommendation.notifyMD && (<>
                        <span style={{ color: "var(--muted)" }}>สำเนา</span>
                        <span style={{ color: "#7C5E0F", fontWeight: 600 }}>Managing Director (เพื่อทราบ - ปรับราคา)</span>
                      </>)}
                    </div>
                    <hr className="em-divider" style={{ margin: "10px 0 14px" }} />
                    <p style={{ marginBottom: 10 }}>ขออนุมัติรายการ {approvalLabels[category]} วงเงิน <strong>฿{amount.toLocaleString()}</strong> เพื่อสนับสนุนการดำเนินงานของแผนก {department}</p>
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

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="em-field">
      <label className="em-label">{label}</label>
      <div className="em-input-prefix">
        <span className="pre">฿</span>
        <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
      </div>
    </div>
  );
}

function FlagCheckbox({ checked, onChange, title, sub }: { checked: boolean; onChange: (v: boolean) => void; title: string; sub: string }) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 8, border: `1px solid ${checked ? "var(--primary)" : "var(--line-2)"}`, background: checked ? "var(--surface-soft)" : "var(--surface)", cursor: "pointer", userSelect: "none" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 2, accentColor: "var(--primary)" }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{sub}</div>
      </div>
    </label>
  );
}

function PriceSummaryItem({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{ flex: 1, padding: "10px 14px", borderRight: "1px solid var(--line)" }}>
      <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.10em", fontWeight: 600, color: "var(--muted)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: warn ? "var(--amber)" : "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function MiniStep({ title, sub, current, firstMandatory }: { title: string; sub: string; current?: boolean; firstMandatory?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 8, background: current ? "var(--primary-soft)" : "transparent", border: current ? "1px solid var(--primary-soft)" : "1px solid transparent" }}>
      <div style={{ width: 22, height: 22, borderRadius: 999, display: "grid", placeItems: "center", background: current ? "var(--primary-grad)" : "var(--slate-soft)", color: current ? "#fff" : "var(--muted)", flexShrink: 0 }}>
        {current ? <IconArrowRight size={12} /> : <IconCircle size={10} />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
          {title}
          {firstMandatory && (<span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--rose)", background: "var(--rose-soft)", padding: "1px 6px", borderRadius: 999, letterSpacing: "0.05em" }}>MANDATORY</span>)}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{sub}</div>
      </div>
    </div>
  );
}
