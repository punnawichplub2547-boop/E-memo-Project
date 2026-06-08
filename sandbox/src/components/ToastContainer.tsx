"use client";

import { useEffect, useState } from "react";
import type { Toast } from "@/lib/toast";
import { subscribe, dismissToast } from "@/lib/toast";
import { IconX } from "./icons";

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubscribe = subscribe(setToasts);
    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 400,
      }}
    >
      {toasts.map((toast) => {
        const bgColor = {
          error: "rgba(220, 38, 38, 0.95)",
          success: "rgba(34, 197, 94, 0.95)",
          warning: "rgba(251, 146, 60, 0.95)",
          info: "rgba(59, 130, 246, 0.95)",
        }[toast.type];

        const textColor = {
          error: "#fecaca",
          success: "#bbf7d0",
          warning: "#fed7aa",
          info: "#bfdbfe",
        }[toast.type];

        return (
          <div
            key={toast.id}
            style={{
              background: bgColor,
              color: textColor,
              padding: "12px 16px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 14,
              fontWeight: 500,
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
              animation: "slideIn 0.3s ease-out",
            }}
          >
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              style={{
                background: "none",
                border: "none",
                color: "inherit",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
              }}
              aria-label="Dismiss toast"
            >
              <IconX size={16} />
            </button>
          </div>
        );
      })}

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
