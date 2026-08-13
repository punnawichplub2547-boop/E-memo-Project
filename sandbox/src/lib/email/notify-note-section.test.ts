import { describe, it, expect } from "vitest";
import {
  notifyNoteCid,
  buildNotifyNoteText,
  buildNotifyNoteHtml,
  buildNotifyNoteEmailAttachments,
} from "./notify-note-section";

const image = { id: "abc", originalName: "a.png", storedName: "u-a.png", size: 5, mimeType: "image/png" };

describe("buildNotifyNoteText", () => {
  it("labels the note in Thai and keeps the text", () => {
    const text = buildNotifyNoteText({ text: "ด่วน ขอภายในวันนี้", images: [], attachExcel: false });
    expect(text).toContain("เรื่องเพิ่มเติม");
    expect(text).toContain("ด่วน ขอภายในวันนี้");
  });

  it("returns an empty string when there is no text and no image", () => {
    expect(buildNotifyNoteText({ text: "", images: [], attachExcel: true })).toBe("");
  });

  it("mentions attached images so a plain-text reader knows they exist", () => {
    const text = buildNotifyNoteText({ text: "ดูรูป", images: [image], attachExcel: false });
    expect(text).toContain("1");
  });
});

describe("buildNotifyNoteHtml", () => {
  it("escapes user text — a note can never inject markup", () => {
    const html = buildNotifyNoteHtml({ text: "<script>alert(1)</script>", images: [], attachExcel: false }, []);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("keeps line breaks readable", () => {
    const html = buildNotifyNoteHtml({ text: "บรรทัด1\nบรรทัด2", images: [], attachExcel: false }, []);
    expect(html).toContain("<br>");
  });

  it("embeds images by cid, never by URL — Outlook blocks remote images", () => {
    const html = buildNotifyNoteHtml({ text: "ดูรูป", images: [image], attachExcel: false }, [image]);
    expect(html).toContain(`src="cid:${notifyNoteCid(image)}"`);
    expect(html).not.toContain("http://");
    expect(html).not.toContain("https://");
  });

  it("returns an empty string when there is nothing to render", () => {
    expect(buildNotifyNoteHtml({ text: "", images: [], attachExcel: true }, [])).toBe("");
  });
});

describe("buildNotifyNoteEmailAttachments", () => {
  it("attaches each image inline with a matching cid", () => {
    const attachments = buildNotifyNoteEmailAttachments([{ image, content: Buffer.from([1]) }]);
    expect(attachments).toHaveLength(1);
    expect(attachments[0].cid).toBe(notifyNoteCid(image));
    expect(attachments[0].filename).toBe("a.png");
  });
});
