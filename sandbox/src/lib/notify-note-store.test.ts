import { describe, it, expect, vi, beforeEach } from "vitest";

const readFile = vi.fn();
vi.mock("node:fs/promises", () => ({ readFile: (...a: unknown[]) => readFile(...a) }));

import { loadNotifyNote, readNotifyNoteImageBuffers } from "./notify-note-store";

function poolReturning(rows: unknown[]) {
  return { query: vi.fn(async () => [rows, []]) } as never;
}

beforeEach(() => vi.clearAllMocks());

describe("loadNotifyNote", () => {
  it("returns null when the memo row is missing", async () => {
    expect(await loadNotifyNote(poolReturning([]), 1)).toBeNull();
  });

  it("returns null when every field is empty — nothing to send", async () => {
    const note = await loadNotifyNote(
      poolReturning([{ notify_note: null, notify_note_images_json: null, notify_attach_excel: 0 }]),
      1,
    );
    expect(note).toBeNull();
  });

  it("reads text, images and the Excel flag", async () => {
    const note = await loadNotifyNote(
      poolReturning([{
        notify_note: "ด่วน ขอภายในวันนี้",
        notify_note_images_json: JSON.stringify([
          { id: "1", originalName: "a.png", storedName: "u-a.png", size: 5, mimeType: "image/png" },
        ]),
        notify_attach_excel: 1,
      }]),
      1,
    );
    expect(note).toEqual({
      text: "ด่วน ขอภายในวันนี้",
      images: [{ id: "1", originalName: "a.png", storedName: "u-a.png", size: 5, mimeType: "image/png" }],
      attachExcel: true,
    });
  });

  it("accepts an already-parsed JSON column (mysql2 returns objects for JSON)", async () => {
    const note = await loadNotifyNote(
      poolReturning([{
        notify_note: null,
        notify_note_images_json: [{ id: "1", originalName: "a.png", storedName: "u-a.png", size: 5, mimeType: "image/png" }],
        notify_attach_excel: 0,
      }]),
      1,
    );
    expect(note?.images).toHaveLength(1);
  });

  it("survives a legacy database that predates the columns", async () => {
    const pool = { query: vi.fn(async () => { throw Object.assign(new Error("Unknown column"), { code: "ER_BAD_FIELD_ERROR" }); }) } as never;
    expect(await loadNotifyNote(pool, 1)).toBeNull();
  });
});

describe("readNotifyNoteImageBuffers", () => {
  const image = { id: "1", originalName: "a.png", storedName: "u-a.png", size: 5, mimeType: "image/png" };

  it("reads each image from the memo's notify-notes folder", async () => {
    readFile.mockResolvedValue(Buffer.from([1, 2, 3]));
    const result = await readNotifyNoteImageBuffers("EM-2026-2026-0001", [image]);
    expect(result).toHaveLength(1);
    expect(result[0].content).toEqual(Buffer.from([1, 2, 3]));
    expect(String(readFile.mock.calls[0][0])).toContain("notify-notes");
  });

  it("skips an unreadable file instead of sinking the whole notification", async () => {
    readFile.mockRejectedValue(new Error("ENOENT"));
    expect(await readNotifyNoteImageBuffers("EM-2026-2026-0001", [image])).toEqual([]);
  });

  it("skips a storedName that tries to escape the folder", async () => {
    readFile.mockResolvedValue(Buffer.from([1]));
    const evil = { ...image, storedName: "../../../etc/passwd" };
    expect(await readNotifyNoteImageBuffers("EM-2026-2026-0001", [evil])).toEqual([]);
    expect(readFile).not.toHaveBeenCalled();
  });
});
