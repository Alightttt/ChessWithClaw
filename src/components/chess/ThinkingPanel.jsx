'use client';

import React from 'react';
import { Copy, Activity, Cpu, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function ThinkingPanel({ agentConnected, agentUrl, currentThinking, lastThinking, isAgentTurn, isHumanTurn }) {
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const getStatusConfig = () => {
    if (!agentConnected) return { text: 'WAITING FOR AGENT', color: 'text-[#c3c3c2]', bg: 'bg-[#403d39]/30', border: 'border-[#403d39]', icon: <Clock size={16} className="text-[#c3c3c2]" /> };
    if (isAgentTurn) return { text: 'ANALYZING', color: 'text-[#ef5350]', bg: 'bg-[#ef5350]/10', border: 'border-[#ef5350]', icon: <Cpu size={16} className="text-[#ef5350] animate-pulse" /> };
    return { text: 'WAITING', color: 'text-[#c3c3c2]', bg: 'bg-[#c3c3c2]/10', border: 'border-[#c3c3c2]', icon: <CheckCircle2 size={16} className="text-[#c3c3c2]" /> };
  };

  const status = getStatusConfig();

  return (
    <div className={`bg-[#262421] border-2 ${status.border} rounded-md p-1.5 sm:p-5 shadow-2xl flex flex-col gap-1 sm:gap-3 transition-all duration-500 h-[85px] sm:h-auto sm:min-h-[160px]`}>
      {/* Header / Status Bar */}
      <div className="flex items-center justify-between border-b border-[#403d39] pb-1 sm:pb-3 shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-full bg-[#312e2b] border border-[#403d39] flex items-center justify-center text-[10px] sm:text-sm">
            🦞
          </div>
          <div>
            <h2 className="text-[11px] sm:text-base font-bold text-[#ffffff] leading-none">Claw</h2>
            <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5">
              {status.icon}
              <span className={`text-[8px] sm:text-xs font-bold tracking-wider ${status.color}`}>
                {status.text}
              </span>
            </div>
          </div>
        </div>
        <div className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[8px] sm:text-[10px] font-mono tracking-widest ${status.bg} ${status.color} hidden sm:block`}>
          AGENT
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto pr-1">
        {!agentConnected ? (
          <div className="space-y-1 sm:space-y-4 h-full flex flex-col justify-center">
            <p className="text-[#c3c3c2] text-[9px] sm:text-sm leading-tight">Agent disconnected. Share link to connect.</p>
            <div className="flex gap-1.5 sm:gap-2">
              <button 
                onClick={() => copyToClipboard(agentUrl)}
                className="w-full bg-[#312e2b] hover:bg-[#403d39] border border-[#403d39] rounded px-3 py-2 text-[#ffffff] text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Copy size={14} />
                Copy Agent Invite Link
              </button>
            </div>
          </div>
        ) : isAgentTurn ? (
          <div className="space-y-0.5 sm:space-y-2">
            <label className="flex items-center gap-1 sm:gap-1.5 text-[#c3c3c2] text-[8px] sm:text-[10px] font-bold uppercase tracking-wider">
              <Activity size={8} className="animate-pulse text-[#ef5350]" />
              Live Thought Process
            </label>
            {currentThinking ? (
              <div className="bg-[#312e2b] border border-[#ef5350]/20 rounded p-1 sm:p-3">
                <pre className="whitespace-pre-wrap font-mono text-[8px] sm:text-xs text-[#ef5350] leading-tight">
                  {currentThinking}
                  <span className="animate-pulse">▌</span>
                </pre>
              </div>
            ) : (
              <p className="text-[#c3c3c2] italic text-[9px] sm:text-sm py-0.5">Evaluating positions...</p>
            )}
          </div>
        ) : (
          <div className="space-y-1 sm:space-y-3">
            <p className="text-[#c3c3c2] text-[9px] sm:text-sm">Agent is waiting for your move.</p>
            {lastThinking && (
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[8px] sm:text-[10px] text-[#c3c3c2] uppercase tracking-wider font-bold">Played:</span>
                  <span className="text-[#ef5350] font-mono text-[9px] sm:text-xs font-bold bg-[#ef5350]/10 px-1 py-0.5 rounded">
                    {lastThinking.finalMove}
                  </span>
                </div>
                <div className="bg-[#312e2b] border border-[#403d39] rounded p-1 sm:p-3">
                  <pre className="whitespace-pre-wrap font-mono text-[8px] sm:text-xs text-[#c3c3c2] leading-tight">
                    {lastThinking.text || '(No reasoning provided)'}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
