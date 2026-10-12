'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
}

function Toast({ message, type = 'info', onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />,
    error: <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />,
    info: <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />,
  };

  return (
    <div className="flex items-start gap-2.5 py-2.5 px-3.5 rounded-lg border border-border bg-card text-foreground shadow-lg text-xs transition-all">
      {icons[type]}
      <p className="flex-1 text-foreground leading-snug">{message}</p>
      <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

let toastCount = 0;
let setToastsGlobal: React.Dispatch<React.SetStateAction<ToastItem[]>> | null = null;

export function addToast(message: string, type: ToastItem['type'] = 'info') {
  if (setToastsGlobal) {
    const id = ++toastCount;
    setToastsGlobal((prev) => [...prev, { id, message, type }]);
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  setToastsGlobal = setToasts;

  const remove = (id: number) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <Toast message={t.message} type={t.type} onClose={() => remove(t.id)} />
        </div>
      ))}
    </div>
  );
}
