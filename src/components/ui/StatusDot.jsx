import React from 'react';
import { motion } from 'motion/react';

export default function StatusDot({ status = 'offline', className = '' }) {
  const configs = {
    online: {
      color: 'bg-green-500',
      ring: 'bg-green-500/30',
      animation: 'animate-[pulse_2s_ease-in-out_infinite]',
    },
    offline: {
      color: 'bg-[var(--color-text-muted)]',
      ring: 'bg-transparent',
      animation: '',
    },
    warning: {
      color: 'bg-yellow-500',
      ring: 'bg-yellow-500/30',
      animation: 'animate-[pulse_1s_ease-in-out_infinite]',
    },
    thinking: {
      color: 'bg-yellow-500',
      ring: 'bg-yellow-500/30',
      animation: 'animate-[pulse_1s_ease-in-out_infinite]',
    },
    waiting: {
      color: 'bg-blue-500',
      ring: 'bg-blue-500/30',
      animation: 'animate-[pulse_3s_ease-in-out_infinite]',
    },
    error: {
      color: 'bg-[var(--color-red-primary)]',
      ring: 'bg-[var(--color-red-primary)]/30',
      animation: 'animate-[pulse_1s_ease-in-out_infinite]',
    }
  };

  const config = configs[status] || configs.offline;

  return (
    <motion.div 
      initial={{ scale: 0 }}
      animate={{ scale: [1.2, 1] }}
      transition={{ type: "spring", stiffness: 300, damping: 15 }}
      key={status}
      className={`relative flex items-center justify-center w-3 h-3 ${className}`}
    >
      {config.animation && (
        <div className={`absolute w-full h-full rounded-full ${config.ring} ${config.animation}`}></div>
      )}
      <div className={`relative w-1.5 h-1.5 rounded-full ${config.color} z-10`}></div>
    </motion.div>
  );
}
