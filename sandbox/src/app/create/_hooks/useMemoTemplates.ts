"use client";

import { useEffect, useState } from "react";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import type { MemoTemplate } from "@/lib/db-templates";

export interface UseMemoTemplatesInput {
  isRevisionMode: boolean;
  applyBulkData: (data: Record<string, unknown>) => void;
  snapshotFormData: () => Record<string, unknown>;
}

export function useMemoTemplates({ isRevisionMode, applyBulkData, snapshotFormData }: UseMemoTemplatesInput) {
  const [templates, setTemplates] = useState<MemoTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (e) {
      console.error("Failed to fetch templates", e);
    } finally {
      setTemplatesLoading(false);
    }
  };

  useEffect(() => {
    if (!isRevisionMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchTemplates();
    } else {
      setTemplatesLoading(false);
    }
  }, [isRevisionMode]);

  const handleLoadTemplate = (data: Record<string, unknown>) => {
    if (!data) return;
    applyBulkData(data);
    showSuccessToast("โหลดแม่แบบเรียบร้อยแล้ว");
  };

  const handleSaveTemplate = async (name: string) => {
    try {
      setIsSavingTemplate(true);
      const templateData = snapshotFormData();

      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, template: templateData }),
      });

      if (res.ok) {
        showSuccessToast("บันทึกแม่แบบเรียบร้อยแล้ว");
        setSaveModalOpen(false);
        setTemplatesLoading(true);
        fetchTemplates();
      } else {
        const err = await res.json();
        showErrorToast(err.error || "บันทึกแม่แบบไม่สำเร็จ");
      }
    } catch (e) {
      console.error("Failed to save template", e);
      showErrorToast("ระบบเกิดข้อผิดพลาดในการบันทึกแม่แบบ");
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    try {
      const res = await fetch(`/api/templates/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showSuccessToast("ลบแม่แบบเรียบร้อยแล้ว");
        setTemplatesLoading(true);
        fetchTemplates();
      } else {
        const err = await res.json();
        showErrorToast(err.error || "ลบแม่แบบไม่สำเร็จ");
      }
    } catch (e) {
      console.error("Failed to delete template", e);
      showErrorToast("ระบบเกิดข้อผิดพลาดในการลบแม่แบบ");
    }
  };

  return {
    templates, templatesLoading, saveModalOpen, setSaveModalOpen, isSavingTemplate,
    handleLoadTemplate, handleSaveTemplate, handleDeleteTemplate,
  };
}
