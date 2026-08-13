import { describe, it, expect, vi, beforeEach } from "vitest";

const writeFile = vi.fn(async () => undefined);
const mkdir = vi.fn(async () => undefined);
vi.mock("node:fs/promises", () => ({ writeFile: (...a: unknown[]) => writeFile(...a), mkdir: (...a: unknown[]) => mkdir(...a) }));

const getSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  COOKIE_NAME: "em-session",
  getActiveSessionUserFromToken: (...a: unknown[]) => getSession(...a),
}));

import { POST } from "./route";

function request(files: File[], memoId = "EM-2026-2026-0001") {
  const form = new FormData();
  form.append("memoId", memoId);
  for (const file of files) form.append("files", file);
  return {
    cookies: { get: () => ({ value: "token" }) },
    formData: async () => form,
  } as unknown as Parameters<typeof POST>[0];
}

const png = (name: string, size = 10) =>
  new File([new Uint8Array(size)], name, { type: "image/png" });

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ userId: 1, firstName: "ป", lastName: "ภ", roles: ["requester"] });
});

describe("POST /api/notify-note-images", () => {
  it("rejects an unauthenticated request before touching the disk", async () => {
    getSession.mockResolvedValue(null);
    const response = await POST(request([png("a.png")]));
    expect(response.status).toBe(401);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("stores the images and returns their metadata", async () => {
    const response = await POST(request([png("รูป ประกอบ.png")]));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.images).toHaveLength(1);
    expect(body.images[0].originalName).toBe("รูป-ประกอบ.png");
    expect(body.images[0].storedName).toContain("รูป-ประกอบ.png");
    expect(body.images[0].mimeType).toBe("image/png");
    expect(writeFile).toHaveBeenCalledTimes(1);
  });

  it("writes under storage/notify-notes, never the attachments folder", async () => {
    await POST(request([png("a.png")]));
    const target = String(writeFile.mock.calls[0][0]);
    expect(target).toContain("notify-notes");
    expect(target).not.toContain("attachments");
  });

  it("refuses a fourth image and writes nothing", async () => {
    const response = await POST(request([png("a.png"), png("b.png"), png("c.png"), png("d.png")]));
    expect(response.status).toBe(400);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("refuses a pdf", async () => {
    const pdf = new File([new Uint8Array(4)], "q.pdf", { type: "application/pdf" });
    const response = await POST(request([pdf]));
    expect(response.status).toBe(400);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("refuses a memoId that tries to escape the storage folder", async () => {
    const response = await POST(request([png("a.png")], "../../etc"));
    expect(response.status).toBe(400);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("returns empty images array when no files are uploaded", async () => {
    const response = await POST(request([]));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.images).toEqual([]);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("infers JPEG MIME type from .jpg extension when browser omits type", async () => {
    const jpegNoType = new File([new Uint8Array(10)], "photo.jpg", { type: "" });
    const response = await POST(request([jpegNoType]));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.images[0].mimeType).toBe("image/jpeg");
  });
});
