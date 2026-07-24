import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { useLiveActivity } from '../../hooks/useLiveActivity';
import { Activity } from 'lucide-react';

const NumberCounter = ({ count }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (!isInView) return;

    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setDisplayValue(count);
      setIsFinished(true);
      return;
    }

    let startTimestamp = null;
    const duration = 2000;
    const initialValue = 0;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(Math.floor(easeProgress * (count - initialValue) + initialValue));

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayValue(count);
        setIsFinished(true);
      }
    };
    window.requestAnimationFrame(step);
  }, [count, isInView]);

  return (
    <div ref={ref} className="relative inline-block">
      {/* Radial glow flash behind the number */}
      <motion.div
        className="absolute inset-0 m-auto w-[150%] h-[150%] rounded-full pointer-events-none z-0"
        style={{
          background: 'radial-gradient(circle, rgba(230,57,70,0.5) 0%, rgba(230,57,70,0) 70%)',
        }}
        initial={{ opacity: 0 }}
        animate={isFinished ? { opacity: [0, 0.4, 0] } : { opacity: 0 }}
        transition={isFinished ? {
          duration: 0.4,
          times: [0, 0.3, 1],
          ease: "easeOut"
        } : undefined}
      />
      <motion.span
        className="relative z-10 tabular-nums drop-shadow-[0_0_40px_rgba(230,57,70,0.3)] inline-block"
        animate={isFinished ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={isFinished ? {
          duration: 0.4,
          ease: [0.34, 1.56, 0.64, 1], // spring-like with overshoot
        } : undefined}
      >
        {displayValue.toLocaleString()}
      </motion.span>
    </div>
  );
};

export default function LivePlatformActivity() {
  const { count, elementRef } = useLiveActivity();

  return (
    <section ref={elementRef} className="w-full max-w-5xl mx-auto mb-20 md:mb-32 px-4 sm:px-6 font-sans relative overflow-hidden py-16 sm:py-24 flex flex-col items-center justify-center text-center">
      {/* Ambient red blurred glow behind the number */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#e63946]/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center">
        <div className="flex items-center gap-3 mb-6 px-4 py-2 rounded-full bg-[#e63946]/10 border border-[#e63946]/20 text-[#e63946] shadow-sm backdrop-blur-sm">
          <Activity size={16} className="animate-pulse" />
          <span className="text-xs font-bold tracking-[0.2em] uppercase text-[#ff5766]">
            Global Matches Played
          </span>
        </div>

        <div
          className="font-black text-6xl sm:text-8xl md:text-[140px] tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-[#f0f0f0] to-[#b0b0b0] drop-shadow-2xl"
          style={{ lineHeight: 1, fontFamily: "'Inter', sans-serif" }}
        >
          <NumberCounter count={count} />
        </div>
      </div>
    </section>
  );
}
