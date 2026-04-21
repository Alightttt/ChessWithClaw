import React, { useEffect, useState } from 'react';
import { useToast } from '../Toast';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const Toast = ({ toast, onRemove }) => {
  const [progress, setProgress] = useState(100);
  const duration = toast.type === 'success' || toast.type === 'info' ? 4000 : 6000;

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (elapsed >= duration) {
        onRemove(toast.id);
        clearInterval(interval);
      }
    }, 10);
    return () => clearInterval(interval);
  }, [duration, onRemove, toast.id]);

  const icons = {
    success: <CheckCircle className="text-[var(--color-success)]" size={20} />,
    error: <AlertCircle className="text-[var(--color-danger)]" size={20} />,
    info: <Info className="text-[var(--color-info)]" size={20} />,
    warning: <AlertTriangle className="text-[var(--color-warning)]" size={20} />
  };

  const bgColors = {
    success: 'bg-[var(--color-success)]',
    error: 'bg-[var(--color-danger)]',
    info: 'bg-[var(--color-info)]',
    warning: 'bg-[var(--color-warning)]'
  };

  return (
    <div className="relative overflow-hidden bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] shadow-lg rounded-lg p-4 mb-3 w-80 pointer-events-auto animate-in slide-in-from-top-5 md:slide-in-from-right-5 fade-in duration-300">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">{icons[toast.type]}</div>
        <div className="flex-1 min-w-0">
          {toast.title && <h4 className="text-sm font-bold text-[var(--color-text-primary)]">{toast.title}</h4>}
          <p className="text-sm text-[var(--color-text-secondary)]">{toast.message}</p>
        </div>
        <button onClick={() => onRemove(toast.id)} className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
          <X size={16} />
        </button>
      </div>
      <div className="absolute bottom-0 left-0 h-1 bg-[var(--color-bg-hover)] w-full">
        <div 
          className={`h-full ${bgColors[toast.type]} transition-all duration-75 ease-linear`} 
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default function ToastManager() {
  const { toasts, removeToast } = useToast();
  const visibleToasts = toasts.slice(-3);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 md:top-auto md:left-auto md:bottom-4 md:right-4 md:translate-x-0 z-50 flex flex-col pointer-events-none">
      {visibleToasts.map(toast => (
        <Toast key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
}
