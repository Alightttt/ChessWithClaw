import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-red-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Scattered pieces */}
      <span className="absolute top-[10%] left-[10%] text-6xl text-white/5 -rotate-12 pointer-events-none select-none">♟</span>
      <span className="absolute top-[20%] right-[15%] text-7xl text-white/5 rotate-12 pointer-events-none select-none">♜</span>
      <span className="absolute bottom-[20%] left-[15%] text-5xl text-white/5 -rotate-6 pointer-events-none select-none">♝</span>
      <span className="absolute bottom-[10%] right-[10%] text-8xl text-white/5 rotate-6 pointer-events-none select-none">♞</span>

      <div className="relative z-10 glass-card p-12 max-w-md w-full border-white/5 bg-black/50 backdrop-blur-xl">
        <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-red-950 mb-2">404</h1>
        <div className="text-4xl text-neutral-800 mb-6 font-serif">♚</div>
        
        <h2 className="text-2xl font-bold tracking-tight mb-2">Game Not Found</h2>
        <p className="text-neutral-400 text-sm mb-8">This reality doesn&apos;t exist, or the match has been abandoned to the void.</p>
        
        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-all active:scale-95"
          >
            <ArrowLeft size={16} /> Return to Home
          </button>
        </div>
      </div>
    </div>
  );
}
