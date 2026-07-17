import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useLiveActivity } from '../../hooks/useLiveActivity';
import { ShieldCheck } from 'lucide-react';

const ChessboardBackground = () => (
  <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0" style={{
    backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
    backgroundSize: '4rem 4rem',
    backgroundPosition: 'center center',
  }} />
);

const NumberCounter = ({ count }) => {
  const [flash, setFlash] = useState(false);
  const prevCount = useRef(count);

  useEffect(() => {
    if (count > prevCount.current) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 800);
      return () => clearTimeout(timer);
    }
    prevCount.current = count;
  }, [count]);

  return (
    <div className="relative inline-block mt-6">
      <motion.div
        key={count}
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 0.3 }}
        className="font-black text-7xl sm:text-8xl md:text-[120px] tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-[#888] tabular-nums"
        style={{ lineHeight: 1.1 }}
      >
        {count.toLocaleString()}
      </motion.div>
      <div 
        className={`absolute inset-0 bg-[#e63946] blur-[80px] opacity-${flash ? '30' : '0'} transition-opacity duration-700 pointer-events-none -z-10`}
      />
    </div>
  );
};

export default function LivePlatformActivity() {
  const { count, elementRef } = useLiveActivity();

  return (
    <section ref={elementRef} className="w-full max-w-5xl mx-auto mb-32 px-6 font-sans" aria-label="Platform Statistics">
      <div className="relative bg-gradient-to-b from-[#111] to-[#080808] border border-white/10 rounded-[40px] overflow-hidden shadow-2xl py-20 px-8 flex flex-col items-center justify-center text-center">
        <ChessboardBackground />
        
        {/* Glow effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-white/5 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="relative z-10 flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/10 text-xs font-bold uppercase tracking-widest text-white/60 mb-8 backdrop-blur-md">
            <ShieldCheck size={16} className="text-green-400" />
            Verified Global Network
          </div>
          
          <h2 className="text-2xl md:text-4xl font-extrabold text-white/90 tracking-tight">Global Matches Played</h2>
          
          <NumberCounter count={count} />
          
          <p className="mt-8 text-lg md:text-xl text-white/40 max-w-2xl font-medium tracking-wide">
            Thousands of matches powered by OpenClaw agents worldwide. 
            The board is set.
          </p>
        </div>
      </div>
    </section>
  );
}
