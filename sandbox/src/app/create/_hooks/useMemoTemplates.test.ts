// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useMemoTemplates } from "./useMemoTemplates";

vi.mock("@/lib/toast", () => ({
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useMemoTemplates", () => {
  it("skips the initial fetch in revision mode", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() =>
      useMemoTemplates({ isRevisionMode: true, applyBulkData: vi.fn(), snapshotFormData: vi.fn() })
    );
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches templates on mount when not in revision mode", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ templates: [{ id: 1, name: "แม่แบบ A", category: "วัตถุดิบ", updatedAt: "2026-07-28T00:00:00.000Z" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() =>
      useMemoTemplates({ isRevisionMode: false, applyBulkData: vi.fn(), snapshotFormData: vi.fn() })
    );
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));
    expect(fetchMock).toHaveBeenCalledWith("/api/templates");
    expect(result.current.templates).toHaveLength(1);
  });

  it("handleLoadTemplate fetches the full template and applies it", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ templates: [] }) }) // initial GET list
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ template: { id: 1, userId: 1, name: "แม่แบบ A", templateJson: '{"subject":"หัวข้อ","amount":999}', createdAt: "", updatedAt: "" } }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const applyBulkData = vi.fn();
    const { result } = renderHook(() =>
      useMemoTemplates({ isRevisionMode: false, applyBulkData, snapshotFormData: vi.fn() })
    );
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      await result.current.handleLoadTemplate(1, "แม่แบบ A");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/templates/1");
    expect(applyBulkData).toHaveBeenCalledWith({ subject: "หัวข้อ", amount: 999 });
    expect(result.current.loadedTemplateId).toBe(1);
    expect(result.current.loadedTemplateName).toBe("แม่แบบ A");
    expect(result.current.loadingTemplateId).toBe(null);
  });

  it("handleLoadTemplate leaves the form untouched and refreshes the list when the template is already deleted", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ templates: [] }) }) // initial GET list
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: "Template not found or not owned by user" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ templates: [] }) }); // refetch
    vi.stubGlobal("fetch", fetchMock);
    const applyBulkData = vi.fn();
    const { result } = renderHook(() =>
      useMemoTemplates({ isRevisionMode: false, applyBulkData, snapshotFormData: vi.fn() })
    );
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      await result.current.handleLoadTemplate(1, "แม่แบบ A");
    });

    expect(applyBulkData).not.toHaveBeenCalled();
    expect(result.current.loadedTemplateId).toBe(null);
    expect(fetchMock).toHaveBeenCalledTimes(3); // list, failed load, refetch
  });

  it("handleLoadTemplate does not apply anything when the request fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ templates: [] }) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: "Internal Server Error" }) });
    vi.stubGlobal("fetch", fetchMock);
    const applyBulkData = vi.fn();
    const { result } = renderHook(() =>
      useMemoTemplates({ isRevisionMode: false, applyBulkData, snapshotFormData: vi.fn() })
    );
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      await result.current.handleLoadTemplate(1, "แม่แบบ A");
    });

    expect(applyBulkData).not.toHaveBeenCalled();
    expect(result.current.loadedTemplateId).toBe(null);
    expect(result.current.loadingTemplateId).toBe(null);
  });

  it("handleLoadTemplate does not apply anything when the stored JSON is corrupt", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ templates: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ template: { id: 1, userId: 1, name: "พัง", templateJson: "{not json", createdAt: "", updatedAt: "" } }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const applyBulkData = vi.fn();
    const { result } = renderHook(() =>
      useMemoTemplates({ isRevisionMode: false, applyBulkData, snapshotFormData: vi.fn() })
    );
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      await result.current.handleLoadTemplate(1, "พัง");
    });

    expect(applyBulkData).not.toHaveBeenCalled();
    expect(result.current.loadedTemplateId).toBe(null);
  });

  it("handleSaveTemplate posts the snapshot and closes the modal on success", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ templates: [] }) }) // initial GET
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 2 }) }) // POST save
      .mockResolvedValueOnce({ ok: true, json: async () => ({ templates: [] }) }); // refetch GET
    vi.stubGlobal("fetch", fetchMock);
    const snapshotFormData = vi.fn().mockReturnValue({ title: "หัวข้อ" });
    const { result } = renderHook(() =>
      useMemoTemplates({ isRevisionMode: false, applyBulkData: vi.fn(), snapshotFormData })
    );
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      result.current.setSaveModalOpen(true);
      await result.current.handleSaveTemplate("แม่แบบใหม่");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/templates", expect.objectContaining({ method: "POST" }));
    expect(result.current.saveModalOpen).toBe(false);
    expect(result.current.loadedTemplateId).toBe(2);
  });

  it("handleSaveTemplate with an overwriteId PUTs to /api/templates/:id instead of posting", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ templates: [] }) }) // initial GET
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // PUT overwrite
      .mockResolvedValueOnce({ ok: true, json: async () => ({ templates: [] }) }); // refetch GET
    vi.stubGlobal("fetch", fetchMock);
    const snapshotFormData = vi.fn().mockReturnValue({ title: "หัวข้อ" });
    const { result } = renderHook(() =>
      useMemoTemplates({ isRevisionMode: false, applyBulkData: vi.fn(), snapshotFormData })
    );
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      await result.current.handleSaveTemplate("แม่แบบเดิม", 7);
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/templates/7", expect.objectContaining({ method: "PUT" }));
  });

  it("handleDeleteTemplate clears the loaded template when the deleted id matches", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ templates: [] }) }) // initial GET
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ template: { id: 5, userId: 1, name: "แม่แบบ B", templateJson: '{"subject":"x"}', createdAt: "", updatedAt: "" } }),
      }) // load
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // DELETE
      .mockResolvedValueOnce({ ok: true, json: async () => ({ templates: [] }) }); // refetch GET
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() =>
      useMemoTemplates({ isRevisionMode: false, applyBulkData: vi.fn(), snapshotFormData: vi.fn() })
    );
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      await result.current.handleLoadTemplate(5, "แม่แบบ B");
    });
    expect(result.current.loadedTemplateId).toBe(5);

    await act(async () => {
      await result.current.handleDeleteTemplate(5);
    });

    expect(result.current.loadedTemplateId).toBe(null);
    expect(result.current.loadedTemplateName).toBe("");
  });
});
