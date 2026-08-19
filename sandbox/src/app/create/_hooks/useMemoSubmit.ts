"use client";

import { useState } from "react";
import type { useRouter } from "next/navigation";
import { MemoAttachment, ReadAction } from "@/lib/approval";
import { isAllowedAttachmentFile, MAX_ATTACHMENT_BYTES } from "@/lib/attachments";
import { formatTimestamp } from "@/lib/format-timestamp";
import { generateMemoId } from "@/lib/memo-id";
import { buildMemoDraftRecord } from "@/lib/build-memo-draft-record";
import type { NotifyNoteImage } from "@/lib/notify-note";
import { buildCustomRoute } from "@/lib/custom-route";
import { validateMemoFormForApproval } from "@/lib/validate-memo-form";
import { showErrorToast } from "@/lib/toast";
import type { useMemos } from "@/lib/memo-store";
import type { PrototypeUser } from "@/lib/prototype-users";
import type { MemoFormFieldsResult } from "./useMemoFormFields";

export interface UseMemoSubmitDeps {
  user: PrototypeUser;
  dispatch: ReturnType<typeof useMemos>["dispatch"];
  router: ReturnType<typeof useRouter>;
}

export function useMemoSubmit(fields: MemoFormFieldsResult, { user, dispatch, router }: UseMemoSubmitDeps) {
  const {
    isRevisionMode, reviseMemo,
    subject, category, itemSubcategoryId, itemSubcategoryLabel, department, amount,
    description, closingRemark, budgetStatus, accountCode, budgetPlan, budgetUsed,
    requestItems, priceComparisons, selectedVendor, selectedNotLowest, cleanVendorReason,
    effectiveIsPriceAdjustment, priceAdjustmentReason, effectiveFollowsProductionPlan,
    effectiveIsDeadStock, showDeptMonthly, deptMonthlyOverBudgetTotal, orderedReadRecipients,
    recommendation, routeReview, selectedRoute, cleanOverrideReason, canSubmitPending,
    routeSource, customRoutePeople,
    notifyNoteImageFiles,
    bodyBlocks,
  } = fields;

  // Which route this submission carries. The custom tab wins only when it is
  // actually active AND has people on it; anything else stays on the Book1 level
  // route. buildMemoDraftRecord() applies the identical rule for a brand-new memo,
  // so both paths agree on what "custom mode" means.
  const customRouteResult =
    routeSource === "custom" && (customRoutePeople?.length ?? 0) > 0
      ? buildCustomRoute(customRoutePeople!)
      : null;

  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [notifyNoteError, setNotifyNoteError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewingExcel, setIsPreviewingExcel] = useState(false);

  /**
   * Downloads the F-DC-006 Excel form for whatever is in the form right now,
   * without saving anything. The server renders it with the same generator the
   * queue's download uses, so what you check here is what you will get.
   *
   * Deliberately not gated on validateMemoFormForApproval: a preview that
   * refuses to open while the form is incomplete cannot help you see what is
   * still missing, and the file goes to nobody.
   */
  const handlePreviewExcel = async () => {
    if (isPreviewingExcel) return;
    setIsPreviewingExcel(true);
    try {
      // A new memo has no number yet, so Ref.No stays blank on the sheet — the
      // real id is timestamp-derived and would not match the one issued at
      // submit. A revision already has one and can print it.
      const memo = buildMemoDraftRecord(fields, {
        id: isRevisionMode ? reviseMemo!.id : "",
        requester: user.name,
        status: isRevisionMode ? reviseMemo!.status : "draft",
        timestamp: formatTimestamp(new Date()),
      });

      const response = await fetch("/api/memos/preview-excel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memo }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "ไม่สามารถสร้างไฟล์ตัวอย่างได้" }));
        showErrorToast(String(body.error ?? "ไม่สามารถสร้างไฟล์ตัวอย่างได้"), 5000);
        return;
      }

      // Take the name from the response rather than rebuilding it here, so the
      // two cannot disagree.
      const disposition = response.headers.get("content-disposition") ?? "";
      const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "memo-draft.xlsx";

      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "ไม่สามารถสร้างไฟล์ตัวอย่างได้", 5000);
    } finally {
      setIsPreviewingExcel(false);
    }
  };

  const addAttachmentFiles = (files: File[]) => {
    setAttachmentError(null);
    const invalid = files.find((file) => file.size > MAX_ATTACHMENT_BYTES || !isAllowedAttachmentFile(file.name, file.type));
    if (invalid) {
      setAttachmentError(`${invalid.name} is not allowed or exceeds 10 MB.`);
      return;
    }
    setAttachmentFiles((prev) => [...prev, ...files]);
  };

  const removeAttachmentFile = (index: number) => {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
    setAttachmentError(null);
  };

  const uploadSelectedAttachments = async (memoId: string): Promise<MemoAttachment[] | undefined> => {
    if (attachmentFiles.length === 0) return undefined;
    const formData = new FormData();
    formData.append("memoId", memoId);
    for (const file of attachmentFiles) formData.append("files", file);

    const response = await fetch("/api/attachments", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: "Unable to upload attachments" }));
      throw new Error(String(body.error ?? "Unable to upload attachments"));
    }
    const body = await response.json() as { attachments: MemoAttachment[] };
    return body.attachments.length > 0 ? body.attachments : undefined;
  };

  /** Same shape as uploadSelectedAttachments, for the note's own image slot
   *  (storage/notify-notes/<memoId>, not storage/attachments — see Task 3). */
  const uploadNotifyNoteImages = async (memoId: string): Promise<NotifyNoteImage[] | undefined> => {
    if (notifyNoteImageFiles.length === 0) return undefined;
    const formData = new FormData();
    formData.append("memoId", memoId);
    for (const file of notifyNoteImageFiles) formData.append("files", file);
    const response = await fetch("/api/notify-note-images", { method: "POST", body: formData });
    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: "อัปโหลดรูปไม่สำเร็จ" }));
      throw new Error(String(body.error ?? "อัปโหลดรูปไม่สำเร็จ"));
    }
    const body = await response.json() as { images: NotifyNoteImage[] };
    return body.images.length > 0 ? body.images : undefined;
  };

  const handleSubmit = async (status: "draft" | "pending") => {
    if (status === "draft" && isRevisionMode) return; // Save Draft is not available in revision mode
    if (isSubmitting) return;

    // 🔴 VALIDATION: Only validate mandatory fields when sending to approval (pending status)
    if (status === "pending") {
      if (!canSubmitPending) return;

      const validation = validateMemoFormForApproval({
        subject,
        description,
        requestItems,
        priceComparisons,
      });

      if (!validation.valid) {
        validation.errors.forEach((error) => {
          showErrorToast(error, 5000);
        });
        setIsSubmitting(false);
        return;
      }
    }

    const now = new Date();
    const stamp = formatTimestamp(now);
    setIsSubmitting(true);
    setAttachmentError(null);
    setNotifyNoteError(null);

    if (isRevisionMode) {
      // Dispatch SUBMIT_REVISION — applies new content to the existing memo and increments revision.
      dispatch({
        type: "SUBMIT_REVISION",
        id: reviseMemo!.id,
        title: subject,
        category,
        itemSubcategoryId,
        itemSubcategoryLabel,
        department,
        amount,
        description: description.trim() || undefined,
        closingRemark: closingRemark.trim() || undefined,
        budgetStatus,
        accountCode: accountCode.trim() || undefined,
        budgetPlan,
        budgetUsed,
        requestItems: requestItems.filter(r => r.name.trim() || r.unitPrice > 0),
        priceComparisons,
        selectedVendorId: selectedVendor?.id,
        selectedVendorReason: selectedNotLowest ? cleanVendorReason : undefined,
        priceAdjustmentReason: effectiveIsPriceAdjustment && priceAdjustmentReason.trim() ? priceAdjustmentReason.trim() : undefined,
        isPriceAdjustment: effectiveIsPriceAdjustment || undefined,
        followsProductionPlan: effectiveFollowsProductionPlan || undefined,
        isDeadStockOrSlowMovement: effectiveIsDeadStock || undefined,
        departmentMonthlyOverBudgetTotal: showDeptMonthly && deptMonthlyOverBudgetTotal > 0 ? deptMonthlyOverBudgetTotal : undefined,
        readRecipients: orderedReadRecipients,
        readActions: orderedReadRecipients.length > 0
          ? orderedReadRecipients.map((r): ReadAction => ({ recipient: r, status: "pending" }))
          : undefined,
        recommendedFinalApprover: recommendation.recommendedFinalApprover,
        recommendedRoute: routeReview.recommendedRoute,
        // In custom mode the route is the person tokens, not the Book1 levels.
        // customRoute is sent even when undefined: the reducer treats it as
        // authoritative, which is how a revision switches back out of custom mode.
        selectedRoute: customRouteResult ? customRouteResult.route : selectedRoute,
        customRoute: customRouteResult ? customRouteResult.approvers : undefined,
        routeMode: routeReview.mode,
        routeOverrideReason: routeReview.requiresReason ? cleanOverrideReason : undefined,
        notifyMD: recommendation.notifyMD,
        requiresMdReview: recommendation.requiresMdReview,
        // V3 free-form body: sent every time, same as customRoute above — a
        // free-form memo must resend its blocks on every revision (see the
        // server-side comment in db-memo-write.ts's SubmitRevisionBody).
        formMode: bodyBlocks.formMode,
        bodyBlocks: bodyBlocks.blocks,
        updatedAt: stamp,
      });
      router.push("/queue");
      return;
    }

    // Normal new-memo path
    const id = generateMemoId(now);
    const createdTimestamp = formatTimestamp(now);
    let attachments: MemoAttachment[] | undefined;
    let notifyNoteImages: NotifyNoteImage[] | undefined;
    // Both uploads happen before the memo is dispatched: a memo whose note refers to
    // images nobody will ever see (because the upload silently failed) is worse than
    // no memo yet. attachmentsUploaded tracks which of the two calls threw, so the
    // right card gets the error message instead of a generic one.
    let attachmentsUploaded = false;
    try {
      attachments = await uploadSelectedAttachments(id);
      attachmentsUploaded = true;
      notifyNoteImages = await uploadNotifyNoteImages(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload attachments";
      if (attachmentsUploaded) {
        setNotifyNoteError(message);
      } else {
        setAttachmentError(message);
      }
      setIsSubmitting(false);
      return;
    }
    dispatch({
      type: "ADD_MEMO",
      memo: buildMemoDraftRecord(fields, {
        id,
        requester: user.name,
        status,
        timestamp: createdTimestamp,
        attachments,
        notifyNoteImages,
      }),
    });
    router.push(status === "pending" ? "/queue" : "/");
  };

  return {
    attachmentFiles, attachmentError, isSubmitting, isPreviewingExcel,
    notifyNoteError,
    addAttachmentFiles, removeAttachmentFile, handleSubmit, handlePreviewExcel,
  };
}
