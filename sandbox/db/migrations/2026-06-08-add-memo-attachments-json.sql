-- Adds persisted attachment metadata for the local prototype upload slice.
-- Files are stored on disk; this JSON column stores only display metadata.

ALTER TABLE memos
  ADD COLUMN attachments_json JSON NULL AFTER read_recipients_json;
