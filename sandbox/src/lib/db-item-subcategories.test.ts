import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db", () => ({ getDbPool: vi.fn() }));
import { getDbPool } from "./db";
import { deleteItemSubcategory } from "./db-item-subcategories";

describe("deleteItemSubcategory", () => {
  let execute: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.clearAllMocks();
    execute = vi.fn().mockResolvedValue([{ affectedRows: 1 }]);
    vi.mocked(getDbPool).mockReturnValue({ execute } as never);
  });

  it("deletes the row by id", async () => {
    await deleteItemSubcategory(42);
    expect(execute).toHaveBeenCalledTimes(1);
    const [sql, params] = execute.mock.calls[0];
    expect(String(sql)).toMatch(/DELETE FROM item_subcategories/i);
    expect(params).toEqual([42]);
  });
});
