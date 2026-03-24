import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, typeOrOptions, duration = 3500) => {
    const id = Date.now() + Math.random();
    
    let type = 'info';
    let dur = duration;
    let icon = null;
    let style = null;

    if (typeof typeOrOptions === 'string') {
      type = typeOrOptions;
    } else if (typeOrOptions && typeof typeOrOptions === 'object') {
      type = typeOrOptions.type || 'info';
      dur = typeOrOptions.duration || duration;
      icon = typeOrOptions.icon;
      style = typeOrOptions.style;
    }

    setToasts((prev) => {
      const next = [{ id, message, type, duration: dur, icon, style }, ...prev];
      return next.slice(0, 3); // max 3 visible
    });
    setTimeout(() => removeToast(id), dur);
  }, [removeToast]);

  const toast = Object.assign(
    (msg, options = {}) => {
      addToast(msg, options);
    },
    {
      success: (msg, dur) => addToast(msg, 'success', dur),
      error: (msg, dur) => addToast(msg, 'error', dur),
      info: (msg, dur) => addToast(msg, 'info', dur),
      warning: (msg, dur) => addToast(msg, 'warning', dur),
    }
  );

  const contextValue = {
    toast,
    toasts,
    removeToast
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

function ToastContainer({ toasts, removeToast }) {
  if (typeof window === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        bottom: '68px',
        right: '14px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: '8px',
        pointerEvents: 'none',
        maxWidth: 'calc(100vw - 28px)',
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} removeToast={removeToast} />
      ))}
    </div>,
    document.body
  );
}

function ToastItem({ toast, removeToast }) {
  const [isExiting, setIsExiting] = useState(false);

  const typeColors = {
    success: '#22c55e',
    error: '#e63946',
    warning: '#f59e0b',
    info: '#3b82f6',
  };

  const icons = {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ',
  };

  const color = typeColors[toast.type] || typeColors.info;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
    }, toast.duration - 160); // Start exit animation 160ms before removal

    return () => clearTimeout(timer);
  }, [toast.duration]);

  return (
    <div
      className={isExiting ? 'toast-exit' : 'toast-enter'}
      style={{
        pointerEvents: 'auto',
        background: '#111111',
        border: '1px solid #1e1e1e',
        borderLeft: `3px solid ${color}`,
        borderRadius: '10px',
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '9px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.75), 0 0 0 1px #1a1a1a',
        position: 'relative',
        overflow: 'hidden',
        willChange: 'transform, opacity',
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
        transform: 'translateZ(0)',
        ...(toast.style || {})
      }}
    >
      <style>
        {`
          .toast-enter {
            animation: toastEnter 220ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          }
          .toast-exit {
            animation: toastExit 160ms ease-in forwards;
          }
          @keyframes toastEnter {
            from { transform: translateX(110%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          @keyframes toastExit {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(110%); opacity: 0; }
          }
          @keyframes shrinkBar {
            from { width: 100%; }
            to { width: 0%; }
          }
        `}
      </style>
      <div
        style={{
          fontSize: '14px',
          color: color,
          flexShrink: 0,
          fontWeight: 700,
        }}
      >
        {toast.icon || icons[toast.type] || icons.info}
      </div>
      <div
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '13px',
          color: '#ccc',
          flex: 1,
          lineHeight: 1.35,
        }}
      >
        {toast.message}
      </div>
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => removeToast(toast.id), 160);
        }}
        style={{
          background: 'none',
          border: 'none',
          color: '#2a2a2a',
          fontSize: '14px',
          cursor: 'pointer',
          padding: '2px 4px',
          borderRadius: '4px',
          flexShrink: 0,
          transition: 'color 120ms ease',
          touchAction: 'manipulation',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#666')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#2a2a2a')}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        ✕
      </button>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '2px',
          background: color,
          opacity: 0.35,
          borderRadius: '0 0 10px 10px',
          animation: `shrinkBar ${toast.duration}ms linear forwards`,
        }}
      />
    </div>
  );
}
