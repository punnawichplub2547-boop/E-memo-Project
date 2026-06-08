import type React from "react";
import { IconPaperclip, IconUpload } from "@/components/icons";
import { formatAttachmentSize, isAllowedAttachmentFile, MAX_ATTACHMENT_BYTES } from "@/lib/attachments";
import { AttachItem } from "./AttachItem";

export function AttachmentsCard({
  files,
  error,
  onFilesAdded,
  onRemoveFile,
}: {
  files: File[];
  error: string | null;
  onFilesAdded: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
}) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFilesAdded(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  return (
    <div className="em-card">
      <div className="em-card-head" style={{ padding: "14px 18px" }}>
        <div>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 26, height: 26, borderRadius: 7, background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center" }}>
              <IconPaperclip size={14} />
            </span>
            เอกสารแนบ / Attachments
          </h3>
          <div className="em-sub" style={{ marginTop: 2 }}>
            <span style={{ fontSize: 10, color: "var(--primary)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Local prototype storage
            </span>
          </div>
        </div>
      </div>
      <div className="em-card-body" style={{ padding: "10px 18px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        <label className="em-upload" style={{ cursor: "pointer" }}>
          <div className="em-upload-ico"><IconUpload size={18} /></div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>Click to select attachment files</span>
            <span style={{ fontSize: 11.5 }}>PDF, DOC/DOCX, XLS/XLSX, PNG/JPG · max 10 MB each</span>
          </div>
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg"
            style={{ display: "none" }}
            onChange={handleChange}
          />
        </label>
        {error && <div style={{ fontSize: 11.5, color: "var(--rose)", fontWeight: 600 }}>{error}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {files.map((file, index) => {
            const isAllowed = isAllowedAttachmentFile(file.name, file.type) && file.size <= MAX_ATTACHMENT_BYTES;
            return (
              <AttachItem
                key={`${file.name}-${file.size}-${index}`}
                name={file.name}
                size={`${formatAttachmentSize(file.size)}${isAllowed ? "" : " · not allowed"}`}
                onRemove={() => onRemoveFile(index)}
              />
            );
          })}
          {files.length === 0 && (
            <div style={{ fontSize: 11.5, color: "var(--muted)", fontStyle: "italic" }}>
              No files selected.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
