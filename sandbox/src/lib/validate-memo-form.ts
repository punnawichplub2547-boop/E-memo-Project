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
 * Only validates subject and description. Request items and price comparisons are optional.
 */
export function validateMemoFormForApproval({
  subject,
  description,
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

  return {
    valid: errors.length === 0,
    errors,
  };
}
