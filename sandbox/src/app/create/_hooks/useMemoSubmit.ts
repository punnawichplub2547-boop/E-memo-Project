"use client";

import { useState } from "react";
import type { useRouter } from "next/navigation";
import { MemoAttachment, ReadAction } from "@/lib/approval";
import { isAllowedAttachmentFile, MAX_ATTACHMENT_BYTES } from "@/lib/attachments";
import { formatTimestamp } from "@/lib/format-timestamp";
import { generateMemoId } from "@/lib/memo-id";
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
    recommendation, routeReview, selectedRoute, cleanOverrideReason, firstCheckingStep, canSubmitPending,
  } = fields;

  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        selectedRoute,
        routeMode: routeReview.mode,
        routeOverrideReason: routeReview.requiresReason ? cleanOverrideReason : undefined,
        notifyMD: recommendation.notifyMD,
        requiresMdReview: recommendation.requiresMdReview,
        updatedAt: stamp,
      });
      router.push("/queue");
      return;
    }

    // Normal new-memo path
    const id = generateMemoId(now);
    const createdTimestamp = formatTimestamp(now);
    let attachments: MemoAttachment[] | undefined;
    try {
      attachments = await uploadSelectedAttachments(id);
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : "Unable to upload attachments");
      setIsSubmitting(false);
      return;
    }
    dispatch({
      type: "ADD_MEMO",
      memo: {
        id, title: subject, requester: user.name, department, category, amount, status,
        itemSubcategoryId,
        itemSubcategoryLabel,
        currentStep: firstCheckingStep,
        workflowState: "Issued",
        recommendedFinalApprover: recommendation.recommendedFinalApprover,
        recommendedRoute: routeReview.recommendedRoute,
        selectedRoute,
        routeMode: routeReview.mode,
        routeOverrideReason: routeReview.requiresReason ? cleanOverrideReason : undefined,
        readRecipients: orderedReadRecipients,
        readActions: status === "pending" && orderedReadRecipients.length > 0
          ? orderedReadRecipients.map((r): ReadAction => ({ recipient: r, status: "pending" }))
          : undefined,
        description: description.trim() || undefined,
        closingRemark: closingRemark.trim() || undefined,
        budgetStatus,
        accountCode: accountCode.trim() || undefined,
        budgetPlan,
        budgetUsed,
        notifyMD: recommendation.notifyMD,
        requiresMdReview: recommendation.requiresMdReview,
        priceComparisons,
        selectedVendorId: selectedVendor?.id,
        selectedVendorReason: selectedNotLowest ? cleanVendorReason : undefined,
        requestItems: requestItems.filter(r => r.name.trim() || r.unitPrice > 0),
        attachments,
        priceAdjustmentReason: effectiveIsPriceAdjustment && priceAdjustmentReason.trim() ? priceAdjustmentReason.trim() : undefined,
        isPriceAdjustment: effectiveIsPriceAdjustment || undefined,
        followsProductionPlan: effectiveFollowsProductionPlan || undefined,
        isDeadStockOrSlowMovement: effectiveIsDeadStock || undefined,
        departmentMonthlyOverBudgetTotal: showDeptMonthly && deptMonthlyOverBudgetTotal > 0 ? deptMonthlyOverBudgetTotal : undefined,
        cycleHours: 0, createdAt: createdTimestamp, updatedAt: createdTimestamp,
      },
    });
    router.push(status === "pending" ? "/queue" : "/");
  };

  return {
    attachmentFiles, attachmentError, isSubmitting,
    addAttachmentFiles, removeAttachmentFile, handleSubmit,
  };
}
