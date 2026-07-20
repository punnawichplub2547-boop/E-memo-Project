import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db", () => ({ getDbPool: vi.fn() }));
import { getDbPool } from "./db";
import {
  generateDispatchNo,
  createDispatch,
  getSentDispatches,
  getReceivedDispatches,
  getDispatchDetails,
  markDispatchAsRead,
  acknowledgeDispatch,
} from "./db-dispatches";

describe("db-dispatches helpers", () => {
  let query: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    query = vi.fn();
    vi.mocked(getDbPool).mockReturnValue({ query } as never);
  });

  describe("generateDispatchNo", () => {
    it("generates next sequential number based on current year count", async () => {
      query.mockResolvedValue([[{ count: 5 }]]);
      const no = await generateDispatchNo();
      const currentYear = new Date().getFullYear();
      expect(no).toBe(`DP-${currentYear}-0006`);
      expect(query).toHaveBeenCalledTimes(1);
    });
  });

  describe("createDispatch", () => {
    it("inserts dispatch and resolves department/user targets", async () => {
      // 1. mock count query in generateDispatchNo
      // 2. mock INSERT INTO dispatches
      // 3. mock SELECT users in department
      // 4. mock INSERT INTO dispatch_recipients
      query
        .mockResolvedValueOnce([[{ count: 0 }]]) // generateDispatchNo count
        .mockResolvedValueOnce([{ insertId: 45 }]) // insert dispatches
        .mockResolvedValueOnce([[{ id: 11 }, { id: 12 }]]) // find department users
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // insert recipient 1 (user target)
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // insert recipient 2 (dept user 1)
        .mockResolvedValueOnce([{ affectedRows: 1 }]); // insert recipient 3 (dept user 2)

      const dispatchId = await createDispatch(2, {
        subject: "General Circular",
        content: "Please read.",
        recipients: [
          { type: "user", targetId: 10 },
          { type: "department", targetId: "HR&GA" },
        ],
      });

      expect(dispatchId).toBe(45);
      // Query 1: generateDispatchNo count
      // Query 2: insert dispatches
      // Query 3: find users in HR&GA department
      // Query 4, 5, 6: insert recipients
      expect(query).toHaveBeenCalledTimes(6);
    });
  });

  describe("getSentDispatches", () => {
    it("returns list of dispatches sent by user", async () => {
      const mockRows = [{ id: 45, dispatchNo: "DP-2026-0001", subject: "Test" }];
      query.mockResolvedValue([mockRows]);

      const result = await getSentDispatches(2);
      expect(result).toEqual(mockRows);
      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain("WHERE sender_user_id = ?");
      expect(params).toEqual([2]);
    });
  });

  describe("getReceivedDispatches", () => {
    it("queries active dispatches sent to the user", async () => {
      const mockRows = [{ id: 45, dispatchNo: "DP-2026-0001", readStatus: "pending" }];
      query.mockResolvedValue([mockRows]);

      const result = await getReceivedDispatches(10);
      expect(result).toEqual(mockRows);
      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain("WHERE dr.target_user_id = ?");
      expect(params).toEqual([10]);
    });
  });

  describe("getDispatchDetails", () => {
    it("returns null if dispatch not found", async () => {
      query.mockResolvedValueOnce([[]]);
      const details = await getDispatchDetails(99);
      expect(details).toBeNull();
    });

    it("returns dispatch details along with recipients list", async () => {
      const mockDispatch = { id: 45, subject: "Test Circular" };
      const mockRecipients = [{ targetUserId: 10, status: "pending" }];

      query
        .mockResolvedValueOnce([[mockDispatch]])
        .mockResolvedValueOnce([mockRecipients]);

      const details = await getDispatchDetails(45);
      expect(details).not.toBeNull();
      expect(details.subject).toBe("Test Circular");
      expect(details.recipients).toEqual(mockRecipients);
      expect(query).toHaveBeenCalledTimes(2);
    });
  });

  describe("markDispatchAsRead", () => {
    it("updates read status to read and sets read_at timestamp", async () => {
      query.mockResolvedValue([{ affectedRows: 1 }]);
      const success = await markDispatchAsRead(45, 10);
      expect(success).toBe(true);
      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain("UPDATE dispatch_recipients SET status = 'read'");
      expect(params).toEqual([45, 10]);
    });
  });

  describe("acknowledgeDispatch", () => {
    it("updates status to acknowledged with notes", async () => {
      query.mockResolvedValue([{ affectedRows: 1 }]);
      const success = await acknowledgeDispatch(45, 10, "Acknowledge notes");
      expect(success).toBe(true);
      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain("status = 'acknowledged'");
      expect(params).toEqual(["Acknowledge notes", 45, 10]);
    });
  });
});
