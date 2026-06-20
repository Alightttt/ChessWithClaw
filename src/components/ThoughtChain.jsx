import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export default function ThoughtChain({ thoughts, agentName }) {
  const [history, setHistory] = useState([]);
  const lastThoughtRef = useRef(null);

  useEffect(() => {
    if (!thoughts || !thoughts.length) return;
    const latest = thoughts[thoughts.length - 1];
    if (!latest || latest === lastThoughtRef.current) return;
    lastThoughtRef.current = latest;
    setHistory(prev => [...prev.slice(-2), latest]);
  }, [thoughts]);

  useEffect(() => {
    if (!history.length) return;
    const timer = setTimeout(() => setHistory([]), 5000);
    return () => clearTimeout(timer);
  }, [history]);

  if (!history.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0' }}>
      <AnimatePresence initial={false}>
        {history.map((thought, i) => {
          const isActive = i === history.length - 1;
          return (
            <motion.div
              key={`${thought}-${i}`}
              initial={{ opacity: 0, x: -8, height: 0 }}
              animate={{
                opacity: isActive ? 1 : 0.35,
                x: 0,
                height: 'auto',
                scale: isActive ? 1 : 0.97,
              }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                paddingLeft: 10,
                borderLeft: isActive ? '2px solid #e63946' : '2px solid rgba(255,255,255,0.08)',
              }}
            >
              <span style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#f2f2f2' : 'rgba(242,242,242,0.45)',
                lineHeight: 1.4,
              }}>
                {thought}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
