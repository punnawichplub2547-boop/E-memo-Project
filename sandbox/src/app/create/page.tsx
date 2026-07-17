"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { useMemos } from "@/lib/memo-store";
import {
  IconChevRight, IconFileText, IconMail, IconRoute, IconSparkles, IconBookmark
} from "@/components/icons";
import { StepDot } from "./_components/StepDot";
import { AttachmentsCard } from "./_components/AttachmentsCard";
import { ClosingRemarkCard } from "./_components/ClosingRemarkCard";
import { RequestItemsCard } from "./_components/RequestItemsCard";
import { BudgetCard } from "./_components/BudgetCard";
import { DraftPreviewPanel } from "./_components/DraftPreviewPanel";
import { DescriptionCard } from "./_components/DescriptionCard";
import { MemoDetailsCard } from "./_components/MemoDetailsCard";
import { RoutingCard } from "./_components/RoutingCard";
import { PriceComparisonCard } from "./_components/PriceComparisonCard";
import { useCreateMemoAssistant } from "./_hooks/useCreateMemoAssistant";
import { useMemoFormFields } from "./_hooks/useMemoFormFields";
import { useMemoTemplates } from "./_hooks/useMemoTemplates";
import { useMemoAiAssist } from "./_hooks/useMemoAiAssist";
import { useMemoSubmit } from "./_hooks/useMemoSubmit";
import { usePrototypeUser } from "@/lib/prototype-user-context";
import { ReadRecipientPicker } from "./_components/ReadRecipientPicker";
import { SaveTemplateModal } from "./_components/SaveTemplateModal";
import { TemplateSelectorCard } from "./_components/TemplateSelectorCard";

const ASSISTANT_TABS_ID = "create-assistant-tabs";
const ASSISTANT_PANEL_ID = "create-assistant-tabpanel";

