import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button, Input } from '../ui';
import { motion, AnimatePresence } from 'framer-motion';

export default function ChatBox({ chatHistory, onSendMessage, onAcceptResignation, onAcceptDraw, agentName, agentAvatar, hideInput }) {
  const [message, setMessage] = useState('');
  const scrollRef = useRef(null);

  const displayAvatar = agentAvatar || '🦞';
  const displayName = agentName || 'OpenClaw';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    onSendMessage(message.trim());
    setMessage('');
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full w-full">
      {!hideInput && (
        <div className="p-3 sm:p-4 border-b border-[var(--color-border-subtle)] flex justify-between items-center bg-[var(--color-bg-elevated)]">
          <h2 className="text-[var(--color-text-primary)] font-bold text-sm sm:text-base tracking-wider">LIVE CHAT</h2>
        </div>
      )}
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 font-sans text-sm space-y-4"
      >
        {chatHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)] italic text-sm gap-2">
            <span className="text-4xl opacity-50">♟</span>
            <span>No messages yet</span>
            <span className="text-xs">Start the conversation</span>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {chatHistory.map((msg, idx) => {
              const isHuman = msg.sender === 'human';
              return (
                <motion.div 
                  key={idx} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex flex-col group ${isHuman ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {!isHuman && <span className="text-base">{displayAvatar}</span>}
                    <span className="text-xs font-bold text-[var(--color-text-secondary)]">
                      {isHuman ? 'You' : displayName}
                    </span>
                    <span className="text-[10px] text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <div 
                    className={`px-3 py-2 max-w-[85%] break-words shadow-sm ${
                      isHuman 
                        ? 'bg-[var(--color-red-primary)] text-white rounded-t-lg rounded-bl-lg rounded-br-sm' 
                        : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] rounded-t-lg rounded-br-lg rounded-bl-sm'
                    }`}
                  >
                    {msg.text}
                    {msg.type === 'resign_request' && !isHuman && (
                      <Button
                        onClick={onAcceptResignation}
                        variant="danger"
                        size="sm"
                        className="mt-3 w-full text-xs"
                      >
                        ACCEPT RESIGNATION
                      </Button>
                    )}
                    {msg.type === 'draw_request' && !isHuman && (
                      <Button
                        onClick={onAcceptDraw}
                        variant="secondary"
                        size="sm"
                        className="mt-3 w-full text-xs"
                      >
                        ACCEPT DRAW
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {!hideInput && (
        <form onSubmit={handleSubmit} className="p-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message your agent..."
            className="flex-1 bg-[var(--color-bg-base)] border-[var(--color-border-subtle)] focus:border-[var(--color-red-primary)]"
            maxLength={500}
          />
          <Button 
            type="submit"
            disabled={!message.trim()}
            variant="primary"
            className="px-3"
          >
            <Send size={18} />
          </Button>
        </form>
      )}
    </div>
  );
}
