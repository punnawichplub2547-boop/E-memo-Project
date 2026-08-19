// Pure types, split out of approval.ts to keep that file under its line-count
// guardrail. Re-exported from approval.ts so existing imports are unaffected.

export type RequestItem = {
  id: string;
  name: string;
  unit: string;
  qty: number;
  unitPrice: number;
};

export type MemoAttachment = {
  id: string;
  originalName: string;
  storedName: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
};
