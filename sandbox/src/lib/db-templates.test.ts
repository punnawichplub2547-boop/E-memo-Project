import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db", () => ({ getDbPool: vi.fn() }));
import { getDbPool } from "./db";
import { createTemplate, getTemplatesByUserId, getTemplateById, deleteTemplate, updateTemplate } from "./db-templates";

describe("db-templates helpers", () => {
  let query: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.clearAllMocks();
    query = vi.fn();
    vi.mocked(getDbPool).mockReturnValue({ query } as never);
  });

  describe("createTemplate", () => {
    it("inserts a template and returns insertId", async () => {
      query.mockResolvedValue([{ insertId: 101 }]);
      const id = await createTemplate(1, "Test Template", { title: "Hello" });
      expect(id).toBe(101);
      expect(query).toHaveBeenCalledTimes(1);
      const [sql, params] = query.mock.calls[0];
      expect(sql).toMatch(/INSERT INTO memo_templates/i);
      expect(params).toEqual([1, "Test Template", JSON.stringify({ title: "Hello" })]);
    });
  });

  describe("getTemplatesByUserId", () => {
    it("queries templates and returns mapped list", async () => {
      const mockRows = [
        { id: 10, userId: 1, name: "T1", templateJson: '{"title":"T1"}', createdAt: "2026-07-13", updatedAt: "2026-07-13" },
      ];
      query.mockResolvedValue([mockRows]);
      const result = await getTemplatesByUserId(1);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(10);
      expect(result[0].name).toBe("T1");
      expect(result[0].templateJson).toBe('{"title":"T1"}');
      expect(query).toHaveBeenCalledTimes(1);
      const [sql, params] = query.mock.calls[0];
      expect(sql).toMatch(/SELECT .* FROM memo_templates WHERE user_id/i);
      expect(params).toEqual([1]);
    });
  });

  describe("getTemplateById", () => {
    it("returns null if not found", async () => {
      query.mockResolvedValue([[]]);
      const result = await getTemplateById(99);
      expect(result).toBeNull();
    });

    it("returns mapped template if found", async () => {
      const mockRows = [
        { id: 99, userId: 2, name: "T2", templateJson: '{"title":"T2"}', createdAt: "2026-07-13", updatedAt: "2026-07-13" },
      ];
      query.mockResolvedValue([mockRows]);
      const result = await getTemplateById(99);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(99);
      expect(result?.userId).toBe(2);
      expect(result?.name).toBe("T2");
    });
  });

  describe("deleteTemplate", () => {
    it("deletes template and returns true if affectedRows > 0", async () => {
      query.mockResolvedValue([{ affectedRows: 1 }]);
      const ok = await deleteTemplate(99, 1);
      expect(ok).toBe(true);
      expect(query).toHaveBeenCalledTimes(1);
      const [sql, params] = query.mock.calls[0];
      expect(sql).toMatch(/DELETE FROM memo_templates WHERE id = \? AND user_id = \?/i);
      expect(params).toEqual([99, 1]);
    });

    it("returns false if affectedRows is 0", async () => {
      query.mockResolvedValue([{ affectedRows: 0 }]);
      const ok = await deleteTemplate(99, 1);
      expect(ok).toBe(false);
    });
  });

  describe("updateTemplate", () => {
    it("updates template and returns true if affectedRows > 0", async () => {
      query.mockResolvedValue([{ affectedRows: 1 }]);
      const ok = await updateTemplate(101, 1, "New Name", { title: "Updated" });
      expect(ok).toBe(true);
      expect(query).toHaveBeenCalledTimes(1);
      const [sql, params] = query.mock.calls[0];
      expect(sql).toMatch(/UPDATE memo_templates SET name = \?, template_json = \? WHERE id = \? AND user_id = \?/i);
      expect(params).toEqual(["New Name", JSON.stringify({ title: "Updated" }), 101, 1]);
    });

    it("returns false if affectedRows is 0", async () => {
      query.mockResolvedValue([{ affectedRows: 0 }]);
      const ok = await updateTemplate(101, 1, "New Name", { title: "Updated" });
      expect(ok).toBe(false);
    });
  });
});
