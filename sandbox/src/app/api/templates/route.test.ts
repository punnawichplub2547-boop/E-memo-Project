import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getActiveSessionUserFromToken: vi.fn(),
  COOKIE_NAME: "em-session",
}));
vi.mock("@/lib/db-templates", () => ({
  createTemplate: vi.fn(),
  getTemplatesByUserId: vi.fn(),
  deleteTemplate: vi.fn(),
}));

import { GET, POST } from "./route";
import { DELETE } from "./[id]/route";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { createTemplate, getTemplatesByUserId, deleteTemplate } from "@/lib/db-templates";
import type { MemoTemplate } from "@/lib/db-templates";

const USER = { userId: 1, firstName: "Test", lastName: "User", roles: ["requester"] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(USER as never);
});

describe("Templates API Routes", () => {
  describe("GET /api/templates", () => {
    it("returns 401 when no session", async () => {
      vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(null);
      const req = new NextRequest("http://localhost/api/templates");
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it("returns templates list for valid session", async () => {
      const mockTemplates: MemoTemplate[] = [{
        id: 10,
        userId: 1,
        name: "Test Tpl",
        templateJson: "{}",
        createdAt: "2026-07-13T00:00:00.000Z",
        updatedAt: "2026-07-13T00:00:00.000Z",
      }];
      vi.mocked(getTemplatesByUserId).mockResolvedValue(mockTemplates);

      const req = new NextRequest("http://localhost/api/templates");
      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.templates).toEqual(mockTemplates);
      expect(getTemplatesByUserId).toHaveBeenCalledWith(1);
    });
  });

  describe("POST /api/templates", () => {
    it("returns 401 when no session", async () => {
      vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(null);
      const req = new NextRequest("http://localhost/api/templates", {
        method: "POST",
        body: JSON.stringify({ name: "Tpl", template: {} }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("returns 400 when name is missing", async () => {
      const req = new NextRequest("http://localhost/api/templates", {
        method: "POST",
        body: JSON.stringify({ template: {} }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("name is required");
    });

    it("returns 400 when template is missing", async () => {
      const req = new NextRequest("http://localhost/api/templates", {
        method: "POST",
        body: JSON.stringify({ name: "Tpl" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Template data is required");
    });

    it("creates template successfully", async () => {
      vi.mocked(createTemplate).mockResolvedValue(202);
      const req = new NextRequest("http://localhost/api/templates", {
        method: "POST",
        body: JSON.stringify({ name: "My Template", template: { title: "Hello" } }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.id).toBe(202);
      expect(createTemplate).toHaveBeenCalledWith(1, "My Template", { title: "Hello" });
    });
  });

  describe("DELETE /api/templates/[id]", () => {
    const ctx = { params: Promise.resolve({ id: "202" }) };

    it("returns 401 when no session", async () => {
      vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(null);
      const req = new NextRequest("http://localhost/api/templates/202", { method: "DELETE" });
      const res = await DELETE(req, ctx);
      expect(res.status).toBe(401);
    });

    it("returns 400 when ID is invalid", async () => {
      const req = new NextRequest("http://localhost/api/templates/abc", { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ id: "abc" }) });
      expect(res.status).toBe(400);
    });

    it("deletes owned template successfully", async () => {
      vi.mocked(deleteTemplate).mockResolvedValue(true);
      const req = new NextRequest("http://localhost/api/templates/202", { method: "DELETE" });
      const res = await DELETE(req, ctx);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(deleteTemplate).toHaveBeenCalledWith(202, 1);
    });

    it("returns 404 when template not owned or not found", async () => {
      vi.mocked(deleteTemplate).mockResolvedValue(false);
      const req = new NextRequest("http://localhost/api/templates/202", { method: "DELETE" });
      const res = await DELETE(req, ctx);
      expect(res.status).toBe(404);
    });
  });
});
