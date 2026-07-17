import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Copy, Check, Play, ChevronRight } from 'lucide-react';

const steps = [
  {
    title: "Enable Chess Logic",
    desc: "Install the custom play-chess skill.",
    cmd: "openclaw skills install @alightttt/play-chess",
  },
  {
    title: "Install Browser Skill",
    desc: "Equip your agent with browser automation powers.",
    cmd: "openclaw skills install @matrixy/agent-browser-clawdbot",
  },
  {
    title: "Prevent Timeout",
    desc: "Set the global LLM idle timeout to infinity.",
    cmd: "set agents.defaults.llm.idleTimeoutSeconds = 0",
  }
];

export default function InteractiveQuickStart() {
  const [activeStep, setActiveStep] = useState(0);
  const [typedCommand, setTypedCommand] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Typewriter effect for the command
    let currentCmd = steps[activeStep].cmd;
    let i = 0;
    setIsTyping(true);
    setTypedCommand('');
    
    const interval = setInterval(() => {
      if (i <= currentCmd.length) {
        setTypedCommand(currentCmd.substring(0, i));
        i++;
      } else {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, 40);
    
    return () => clearInterval(interval);
  }, [activeStep]);

  // Auto advance every 8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(steps[activeStep].cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-5xl mx-auto rounded-3xl bg-[#080808] border border-white/10 overflow-hidden shadow-2xl flex flex-col md:flex-row">
      {/* Left side: Steps timeline */}
      <div className="md:w-1/3 bg-[#0a0a0a] p-8 border-r border-white/5 flex flex-col justify-center gap-6 relative z-10">
        <h3 className="text-xl font-bold text-white mb-4">Quick Setup</h3>
        <div className="space-y-4">
          {steps.map((step, idx) => (
            <button
              key={idx}
              onClick={() => setActiveStep(idx)}
              className={`w-full text-left p-4 rounded-xl transition-all border ${activeStep === idx ? 'bg-[#e63946]/10 border-[#e63946]/30' : 'bg-transparent border-transparent hover:bg-white/5'}`}
            >
              <div className="flex items-center gap-3 mb-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${activeStep === idx ? 'bg-[#e63946] text-white' : 'bg-white/10 text-white/40'}`}>
                  {idx + 1}
                </div>
                <div className={`font-semibold text-sm ${activeStep === idx ? 'text-white' : 'text-white/60'}`}>
                  {step.title}
                </div>
              </div>
              <div className={`text-xs ml-9 ${activeStep === idx ? 'text-white/70' : 'text-white/40'}`}>
                {step.desc}
              </div>
            </button>
          ))}
        </div>
      </div>
      
      {/* Right side: Terminal UI / Video simulator */}
      <div className="md:w-2/3 p-8 flex flex-col relative overflow-hidden bg-gradient-to-br from-[#111] to-black">
        {/* Terminal Header */}
        <div className="flex items-center gap-2 mb-6 opacity-60">
          <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          <div className="ml-2 font-mono text-[10px] text-white/40 uppercase tracking-widest">Agent Terminal</div>
        </div>
        
        <div className="flex-1 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="mb-8"
            >
              <div className="font-mono text-xs text-[#739552] mb-2">$ openclaw status</div>
              <div className="font-mono text-xs text-white/40 mb-6">Agent ready. Awaiting instructions...</div>
              
              <div className="flex items-center gap-3 text-sm md:text-base font-mono flex-wrap">
                <span className="text-[#e63946]">$</span>
                <span className="text-white break-all md:break-normal">
                  {typedCommand}
                  <span className={`inline-block w-2 h-4 bg-white/70 ml-1 ${isTyping ? '' : 'animate-pulse'}`}></span>
                </span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
        
        {/* Copy Button */}
        <button 
          onClick={handleCopy}
          className="self-end px-4 py-2 mt-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white transition-colors flex items-center gap-2"
        >
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy Command'}
        </button>
      </div>
    </div>
  );
}
