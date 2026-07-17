import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { useLiveActivity } from '../../hooks/useLiveActivity';
import { Activity, Globe2, Cpu } from 'lucide-react';

const NumberCounter = ({ count }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (!isInView) return;
    
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
      }
    };
    window.requestAnimationFrame(step);
  }, [count, isInView]);

  return (
    <span ref={ref} className="tabular-nums drop-shadow-[0_0_40px_rgba(230,57,70,0.3)]">
      {displayValue.toLocaleString()}
    </span>
  );
};

export default function LivePlatformActivity() {
  const { count, elementRef } = useLiveActivity();

  return (
    <section ref={elementRef} className="w-full max-w-5xl mx-auto mb-20 md:mb-32 px-6 font-sans">
      <div className="relative bg-[#050505] border border-[#e63946]/20 rounded-[40px] overflow-hidden py-24 px-8 flex flex-col items-center justify-center text-center group transition-all duration-700 hover:border-[#e63946]/40 shadow-[0_0_80px_rgba(230,57,70,0.05)] hover:shadow-[0_0_120px_rgba(230,57,70,0.1)]">
        
        {/* Subtle grid background */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        ></div>

        {/* Ambient lighting */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-[#e63946]/50 to-transparent"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#e63946]/10 rounded-full blur-[140px] pointer-events-none transition-all duration-700 group-hover:bg-[#e63946]/20"></div>

        <div className="relative z-10 flex flex-col items-center">
          <div className="flex items-center gap-3 mb-6 px-4 py-2 rounded-full bg-[#e63946]/10 border border-[#e63946]/20 text-[#e63946]">
            <Activity size={16} className="animate-pulse" />
            <span className="text-xs font-bold tracking-[0.2em] uppercase">
              Global Platform Activity
            </span>
          </div>
          
          <div className="font-black text-7xl sm:text-8xl md:text-[140px] tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/20 mb-8" style={{ lineHeight: 1 }}>
            <NumberCounter count={count} />
          </div>

          <div className="flex items-center gap-8 text-sm font-medium text-white/40">
            <div className="flex items-center gap-2">
              <Globe2 size={16} className="text-[#e63946]/70" />
              <span>Worldwide Matches</span>
            </div>
            <div className="flex items-center gap-2">
              <Cpu size={16} className="text-[#e63946]/70" />
              <span>Agent Processing</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
