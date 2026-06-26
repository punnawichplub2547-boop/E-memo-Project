import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getDbPool } from "./db";
import type { ApprovalCategory } from "./approval";
import {
  compareItemSubcategories,
  DEFAULT_ITEM_SUBCATEGORIES,
  type ItemSubcategory,
} from "./item-subcategories";

type ItemSubcategoryDbRow = RowDataPacket & {
  id: number;
  category_key: string;
  label_th: string;
  sort_order: number;
  is_active: 0 | 1 | boolean;
  source_reference: string | null;
};

export type AdminItemSubcategory = ItemSubcategory & {
  sourceReference?: string;
};

export type ItemSubcategoryInput = {
  categoryKey: ApprovalCategory;
  labelTh: string;
  sortOrder: number;
  isActive: boolean;
};

export async function listItemSubcategories(categoryKey?: ApprovalCategory): Promise<AdminItemSubcategory[]> {
  const pool = getDbPool();
  const params: unknown[] = [];
  const where = categoryKey ? "WHERE category_key = ?" : "";
  if (categoryKey) params.push(categoryKey);
  const [rows] = await pool.query<ItemSubcategoryDbRow[]>(
    `SELECT id, category_key, label_th, sort_order, is_active, source_reference
     FROM item_subcategories
     ${where}
     ORDER BY category_key ASC, sort_order ASC, label_th ASC`,
    params,
  );
  return rows.map(rowToItemSubcategory);
}

export async function listActiveItemSubcategoriesWithFallback(categoryKey: ApprovalCategory): Promise<ItemSubcategory[]> {
  try {
    const rows = await listItemSubcategories(categoryKey);
    return rows
      .filter((row) => row.isActive)
      .sort(compareItemSubcategories);
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    return DEFAULT_ITEM_SUBCATEGORIES
      .filter((item) => item.categoryKey === categoryKey && item.isActive)
      .sort(compareItemSubcategories);
  }
}

export async function createItemSubcategory(input: ItemSubcategoryInput): Promise<AdminItemSubcategory> {
  const pool = getDbPool();
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO item_subcategories
      (category_key, label_th, sort_order, is_active, source_reference)
     VALUES (?, ?, ?, ?, ?)`,
    [
      input.categoryKey,
      input.labelTh.trim(),
      input.sortOrder,
      input.isActive,
      "Admin",
    ],
  );
  const [rows] = await pool.query<ItemSubcategoryDbRow[]>(
    `SELECT id, category_key, label_th, sort_order, is_active, source_reference
     FROM item_subcategories WHERE id = ?`,
    [result.insertId],
  );
  return rowToItemSubcategory(rows[0]);
}

export async function updateItemSubcategory(id: number, input: ItemSubcategoryInput): Promise<AdminItemSubcategory> {
  const pool = getDbPool();
  await pool.execute(
    `UPDATE item_subcategories
     SET category_key = ?, label_th = ?, sort_order = ?, is_active = ?
     WHERE id = ?`,
    [input.categoryKey, input.labelTh.trim(), input.sortOrder, input.isActive, id],
  );
  const [rows] = await pool.query<ItemSubcategoryDbRow[]>(
    `SELECT id, category_key, label_th, sort_order, is_active, source_reference
     FROM item_subcategories WHERE id = ?`,
    [id],
  );
  if (!rows[0]) throw new Error("Item subcategory not found");
  return rowToItemSubcategory(rows[0]);
}

export async function setItemSubcategoryActive(id: number, isActive: boolean): Promise<void> {
  const pool = getDbPool();
  await pool.execute(
    "UPDATE item_subcategories SET is_active = ? WHERE id = ?",
    [isActive, id],
  );
}

function rowToItemSubcategory(row: ItemSubcategoryDbRow): AdminItemSubcategory {
  return {
    id: row.id,
    categoryKey: row.category_key as ApprovalCategory,
    labelTh: row.label_th,
    sortOrder: row.sort_order,
    isActive: row.is_active === true || row.is_active === 1,
    sourceReference: row.source_reference ?? undefined,
  };
}

function isMissingTableError(error: unknown): boolean {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ER_NO_SUCH_TABLE";
}
