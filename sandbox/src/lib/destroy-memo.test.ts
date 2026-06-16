import { describe, expect, it, vi } from "vitest";
import { deleteMemoCascadeRows } from "./destroy-memo";

describe("deleteMemoCascadeRows", () => {
  it("deletes notification and telegram child rows before deleting the memo", async () => {
    const execute = vi.fn().mockResolvedValue([[], undefined]);

    await deleteMemoCascadeRows({ execute }, 42);

    expect(execute.mock.calls.map(([sql, params]) => [sql, params])).toEqual([
      ["DELETE nd FROM notification_deliveries nd INNER JOIN notifications n ON n.id = nd.notification_id WHERE n.memo_id = ?", [42]],
      ["DELETE FROM telegram_action_tokens WHERE memo_id = ?", [42]],
      ["DELETE FROM notifications WHERE memo_id = ?", [42]],
      ["DELETE FROM read_actions WHERE memo_id = ?", [42]],
      ["DELETE FROM workflow_step_actions WHERE memo_id = ?", [42]],
      ["DELETE FROM memo_revisions WHERE memo_id = ?", [42]],
      ["DELETE FROM memos WHERE id = ?", [42]],
    ]);
  });
});
