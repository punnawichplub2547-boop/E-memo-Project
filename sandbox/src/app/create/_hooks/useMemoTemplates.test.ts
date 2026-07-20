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
      json: async () => ({ templates: [{ id: 1, userId: 1, name: "แม่แบบ A", templateJson: "{}", createdAt: "", updatedAt: "" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() =>
      useMemoTemplates({ isRevisionMode: false, applyBulkData: vi.fn(), snapshotFormData: vi.fn() })
    );
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));
    expect(fetchMock).toHaveBeenCalledWith("/api/templates");
    expect(result.current.templates).toHaveLength(1);
  });

  it("handleLoadTemplate forwards parsed data to applyBulkData and tracks the loaded template", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ templates: [] }) }));
    const applyBulkData = vi.fn();
    const { result } = renderHook(() =>
      useMemoTemplates({ isRevisionMode: false, applyBulkData, snapshotFormData: vi.fn() })
    );
    // Wait for the initial effect to settle
    await act(async () => {
      await Promise.resolve();
    });
    const data = { title: "หัวข้อ", amount: 999 };
    act(() => result.current.handleLoadTemplate(1, "แม่แบบ A", data));
    expect(applyBulkData).toHaveBeenCalledWith(data);
    expect(result.current.loadedTemplateId).toBe(1);
    expect(result.current.loadedTemplateName).toBe("แม่แบบ A");
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
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // DELETE
      .mockResolvedValueOnce({ ok: true, json: async () => ({ templates: [] }) }); // refetch GET
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() =>
      useMemoTemplates({ isRevisionMode: false, applyBulkData: vi.fn(), snapshotFormData: vi.fn() })
    );
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    act(() => result.current.handleLoadTemplate(5, "แม่แบบ B", { title: "x" }));
    expect(result.current.loadedTemplateId).toBe(5);

    await act(async () => {
      await result.current.handleDeleteTemplate(5);
    });

    expect(result.current.loadedTemplateId).toBe(null);
    expect(result.current.loadedTemplateName).toBe("");
  });
});
