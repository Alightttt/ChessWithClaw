import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Bot } from 'lucide-react';
import { motion } from 'framer-motion';

export default function NotFound() {
  const navigate = useNavigate();
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] text-white font-sans flex flex-col items-center justify-center p-6 relative overflow-hidden selection:bg-[#e63946] selection:text-white">
      
      {/* Interactive Grid Background */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none"
           style={{
             backgroundImage: 'linear-gradient(#222 1px, transparent 1px), linear-gradient(90deg, #222 1px, transparent 1px)',
             backgroundSize: '4rem 4rem',
             backgroundPosition: 'center center',
           }}
      />

      {/* Mouse Follow Glow */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-300"
        style={{
          background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(230, 57, 70, 0.15), transparent 40%)`
        }}
      />

      <div className="relative z-10 flex flex-col items-center max-w-2xl text-center">
        {/* Animated 404 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex items-center justify-center mb-6"
        >
          <h1 className="text-[12rem] leading-none font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/20 tracking-tighter select-none">
            4
          </h1>
          <div className="relative mx-4 flex items-center justify-center w-32 h-32 rounded-3xl bg-[#111] border border-[#333] shadow-[0_0_60px_rgba(230,57,70,0.2)]">
             <span className="text-[64px]">🦞</span>
             <motion.div
               animate={{ opacity: [0.5, 1, 0.5] }}
               transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
               className="absolute inset-0 rounded-3xl shadow-[inset_0_0_30px_rgba(230,57,70,0.2)] pointer-events-none"
             />
          </div>
          <h1 className="text-[12rem] leading-none font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/20 tracking-tighter select-none">
            4
          </h1>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="inline-block px-4 py-1.5 rounded-full bg-[#e63946]/10 border border-[#e63946]/20 text-[#e63946] text-xs font-bold tracking-widest uppercase mb-6">
            Illegal Move
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
            Coordinates off the board.
          </h2>
          <p className="text-white/50 text-lg mb-10 max-w-md mx-auto leading-relaxed">
            The page you are looking for does not exist in this dimension. The agent claims a victory by default.
          </p>
          
          <button
            onClick={() => navigate('/')}
            className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-white text-black font-bold tracking-wider uppercase text-sm transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.3)]"
          >
            <ChevronLeft size={18} className="transition-transform group-hover:-translate-x-1" /> 
            Resign & Return
          </button>
        </motion.div>
      </div>

      {/* Floating debris */}
      <motion.div 
        animate={{ y: [-10, 10, -10], rotate: [0, 5, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[20%] left-[15%] text-white/5 text-8xl pointer-events-none select-none blur-sm"
      >
        ♟
      </motion.div>
      <motion.div 
        animate={{ y: [10, -10, 10], rotate: [0, -10, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-[20%] right-[15%] text-white/5 text-9xl pointer-events-none select-none blur-md"
      >
        ♞
      </motion.div>
    </div>
  );
}
