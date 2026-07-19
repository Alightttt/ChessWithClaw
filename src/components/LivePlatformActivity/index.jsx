import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { useLiveActivity } from '../../hooks/useLiveActivity';
import { Activity } from 'lucide-react';

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
    <section ref={elementRef} className="w-full max-w-5xl mx-auto mb-20 md:mb-32 px-4 sm:px-6 font-sans">
      <div 
        className="p-1 sm:p-[6px] rounded-[36px] overflow-hidden relative shadow-[0_0_80px_rgba(230,57,70,0.05)] hover:shadow-[0_0_120px_rgba(230,57,70,0.1)] transition-all duration-700"
      >
        {/* Checkered pattern background for the frame */}
        <div 
          className="absolute inset-0 z-0 opacity-[0.25]"
          style={{
            backgroundImage: `conic-gradient(#739552 90deg, #ebecd0 90deg 180deg, #739552 180deg 270deg, #ebecd0 270deg)`,
            backgroundSize: '16px 16px'
          }}
        />

        <div 
          className="relative z-10 rounded-[32px] overflow-hidden py-16 sm:py-24 px-4 sm:px-8 flex flex-col items-center justify-center text-center group"
          style={{
            background: 'linear-gradient(135deg, #312e2b 0%, #161512 100%)',
            boxShadow: 'inset 0 1.5px 0 rgba(230,57,70,0.5), inset 0 0 60px rgba(0,0,0,0.8), 0 20px 40px rgba(0,0,0,0.5)',
          }}
        >
          <div
            aria-hidden="true"
            className="absolute pointer-events-none select-none"
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%,-50%)',
              fontSize: 'min(90vw, 800px)',
              lineHeight: 1,
              color: '#ffffff',
              opacity: 0.05,
            }}
          >
            ♔
          </div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#e63946]/10 rounded-full blur-[140px] pointer-events-none transition-all duration-700 group-hover:bg-[#e63946]/15"></div>

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
        </div>
      </div>
    </section>
  );
}
