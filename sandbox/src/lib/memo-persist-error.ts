// What to tell the user when POST /api/memos refuses to store a memo they just
// submitted.
//
// The optimistic dispatch has already put the memo on screen and navigated to
// /queue, so a failure that only reaches console.error is invisible: the memo
// looks sent and is not. The custom-route path makes that concrete — the server
// answers 400 naming an approver who was deactivated between picking them and
// submitting, and that name is the only thing that tells the requester what to fix.

const GENERIC_MESSAGE = "บันทึกเมโมไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";

/** The message to show, or null when there is nothing to report. */
export function memoPersistErrorMessage(status: number, body: unknown): string | null {
  if (status >= 200 && status < 300) return null;
  // 409 means the row is already there — the save effectively succeeded.
  if (status === 409) return null;
  if (typeof body === "object" && body !== null) {
    const error = (body as { error?: unknown }).error;
    if (typeof error === "string" && error.trim().length > 0) return error.trim();
  }
  return GENERIC_MESSAGE;
}
