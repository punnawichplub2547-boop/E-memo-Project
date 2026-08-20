"use client";

import { Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { useMemos } from "@/lib/memo-store";
import {
  IconChevRight, IconFileText, IconMail, IconRoute, IconSparkles, IconBookmark, IconDownload
} from "@/components/icons";
import { StepDot } from "./_components/StepDot";
import { AttachmentsCard } from "./_components/AttachmentsCard";
import { NotifyNoteCard } from "./_components/NotifyNoteCard";
import { ClosingRemarkCard } from "./_components/ClosingRemarkCard";
import { RequestItemsCard } from "./_components/RequestItemsCard";
import { BudgetCard } from "./_components/BudgetCard";
import { DraftPreviewPanel } from "./_components/DraftPreviewPanel";
import { DescriptionCard } from "./_components/DescriptionCard";
import { MemoDetailsCard } from "./_components/MemoDetailsCard";
import { RoutingTabPane } from "./_components/RoutingTabPane";
import { PriceComparisonCard } from "./_components/PriceComparisonCard";
import { BlockEditorCard } from "./_components/BlockEditorCard";
import { FormModeToggle } from "./_components/FormModeToggle";
import type { MemoFormMode } from "@/lib/memo-body-blocks";
import { useCreateMemoAssistant } from "./_hooks/useCreateMemoAssistant";
import { useMemoFormFields } from "./_hooks/useMemoFormFields";
import { useMemoTemplates } from "./_hooks/useMemoTemplates";
import { useMemoAiAssist } from "./_hooks/useMemoAiAssist";
import { useMemoSubmit } from "./_hooks/useMemoSubmit";
import { usePrototypeUser } from "@/lib/prototype-user-context";
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
    notifyNote, setNotifyNote,
    notifyNoteImageFiles, setNotifyNoteImageFiles,
    notifyAttachExcel, setNotifyAttachExcel,
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
    bodyBlocks,
    isFreeform,
    freeformCustomRouteRequiresReason,
    customRoute,
    requestItemsGrandTotal,
    addRequestItem, removeRequestItem, updateRequestItem,
    addVendorRow, removeVendorRow, updateVendorRow, handleSelectVendor,
    updateVendorDiscountPercent, markVendorNonNegotiable, rowsMissingNonNegotiableRemark,
    applyBulkData, snapshotFormData,
  } = formFields;

  // V3 free-form memo body (Task 10 — mode switch integration). Choosing
  // "freeform" forces routeSource to "custom" immediately: the server 400s a
  // free-form memo without a custom route, so the UI must not let the user
  // find that out only at submit time (carry-in C2). Fix round 1 / F4: restore
  // whatever routeSource the user had before entering free-form on the way
  // back out, rather than leaving it stuck on "custom" (e.g. a requester who
  // had already picked "Customize route เอง" in standard mode before trying
  // free-form gets that choice back, not silently reset to the Book1 tab).
  const previousRouteSourceRef = useRef<typeof customRoute.routeSource | null>(null);
  const handleFormModeChange = (mode: MemoFormMode) => {
    if (mode === "freeform" && bodyBlocks.formMode !== "freeform") {
      previousRouteSourceRef.current = customRoute.routeSource;
      customRoute.setRouteSource("custom");
    } else if (mode === "standard" && bodyBlocks.formMode === "freeform") {
      customRoute.setRouteSource(previousRouteSourceRef.current ?? "book1");
      previousRouteSourceRef.current = null;
    }
    bodyBlocks.setFormMode(mode);
  };

  const {
    templates, templatesLoading, saveModalOpen, setSaveModalOpen, isSavingTemplate,
    loadedTemplateId, loadedTemplateName, clearLoadedTemplate, loadingTemplateId,
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
    attachmentFiles, attachmentError, isSubmitting, isPreviewingExcel,
    notifyNoteError,
    addAttachmentFiles, removeAttachmentFile, handleSubmit, handlePreviewExcel,
  } = useMemoSubmit(formFields, { user, dispatch, router });

  // ── Assistant panel state — extracted to hook for localStorage persistence ──
  const { assistantExpanded, assistantTab, assistantHydrated, setAssistantExpanded, setAssistantTab } =
    useCreateMemoAssistant();

  // Built once, rendered either directly (standard form) or inside
  // BlockEditorCard's systemSlots (free-form form) — same element, same
  // props, never duplicated in the JSX below.
  const requestItemsCard = (
    <RequestItemsCard
      requestItems={requestItems}
      amount={amount}
      requestItemsGrandTotal={requestItemsGrandTotal}
      addRequestItem={addRequestItem}
      removeRequestItem={removeRequestItem}
      updateRequestItem={updateRequestItem}
    />
  );
  const priceComparisonCard = (
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
      updateVendorDiscountPercent={updateVendorDiscountPercent}
      markVendorNonNegotiable={markVendorNonNegotiable}
      rowsMissingNonNegotiableRemark={rowsMissingNonNegotiableRemark}
      onSelectVendor={handleSelectVendor}
      onPdfButtonClick={() => pdfInputRef.current?.click()}
      onClearPdfError={() => setPdfError(null)}
      onSelectedVendorReasonChange={setSelectedVendorReason}
    />
  );

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

          <FormModeToggle
            formMode={bodyBlocks.formMode}
            blockCount={bodyBlocks.blocks.length}
            disabled={isRevisionMode}
            customRoutePeopleCount={customRoute.people.length}
            onChange={handleFormModeChange}
          />

          <div className={`em-create-top-shell ${assistantExpanded ? "is-expanded" : "is-collapsed"}${assistantHydrated ? " is-ready" : ""}`}>
            <div className="em-create-main-col">
              {!isRevisionMode && (
                <TemplateSelectorCard
                  templates={templates}
                  onSelectTemplate={handleLoadTemplate}
                  onDeleteTemplate={handleDeleteTemplate}
                  isLoading={templatesLoading}
                  loadingTemplateId={loadingTemplateId}
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
                onCategoryChange={(v) => { setCategory(v); setItemSubcategoryId(undefined); setChosenApprover(null); clearLoadedTemplate(); }}
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
                isFreeform={isFreeform}
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
                    <RoutingTabPane
                      isFreeform={isFreeform}
                      customRoute={customRoute}
                      recommendation={recommendation}
                      freeformCustomRouteRequiresReason={freeformCustomRouteRequiresReason}
                      routeOverrideReason={routeOverrideReason}
                      onRouteOverrideReasonChange={setRouteOverrideReason}
                      effectiveApprover={effectiveApprover}
                      tierClass={tierClass}
                      isOverridden={isOverridden}
                      effectiveIsDeadStock={effectiveIsDeadStock}
                      skipGmStep={skipGmStep}
                      routeReview={routeReview}
                      selectedRoute={selectedRoute}
                      onApproverChange={(v) => { setChosenApprover(v); setSkipGmStep(false); }}
                      onRoutingReset={() => { setChosenApprover(null); setSkipGmStep(false); setRouteOverrideReason(""); }}
                      onSkipGmChange={setSkipGmStep}
                      readRecipients={readRecipients}
                      onReadRecipientsChange={setReadRecipients}
                    />
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

            {/* Request Items + Price Comparison — the free-form form swaps both
                for the block editor, which renders these same two cards as its
                "system" block slots instead of duplicating their V2 discount/VAT
                rules (carry-in C4). Built once and reused in both branches so
                neither card's prop list is duplicated in the JSX. */}
            {isFreeform ? (
              <BlockEditorCard
                body={bodyBlocks}
                systemSlots={{ requestItems: requestItemsCard, priceComparison: priceComparisonCard }}
              />
            ) : (
              <>
                {requestItemsCard}
                {priceComparisonCard}
              </>
            )}

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

            {/* Notification short note — own submission's notification only, not
                memo content. Not offered on revision: a resubmit does not send a
                new note notification (Q16), so there is nothing to carry here. */}
            {!isRevisionMode && (
              <NotifyNoteCard
                note={notifyNote}
                onNoteChange={setNotifyNote}
                images={notifyNoteImageFiles}
                onImagesChange={setNotifyNoteImageFiles}
                attachExcel={notifyAttachExcel}
                onAttachExcelChange={setNotifyAttachExcel}
                uploadError={notifyNoteError}
              />
            )}

            {/* Form Actions Footer */}
            <div className="em-card em-create-footer-actions">
              {/* Deliberately not disabled by canSubmitPending — the point is to
                  check the printed form while the memo is still being written. */}
              <button
                type="button"
                className="em-btn"
                disabled={isPreviewingExcel}
                onClick={handlePreviewExcel}
                title="เปิดฟอร์ม Excel ของเมโมฉบับนี้ โดยยังไม่บันทึกและยังไม่ส่ง"
              >
                <IconDownload size={15} />
                {isPreviewingExcel ? "กำลังสร้างไฟล์..." : "ดูตัวอย่างฟอร์ม Excel"}
              </button>
              {!isRevisionMode && (
                <button
                  type="button"
                  className="em-btn"
                  // Fix round 1 / F2: free-form always submits as a custom route
                  // (see handleFormModeChange above), and the server 400s a
                  // custom route with no people — without this gate, Save Draft
                  // dispatches ADD_MEMO optimistically and navigates away before
                  // that 400 comes back, so the blocks the user just wrote are
                  // gone on the next reload. canSubmitPending does not cover
                  // drafts (it also requires the vendor/item rows this button
                  // deliberately skips), so this checks the same underlying
                  // "at least one custom approver" state directly.
                  disabled={isSubmitting || (isFreeform && customRoute.people.length === 0)}
                  onClick={() => handleSubmit("draft")}
                >
                  <IconFileText size={15} /> Save Draft
                </button>
              )}
              <button
                type="button"
                className="em-btn primary"
                disabled={!canSubmitPending || isSubmitting}
                onClick={() => handleSubmit("pending")}
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
        loadedTemplateId={loadedTemplateId}
        loadedTemplateName={loadedTemplateName}
        templates={templates}
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
