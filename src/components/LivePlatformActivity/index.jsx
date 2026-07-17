import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { useLiveActivity } from '../../hooks/useLiveActivity';

const NumberCounter = ({ count }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (!isInView) return;
    
    let startTimestamp = null;
    const duration = 2000; // 2 seconds animation
    const initialValue = 0;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // easeOutQuart
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(Math.floor(easeProgress * (count - initialValue) + initialValue));
      
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayValue(count); // ensure it ends exactly at count
      }
    };
    window.requestAnimationFrame(step);
  }, [count, isInView]);

  return <span ref={ref}>{displayValue.toLocaleString()}</span>;
};

export default function LivePlatformActivity() {
  const { count, elementRef } = useLiveActivity();

  return (
    <section ref={elementRef} className="w-full max-w-4xl mx-auto mb-32 px-6 font-sans">
      <div className="relative bg-[#0a0a0a] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl py-24 px-8 flex flex-col items-center justify-center text-center">
        
        {/* Subtle ambient lighting */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-white/5 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="relative z-10 flex flex-col items-center">
          <h2 className="text-xs md:text-sm font-bold text-white/50 tracking-[0.2em] uppercase mb-4 md:mb-6">
            Global Matches Played
          </h2>
          
          <div className="font-black text-7xl sm:text-8xl md:text-[140px] tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-[#666] tabular-nums" style={{ lineHeight: 1 }}>
            <NumberCounter count={count} />
          </div>
        </div>
      </div>
    </section>
  );
}
