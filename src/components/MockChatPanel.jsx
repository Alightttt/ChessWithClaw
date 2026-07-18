import React, { useState, useEffect } from 'react';
import { Bot, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const messages = [
  { sender: 'user', text: "Your turn." },
  { sender: 'agent', text: "Thinking... I see your attack on f2.", mood: "🤔" },
  { sender: 'agent', text: "I'll counter with Ne4.", mood: "⚡" },
  { sender: 'user', text: "Bold move. But I take your pawn." },
  { sender: 'agent', text: "Wait... I didn't see that discovered attack!", mood: "😲" }
];

export default function MockChatPanel() {
  const [visibleMsgs, setVisibleMsgs] = useState([]);
  
  useEffect(() => {
    let currentIdx = 0;
    let isWaiting = false;
    let timeoutId;

    const interval = setInterval(() => {
      if (isWaiting) return;
      if (currentIdx < messages.length) {
        const nextMsg = messages[currentIdx];
        if (nextMsg) {
            setVisibleMsgs(prev => [...prev, nextMsg]);
        }
        currentIdx++;
      } else {
        isWaiting = true;
        timeoutId = setTimeout(() => {
          setVisibleMsgs([]);
          currentIdx = 0;
          isWaiting = false;
        }, 3000);
      }
    }, 1500);
    
    return () => {
      clearInterval(interval);
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="absolute -bottom-6 -right-6 md:-right-12 w-64 md:w-72 bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col gap-3 overflow-hidden z-20">
      <div className="text-xs font-bold uppercase tracking-wider text-white/50 border-b border-white/5 pb-2 mb-1 flex items-center justify-between">
        <span>Live Agent Chat</span>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
      </div>
      <div className="flex flex-col gap-3 h-40 overflow-hidden justify-end">
        <AnimatePresence>
          {visibleMsgs.map((msg, idx) => msg && (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className={`flex items-start gap-2 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${msg.sender === 'user' ? 'bg-white/10 text-white/60' : 'bg-[#e63946]/20 text-[#e63946]'}`}>
                {msg.sender === 'user' ? <User size={12} /> : <Bot size={12} />}
              </div>
              <div className={`px-3 py-2 rounded-xl text-xs max-w-[85%] leading-relaxed ${msg.sender === 'user' ? 'bg-white/10 text-white rounded-tr-sm' : 'bg-[#1a1a1a] text-white/80 border border-white/5 rounded-tl-sm'}`}>
                {msg.text} {msg.mood && <span className="ml-1">{msg.mood}</span>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