function CreatePageContent() {
  const searchParams = useSearchParams();
  const reviseId = searchParams.get("revise") ?? null;
  const { memos, dispatch } = useMemos();
  const { user } = usePrototypeUser();
  const router = useRouter();

  const formFields = useMemoFormFields({ memos, reviseId, user });
  const {
    issuer, reviseMemo, isRevisionMode,
    subject, setSubject,
    category, setCategory, itemSubcategoryId, setItemSubcategoryId,
    itemSubcategories, itemSubcategoriesError,
    department, setDepartment,
    amount, setAmount,
    budgetStatus, setBudgetStatus,
    description, setDescription,
    closingRemark, setClosingRemark,
    isPriceAdjustment, setIsPriceAdjustment,
    followsProductionPlan, setFollowsProductionPlan,
    isDeadStockOrSlowMovement, setIsDeadStockOrSlowMovement,
    deptMonthlyOverBudgetTotal, setDeptMonthlyOverBudgetTotal,
    readRecipients, setReadRecipients,
    accountCode, setAccountCode,
    budgetPlan, setBudgetPlan,
    budgetUsed, setBudgetUsed,
    priceComparisons, selectedVendorReason, setSelectedVendorReason,
    requestItems,
    priceAdjustmentReason, setPriceAdjustmentReason,
    setChosenApprover,
    skipGmStep, setSkipGmStep,
    routeOverrideReason, setRouteOverrideReason,
    clockDateLabel, clockTimeLabel, currentDateLabel,
    supportsPriceAdjustment, supportsProductionPlan, supportsDeadStock, showDeptMonthly,
    effectiveIsPriceAdjustment, effectiveIsDeadStock,
    recommendation,
    effectiveApprover,
    selectedRoute,
    routeReview,
    tierClass,
    isOverridden,
    budgetRemaining,
    cleanOverrideReason,
    orderedReadRecipients,
    selectedVendor,
    hasPricedVendor,
    lowestNetPrice,
    lowestOfferSummary,
    selectedVendorSummary,
    selectedNotLowest,
    selectedVendorVat,
    selectedVendorVatAmount,
    canSubmitPending,
    requestItemsGrandTotal,
    addRequestItem, removeRequestItem, updateRequestItem,
    addVendorRow, removeVendorRow, updateVendorRow, handleSelectVendor,
    applyBulkData, snapshotFormData,
  } = formFields;

  const {
    templates, templatesLoading, saveModalOpen, setSaveModalOpen, isSavingTemplate,
    handleLoadTemplate, handleSaveTemplate, handleDeleteTemplate,
  } = useMemoTemplates({ isRevisionMode, applyBulkData, snapshotFormData });

  const {
    isAiLoading, aiError, setAiError,
    isPdfLoading, pdfError, setPdfError,
    pdfInputRef,
    handleAiSuggest, handlePdfUpload,
  } = useMemoAiAssist({
    category, amount, department, budgetStatus, priceComparisons, requestItems, applyBulkData,
  });

  const {
    attachmentFiles, attachmentError, isSubmitting,
    addAttachmentFiles, removeAttachmentFile, handleSubmit,
  } = useMemoSubmit(formFields, { user, dispatch, router });

  const { assistantExpanded, assistantTab, assistantHydrated, setAssistantExpanded, setAssistantTab } =
    useCreateMemoAssistant();

  return (
    <div className="em-art">
      <Sidebar />
      <div className="em-work">
        <Topbar
          crumbs={isRevisionMode
            ? ["Approval Queue", `${reviseMemo!.id} → แก้ไข`]
            : ["สร้าง Memo", "ฉบับร่างใหม่"]}
          title={isRevisionMode ? "แก้ไขและส่งใหม่" : "สร้าง E-Memo"}
          actions={<>
            {!isRevisionMode && (
              <button type="button" className="em-btn" disabled={isSubmitting} onClick={() => setSaveModalOpen(true)}>
                <IconBookmark size={15} /> Save Template
              </button>
            )}
            <button className="em-btn primary" disabled={!canSubmitPending || isSubmitting} onClick={() => handleSubmit("pending")}>
              <IconMail size={15} />
              {isRevisionMode
                ? `ส่งแก้ไข (Rev.${(reviseMemo!.revisionNo ?? 0) + 1})`
                : "Send to Approval"}
            </button>
          </>}
        />
        <div className="em-content em-create-content">

          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handlePdfUpload(file);
            }}
          />

          {/* Revision mode banner — shows memo ID, target revision, return/reject reason, and cancel */}
          {isRevisionMode && (
            <div style={{
              padding: "10px 16px",
              borderRadius: "var(--r-md)",
              background: "rgba(251,191,36,0.10)",
              border: "1px solid rgba(180,83,9,0.22)",
              color: "var(--amber)",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 4,
            }}>
              <strong>แก้ไขและส่งใหม่:</strong>
              <span>{reviseMemo!.id}</span>
              <span style={{
                fontWeight: 700,
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                borderRadius: 4,
                padding: "1px 6px",
                fontSize: 11,
              }}>
                Rev.{(reviseMemo!.revisionNo ?? 0) + 1}
              </span>
              {reviseMemo!.returnReason && (
                <span style={{ color: "var(--muted)", fontSize: 12 }}>
                  เหตุผลที่ส่งกลับ: {reviseMemo!.returnReason}
                </span>
              )}
              {reviseMemo!.rejectReason && (
                <span style={{ color: "var(--muted)", fontSize: 12 }}>
                  ปฏิเสธ: {reviseMemo!.rejectReason}
                </span>
              )}
              <span style={{ color: "var(--muted)", fontSize: 12, fontStyle: "italic" }}>
                เส้นทางอนุมัติคำนวณใหม่จากข้อมูลที่แก้ไข
              </span>
              <button
                type="button"
                className="em-btn sm ghost"
                style={{ marginLeft: "auto" }}
                onClick={() => router.push("/queue")}
              >
                ยกเลิก
              </button>
            </div>
          )}

          <div className="em-create-stepper">
            <StepDot n="1" label="รายละเอียด Memo" active />
            <div className="em-create-step-connector is-first" aria-hidden="true" />
            <StepDot n="2" label="เส้นทางอนุมัติ" active />
            <div className="em-create-step-connector is-second" aria-hidden="true" />
            <StepDot n="3" label="ตรวจทานและส่ง" active />
            <span className="em-create-step-note">แบบฟอร์มเดียว</span>
          </div>

          <div className={`em-create-top-shell ${assistantExpanded ? "is-expanded" : "is-collapsed"}${assistantHydrated ? " is-ready" : ""}`}>
            <div className="em-create-main-col">
              {!isRevisionMode && (
                <TemplateSelectorCard
                  templates={templates}
                  onSelectTemplate={handleLoadTemplate}
                  onDeleteTemplate={handleDeleteTemplate}
                  isLoading={templatesLoading}
                />
              )}
              <MemoDetailsCard
                subject={subject}
                category={category}
                itemSubcategoryId={itemSubcategoryId}
                itemSubcategories={itemSubcategories}
                itemSubcategoriesError={itemSubcategoriesError}
                department={department}
                amount={amount}
                budgetStatus={budgetStatus}
                clockTimeLabel={clockTimeLabel}
                clockDateLabel={clockDateLabel}
                issuer={issuer}
                isAiLoading={isAiLoading}
                followsProductionPlan={followsProductionPlan}
                isDeadStockOrSlowMovement={isDeadStockOrSlowMovement}
                isPriceAdjustment={isPriceAdjustment}
                priceAdjustmentReason={priceAdjustmentReason}
                deptMonthlyOverBudgetTotal={deptMonthlyOverBudgetTotal}
                supportsPriceAdjustment={supportsPriceAdjustment}
                supportsProductionPlan={supportsProductionPlan}
                supportsDeadStock={supportsDeadStock}
                showDeptMonthly={showDeptMonthly}
                effectiveIsPriceAdjustment={effectiveIsPriceAdjustment}
                onSubjectChange={setSubject}
                onCategoryChange={(v) => { setCategory(v); setItemSubcategoryId(undefined); setChosenApprover(null); }}
                onItemSubcategoryChange={setItemSubcategoryId}
                onDepartmentChange={setDepartment}
                onAmountChange={(v) => { setAmount(v); setChosenApprover(null); }}
                onBudgetStatusChange={(v) => { setBudgetStatus(v); setChosenApprover(null); }}
                onFollowsProductionPlanChange={(v) => { setFollowsProductionPlan(v); setChosenApprover(null); }}
                onIsDeadStockChange={setIsDeadStockOrSlowMovement}
                onIsPriceAdjustmentChange={(v) => { setIsPriceAdjustment(v); setChosenApprover(null); }}
                onPriceAdjustmentReasonChange={setPriceAdjustmentReason}
                onDeptMonthlyChange={(v) => { setDeptMonthlyOverBudgetTotal(v); setChosenApprover(null); }}
                onAiSuggest={handleAiSuggest}
              />

              <DescriptionCard
                description={description}
                onDescriptionChange={(v) => { setDescription(v); setAiError(null); }}
                aiError={aiError}
                isPdfLoading={isPdfLoading}
                onPdfClick={() => pdfInputRef.current?.click()}
              />
            </div>

            {/* Assistant column — single unified tree; CSS drives desktop/mobile layout */}
            <div className={`em-create-assistant-col ${assistantExpanded ? "is-expanded" : "is-collapsed"}`}>

              {/* Icon rail: display:none by default; CSS shows it on desktop when collapsed */}
              <div className="em-create-assistant-rail" aria-label="Assistant rail">
                <button
                  type="button"
                  className={`em-create-assistant-rail-btn ${assistantTab === "routing" ? "is-active" : ""}`}
                  onClick={() => { setAssistantTab("routing"); setAssistantExpanded(true); }}
                  title="Approver Routing"
                  aria-label="Open Approver Routing panel"
                >
                  <IconRoute size={18} />
                </button>
                <button
                  type="button"
                  className={`em-create-assistant-rail-btn ${assistantTab === "draft" ? "is-active" : ""}`}
                  onClick={() => { setAssistantTab("draft"); setAssistantExpanded(true); }}
                  title="AI Draft Preview"
                  aria-label="Open AI Draft Preview panel"
                >
                  <IconSparkles size={18} />
                </button>
                <button
                  type="button"
                  className={`em-create-assistant-rail-btn ${assistantTab === "remark" ? "is-active" : ""}`}
                  onClick={() => { setAssistantTab("remark"); setAssistantExpanded(true); }}
                  title="หมายเหตุ / Closing Remark"
                  aria-label="Open Closing Remark panel"
                >
                  <IconFileText size={18} />
                </button>
              </div>

              {/* Full panel: always rendered; CSS hides it on desktop when collapsed */}
              <div className="em-create-assistant-panel">
                <div className="em-create-assistant-head">
                  <div
                    id={ASSISTANT_TABS_ID}
                    className="em-tabs em-create-assistant-tabs"
                    role="tablist"
                    aria-label="Create memo assistant tabs"
                  >
                    <button
                      id="create-assistant-tab-routing"
                      type="button"
                      role="tab"
                      aria-controls={ASSISTANT_PANEL_ID}
                      aria-selected={assistantTab === "routing"}
                      tabIndex={assistantTab === "routing" ? 0 : -1}
                      className={`em-tab ${assistantTab === "routing" ? "active" : ""}`}
                      onClick={() => setAssistantTab("routing")}
                    >
                      <IconRoute size={14} />
                      Approver Routing
                    </button>
                    <button
                      id="create-assistant-tab-draft"
                      type="button"
                      role="tab"
                      aria-controls={ASSISTANT_PANEL_ID}
                      aria-selected={assistantTab === "draft"}
                      tabIndex={assistantTab === "draft" ? 0 : -1}
                      className={`em-tab ${assistantTab === "draft" ? "active" : ""}`}
                      onClick={() => setAssistantTab("draft")}
                    >
                      <IconSparkles size={14} />
                      AI Draft Preview
                    </button>
                    <button
                      id="create-assistant-tab-remark"
                      type="button"
                      role="tab"
                      aria-controls={ASSISTANT_PANEL_ID}
                      aria-selected={assistantTab === "remark"}
                      tabIndex={assistantTab === "remark" ? 0 : -1}
                      className={`em-tab ${assistantTab === "remark" ? "active" : ""}`}
                      onClick={() => setAssistantTab("remark")}
                    >
                      <IconFileText size={14} />
                      หมายเหตุ
                    </button>
                  </div>
                  {/* Collapse button: display:none by default; CSS shows it on desktop only */}
                  <button
                    type="button"
                    className="em-btn sm ghost em-create-assistant-collapse"
                    onClick={() => setAssistantExpanded(false)}
                    aria-label="Collapse assistant panel"
                    title="Collapse assistant panel to icon rail"
                  >
                    <IconChevRight size={14} />
                  </button>
                </div>

                {/* Both panes always mounted; CSS hides inactive pane via data-tab attribute */}
                <div
                  id={ASSISTANT_PANEL_ID}
                  className="em-create-assistant-body"
                  role="tabpanel"
                  aria-labelledby={`create-assistant-tab-${assistantTab}`}
                  data-tab={assistantTab}
                >
                  <div className="em-create-tab-pane" data-pane="routing">
                    <RoutingCard
                      effectiveApprover={effectiveApprover}
                      tierClass={tierClass}
                      isOverridden={isOverridden}
                      effectiveIsDeadStock={effectiveIsDeadStock}
                      skipGmStep={skipGmStep}
                      routeOverrideReason={routeOverrideReason}
                      routeReview={routeReview}
                      recommendation={recommendation}
                      flow={selectedRoute}
                      onApproverChange={(v) => { setChosenApprover(v); setSkipGmStep(false); }}
                      onReset={() => { setChosenApprover(null); setSkipGmStep(false); setRouteOverrideReason(""); }}
                      onSkipGmChange={setSkipGmStep}
                      onRouteOverrideReasonChange={setRouteOverrideReason}
                    />
                    <div style={{
                      marginTop: 12,
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--r-md)",
                      padding: "12px 14px",
                    }}>
                      <div className="em-eyebrow" style={{ fontSize: 11, marginBottom: 8 }}>
                        ผู้รับทราบ / Read Recipients
                      </div>
                      <div className="em-field">
                        <ReadRecipientPicker
                          value={readRecipients}
                          onChange={setReadRecipients}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="em-create-tab-pane" data-pane="draft">
                    <DraftPreviewPanel
                      subject={subject}
                      category={category}
                      department={department}
                      amount={amount}
                      description={description}
                      effectiveApprover={effectiveApprover}
                      selectedRoute={selectedRoute}
                      orderedReadRecipients={orderedReadRecipients}
                      routeReview={routeReview}
                      recommendation={recommendation}
                      currentDateLabel={currentDateLabel}
                      requestItems={requestItems}
                      requestItemsGrandTotal={requestItemsGrandTotal}
                      cleanOverrideReason={cleanOverrideReason}
                      issuerName={user.name}
                      closingRemark={closingRemark}
                    />
                  </div>
                  <div className="em-create-tab-pane" data-pane="remark">
                    <ClosingRemarkCard
                      value={closingRemark}
                      onChange={setClosingRemark}
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Lower full-width section — moved out of the left column for spacious layout */}
          <div className="em-form-rows" style={{ display: "grid", gap: 14 }}>

            {/* Request Items — full width */}
            <RequestItemsCard
              requestItems={requestItems}
              amount={amount}
              requestItemsGrandTotal={requestItemsGrandTotal}
              addRequestItem={addRequestItem}
              removeRequestItem={removeRequestItem}
              updateRequestItem={updateRequestItem}
            />

            {/* Budget + Attachments — paired 2-col */}
            <div className="em-pair-grid">

              {/* Budget card */}
              <BudgetCard
                accountCode={accountCode}
                setAccountCode={setAccountCode}
                budgetPlan={budgetPlan}
                setBudgetPlan={setBudgetPlan}
                budgetUsed={budgetUsed}
                setBudgetUsed={setBudgetUsed}
                budgetRemaining={budgetRemaining}
              />

              {isRevisionMode ? (
                <section className="em-card" style={{ display: "grid", gap: 8, alignContent: "start" }}>
                  <div className="em-eyebrow">Attachments</div>
                  <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>
                    Existing attachments stay with this memo. Attachment changes during revision are deferred for the prototype.
                  </div>
                </section>
              ) : (
                <AttachmentsCard
                  files={attachmentFiles}
                  error={attachmentError}
                  onFilesAdded={addAttachmentFiles}
                  onRemoveFile={removeAttachmentFile}
                />
              )}

            </div>

            {/* Price Comparison — premium full-width financial decision card */}
            <PriceComparisonCard
              priceComparisons={priceComparisons}
              isPdfLoading={isPdfLoading}
              pdfError={pdfError}
              selectedVendor={selectedVendor}
              selectedVendorReason={selectedVendorReason}
              lowestNetPrice={lowestNetPrice}
              hasPricedVendor={hasPricedVendor}
              selectedNotLowest={selectedNotLowest}
              selectedVendorVat={selectedVendorVat}
              selectedVendorVatAmount={selectedVendorVatAmount}
              lowestOfferSummary={lowestOfferSummary}
              selectedVendorSummary={selectedVendorSummary}
              addVendorRow={addVendorRow}
              removeVendorRow={removeVendorRow}
              updateVendorRow={updateVendorRow}
              onSelectVendor={handleSelectVendor}
              onPdfButtonClick={() => pdfInputRef.current?.click()}
              onClearPdfError={() => setPdfError(null)}
              onSelectedVendorReasonChange={setSelectedVendorReason}
            />

            {/* Form Actions Footer */}
            <div className="em-card em-create-footer-actions" style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
              padding: "16px 24px",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-lg)",
            }}>
              {!isRevisionMode && (
                <button
                  type="button"
                  className="em-btn"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit("draft")}
                  style={{ minWidth: 120 }}
                >
                  <IconFileText size={15} /> Save Draft
                </button>
              )}
              <button
                type="button"
                className="em-btn primary"
                disabled={!canSubmitPending || isSubmitting}
                onClick={() => handleSubmit("pending")}
                style={{ minWidth: 160 }}
              >
                <IconMail size={15} />
                {isRevisionMode
                  ? `ส่งแก้ไข (Rev.${(reviseMemo!.revisionNo ?? 0) + 1})`
                  : "Send to Approval"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <SaveTemplateModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onSave={handleSaveTemplate}
        isSaving={isSavingTemplate}
      />
    </div>
  );
}

// Suspense wrapper required for useSearchParams() in Next.js App Router.
// When a revise= param is present we wait for DB hydration to settle before
// mounting the form, so the lazy useState initializers always see the real memo
// data rather than the seed-only snapshot that exists on a hard reload.
function CreatePageWithParams() {
  const searchParams = useSearchParams();
  const reviseId = searchParams.get("revise") ?? null;
  const { hydrated } = useMemos();

  if (reviseId && !hydrated) {
    return (
      <div className="em-art">
        <Sidebar />
        <div className="em-work" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 14, color: "var(--muted)" }}>กำลังโหลดข้อมูล...</span>
        </div>
      </div>
    );
  }

  return <CreatePageContent key={reviseId ?? "new"} />;
}

export default function CreatePage() {
  return (
    <Suspense fallback={null}>
      <CreatePageWithParams />
    </Suspense>
  );
}
