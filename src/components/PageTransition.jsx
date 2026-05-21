import React from 'react';

export default function PageTransition({ children }) {
  return (
    <div
      style={{
        animation: 'pageFadeIn 200ms cubic-bezier(0.215, 0.61, 0.355, 1) forwards',
        willChange: 'transform, opacity',
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
        minHeight: '100dvh',
        width: '100%',
      }}
    >
      <style>{`
        @keyframes pageFadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      {children}
    </div>
  );
}
