import type { ApprovalCategory } from "./approval";

const APPROVAL_CATEGORIES = new Set<ApprovalCategory>([
  "raw-material",
  "fixed-asset",
  "service-contract",
  "general-purchase",
  "mold",
]);

export type ItemSubcategory = {
  id: number;
  categoryKey: ApprovalCategory;
  labelTh: string;
  sortOrder: number;
  isActive: boolean;
};

export type ItemSubcategorySnapshot = {
  itemSubcategoryId?: number;
  itemSubcategoryLabel?: string;
};

export const DEFAULT_ITEM_SUBCATEGORIES: ItemSubcategory[] = [
  { id: 1001, categoryKey: "raw-material", labelTh: "วัตถุดิบ และ ชิ้นงาน", sortOrder: 10, isActive: true },
  { id: 1002, categoryKey: "raw-material", labelTh: "วัสดุประกอบ", sortOrder: 20, isActive: true },
  { id: 1003, categoryKey: "raw-material", labelTh: "วัสดุสิ้นเปลือง", sortOrder: 30, isActive: true },
  { id: 1004, categoryKey: "raw-material", labelTh: "วัสดุโรงงาน", sortOrder: 40, isActive: true },
  { id: 1005, categoryKey: "raw-material", labelTh: "ซื้อเพื่อทดลอง หรือ งานตัวอย่าง", sortOrder: 50, isActive: true },

  { id: 2001, categoryKey: "fixed-asset", labelTh: "เครื่องจักร และ อุปกรณ์การผลิต", sortOrder: 10, isActive: true },
  { id: 2002, categoryKey: "fixed-asset", labelTh: "เครื่องมือเครื่องใช้โรงงาน", sortOrder: 20, isActive: true },
  { id: 2003, categoryKey: "fixed-asset", labelTh: "เครื่องมือเครื่องใช้สำนักงาน", sortOrder: 30, isActive: true },
  { id: 2004, categoryKey: "fixed-asset", labelTh: "รถยนต์", sortOrder: 40, isActive: true },
  { id: 2005, categoryKey: "fixed-asset", labelTh: "สินทรัพย์อื่น ๆ", sortOrder: 50, isActive: true },

  { id: 3001, categoryKey: "service-contract", labelTh: "ระบบสาธารณูปโภค", sortOrder: 10, isActive: true },
  { id: 3002, categoryKey: "service-contract", labelTh: "การซ่อมแซมบำรุงรักษาโรงงาน", sortOrder: 20, isActive: true },
  { id: 3003, categoryKey: "service-contract", labelTh: "สำนักงาน และ โรงงาน", sortOrder: 30, isActive: true },
  { id: 3004, categoryKey: "service-contract", labelTh: "อื่น ๆ", sortOrder: 40, isActive: true },

  { id: 4001, categoryKey: "general-purchase", labelTh: "สวัสดิการพนักงาน", sortOrder: 10, isActive: true },
  { id: 4002, categoryKey: "general-purchase", labelTh: "ซื้ออุปกรณ์เครื่องมือเครื่องใช้ / ซ่อมบำรุง", sortOrder: 20, isActive: true },
  { id: 4003, categoryKey: "general-purchase", labelTh: "ซื้อของทั่วไปสำนักงาน - โรงงาน", sortOrder: 30, isActive: true },
  { id: 4004, categoryKey: "general-purchase", labelTh: "อื่น ๆ", sortOrder: 40, isActive: true },
];

export function getActiveItemSubcategories(
  items: readonly ItemSubcategory[],
  categoryKey: ApprovalCategory,
): ItemSubcategory[] {
  return items
    .filter((item) => item.categoryKey === categoryKey && item.isActive)
    .sort(compareItemSubcategories);
}

export function getDefaultItemSubcategories(categoryKey: ApprovalCategory): ItemSubcategory[] {
  return getActiveItemSubcategories(DEFAULT_ITEM_SUBCATEGORIES, categoryKey);
}

export function resolveItemSubcategorySnapshot(
  items: readonly ItemSubcategory[],
  selectedId: number | undefined | null,
): ItemSubcategorySnapshot {
  if (!selectedId) return { itemSubcategoryId: undefined, itemSubcategoryLabel: undefined };
  const item = items.find((candidate) => candidate.id === selectedId && candidate.isActive);
  return {
    itemSubcategoryId: item?.id,
    itemSubcategoryLabel: item?.labelTh,
  };
}

export function compareItemSubcategories(a: ItemSubcategory, b: ItemSubcategory): number {
  return a.categoryKey.localeCompare(b.categoryKey) ||
    a.sortOrder - b.sortOrder ||
    a.labelTh.localeCompare(b.labelTh, "th");
}

export function isApprovalCategory(value: unknown): value is ApprovalCategory {
  return typeof value === "string" && APPROVAL_CATEGORIES.has(value as ApprovalCategory);
}
