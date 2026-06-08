/**
 * Form validation for memo submission
 * Returns array of validation error messages (empty array = valid)
 */

import type { RequestItem, PriceComparison } from "./approval";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate memo form before sending to approval
 * Only validates mandatory fields
 * Does NOT validate for draft mode
 */
export function validateMemoFormForApproval({
  subject,
  description,
  requestItems,
  priceComparisons,
}: {
  subject: string;
  description: string;
  requestItems: RequestItem[];
  priceComparisons: PriceComparison[];
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

  // Validate request items (at least one item with name OR unitPrice > 0)
  const hasValidRequestItem = requestItems.some(
    (item) => item.name.trim().length > 0 || item.unitPrice > 0
  );
  if (!hasValidRequestItem) {
    errors.push("Please add at least one request item (name or price)");
  }

  // Validate price comparisons (at least one vendor with price if items exist)
  if (hasValidRequestItem) {
    const hasValidVendor = priceComparisons.some((v) => v.offeredPrice > 0);
    if (!hasValidVendor) {
      errors.push("Please add at least one vendor with a price");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
