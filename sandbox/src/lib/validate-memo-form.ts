/**
 * Form validation for memo submission
 * Returns array of validation error messages (empty array = valid)
 */
import type { RequestItem, PriceComparison } from "./approval";
import { needsNonNegotiableRemark } from "./approval";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export const MISSING_NON_NEGOTIABLE_REMARK_ERROR =
  "กรุณาระบุหมายเหตุของผู้ขายที่เลือก เนื่องจากไม่มีส่วนลด";

/**
 * Validate memo form before sending to approval.
 * Subject and description are mandatory. The selected vendor must carry a remark
 * when it offered no discount at all — draft saves skip this entirely.
 */
export function validateMemoFormForApproval({
  subject,
  description,
  priceComparisons,
}: {
  subject: string;
  description: string;
  requestItems?: RequestItem[];
  priceComparisons?: PriceComparison[];
  category?: string;
}): ValidationResult {
  const errors: string[] = [];

  // Validate subject (mandatory)
  if (!subject || subject.trim().length === 0) {
    errors.push("Please fill in the subject/title");
  }

  // Validate description (mandatory)
  if (!description || description.trim().length === 0) {
    errors.push("Please fill in the description");
  }

  // The selected vendor must explain a zero discount.
  const rowNeedingRemark = (priceComparisons ?? []).find(
    (row) => needsNonNegotiableRemark(row) && (row.remark ?? "").trim().length === 0
  );
  if (rowNeedingRemark) {
    errors.push(MISSING_NON_NEGOTIABLE_REMARK_ERROR);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
