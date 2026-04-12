'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Copy, Clock, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Button, StatusDot } from '../ui';

export default function ThinkingPanel({ agentConnected, agentUrl, currentThinking, lastThinking, isAgentTurn, isHumanTurn, agentName, agentAvatar, agentTagline }) {
  const [displayedThinking, setDisplayedThinking] = useState('');
  const [thinkingTime, setThinkingTime] = useState(0);
  const scrollRef = useRef(null);
  const { toast } = useToast();

  // Timer for thinking duration
  useEffect(() => {
    let interval;
    if (isAgentTurn && currentThinking) {
      interval = setInterval(() => {
        setThinkingTime(prev => prev + 1);
      }, 1000);
    } else {
      setThinkingTime(0);
    }
    return () => clearInterval(interval);
  }, [isAgentTurn, currentThinking]);

  // Typewriter effect logic
  useEffect(() => {
    if (!currentThinking) {
      setDisplayedThinking('');
      return;
    }
    
    if (currentThinking.length > displayedThinking.length) {
      const timeout = setTimeout(() => {
        setDisplayedThinking(currentThinking.substring(0, displayedThinking.length + 1));
      }, 20);
      return () => clearTimeout(timeout);
    } else if (currentThinking.length < displayedThinking.length) {
      setDisplayedThinking(currentThinking);
    }
  }, [currentThinking, displayedThinking]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayedThinking]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const isActive = isAgentTurn && currentThinking;

  return (
    <div className="flex flex-col bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-lg overflow-hidden h-full min-h-[150px] max-h-[300px]">
      {/* Header */}
      <div className="hidden md:flex px-4 py-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white">{agentName} Thinking</span>
          {isActive && <StatusDot status="warning" />}
        </div>
        {isActive && (
          <span className="text-xs font-mono text-[var(--color-text-muted)]">
            Thinking for {thinkingTime}s...
          </span>
        )}
      </div>

      {/* Body */}
      <div 
        ref={scrollRef}
        className={`flex-1 overflow-y-auto p-4 bg-[var(--color-bg-base)] font-mono text-sm transition-all duration-300 ${isActive ? 'border-l-2 border-[var(--color-red-primary)]' : 'border-l-2 border-transparent'}`}
      >
        {!agentConnected ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center border-2 border-dashed border-[var(--color-border-subtle)] rounded-lg m-2 p-4 animate-pulse">
            <p className="text-[var(--color-text-muted)] text-sm font-bold tracking-widest uppercase">Waiting...</p>
            <p className="text-[var(--color-text-muted)] text-xs">{agentName} disconnected. Share link to connect.</p>
            <Button 
              onClick={() => copyToClipboard(agentUrl)}
              variant="secondary"
              size="sm"
              leftIcon={<Copy size={14} />}
            >
              Copy Invite Link
            </Button>
          </div>
        ) : isActive ? (
          <div className="text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
            {displayedThinking}
            <span className="animate-pulse ml-1 inline-block w-2 h-4 bg-[var(--color-red-primary)] align-middle"></span>
          </div>
        ) : isAgentTurn ? (
          <div className="text-[var(--color-text-muted)] italic flex items-center h-full">
            Waiting for {agentName} to start thinking...
          </div>
        ) : lastThinking ? (
          <div className="flex flex-col gap-2 opacity-60">
            <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-bold">Last thought:</span>
            <div className="text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
              {lastThinking.text || '(No reasoning provided)'}
            </div>
          </div>
        ) : (
          <div className="text-[var(--color-text-muted)] italic flex items-center h-full">
            {agentName} is waiting for your move.
          </div>
        )}
      </div>
    </div>
  );
}
