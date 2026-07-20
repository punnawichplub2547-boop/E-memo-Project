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
  const [loadedTemplateId, setLoadedTemplateId] = useState<number | null>(null);
  const [loadedTemplateName, setLoadedTemplateName] = useState<string>("");

  const clearLoadedTemplate = () => {
    setLoadedTemplateId(null);
    setLoadedTemplateName("");
  };

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

  const handleLoadTemplate = (id: number, name: string, data: Record<string, unknown>) => {
    if (!data) return;
    setLoadedTemplateId(id);
    setLoadedTemplateName(name);
    applyBulkData(data);
    showSuccessToast("โหลดแม่แบบเรียบร้อยแล้ว");
  };

  const handleSaveTemplate = async (name: string, overwriteId?: number | null) => {
    try {
      setIsSavingTemplate(true);
      const templateData = snapshotFormData();

      const isOverwrite = typeof overwriteId === "number" && overwriteId > 0;
      const url = isOverwrite ? `/api/templates/${overwriteId}` : "/api/templates";
      const method = isOverwrite ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, template: templateData }),
      });

      if (res.ok) {
        showSuccessToast(isOverwrite ? "อัปเดตแม่แบบเรียบร้อยแล้ว" : "บันทึกแม่แบบเรียบร้อยแล้ว");
        setSaveModalOpen(false);
        if (isOverwrite) {
          setLoadedTemplateName(name);
        } else {
          const body = await res.json();
          if (body.id) {
            setLoadedTemplateId(body.id);
            setLoadedTemplateName(name);
          }
        }
        setTemplatesLoading(true);
        fetchTemplates();
      } else {
        const err = await res.json();
        showErrorToast(err.error || (isOverwrite ? "อัปเดตแม่แบบไม่สำเร็จ" : "บันทึกแม่แบบไม่สำเร็จ"));
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
        if (loadedTemplateId === id) {
          clearLoadedTemplate();
        }
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
    loadedTemplateId, loadedTemplateName, clearLoadedTemplate,
    handleLoadTemplate, handleSaveTemplate, handleDeleteTemplate,
  };
}
