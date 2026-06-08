/**
 * Toast notification system for displaying temporary messages
 * Supports different toast types (error, success, info, warning)
 */

export type ToastType = 'error' | 'success' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number; // milliseconds, 0 = no auto-dismiss
}

// Global toast store (simple implementation)
let toasts: Toast[] = [];
let listeners: Array<(toasts: Toast[]) => void> = [];

export function subscribe(listener: (toasts: Toast[]) => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

export function showToast(message: string, type: ToastType = 'info', duration: number = 5000) {
  const id = `${Date.now()}-${Math.random()}`;
  const toast: Toast = { id, type, message, duration };
  
  toasts = [...toasts, toast];
  notifyListeners();

  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration);
  }

  return id;
}

export function dismissToast(id: string) {
  toasts = toasts.filter(t => t.id !== id);
  notifyListeners();
}

export function dismissAllToasts() {
  toasts = [];
  notifyListeners();
}

function notifyListeners() {
  listeners.forEach(listener => listener([...toasts]));
}

export function showErrorToast(message: string, duration: number = 5000) {
  return showToast(message, 'error', duration);
}

export function showSuccessToast(message: string, duration: number = 3000) {
  return showToast(message, 'success', duration);
}

export function showWarningToast(message: string, duration: number = 5000) {
  return showToast(message, 'warning', duration);
}

export function showInfoToast(message: string, duration: number = 3000) {
  return showToast(message, 'info', duration);
}
