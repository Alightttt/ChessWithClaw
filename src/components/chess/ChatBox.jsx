import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

export default function ChatBox({ chatHistory, onSendMessage, onAcceptResignation }) {
  const [message, setMessage] = useState('');
  const scrollRef = useRef(null);
  const [botJustMessaged, setBotJustMessaged] = useState(false);
  const [userJustMessaged, setUserJustMessaged] = useState(false);
  const prevChatHistoryLength = useRef(chatHistory.length);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    
    if (chatHistory.length > prevChatHistoryLength.current) {
      const lastMsg = chatHistory[chatHistory.length - 1];
      if (lastMsg.sender === 'agent') {
        setBotJustMessaged(true);
        setTimeout(() => setBotJustMessaged(false), 3000);
      }
    }
    prevChatHistoryLength.current = chatHistory.length;
  }, [chatHistory]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    onSendMessage(message.trim());
    setMessage('');
    setUserJustMessaged(true);
    setTimeout(() => setUserJustMessaged(false), 3000);
  };

  return (
    <div className="bg-[#262421] border border-[#403d39] rounded-md flex flex-col h-full shadow-lg">
      <div className="p-3 sm:p-4 border-b border-[#403d39] flex justify-between items-center">
        <h2 className="text-[#ffffff] font-bold text-sm sm:text-base tracking-wider">LIVE CHAT</h2>
        <div className="flex items-center gap-2">
          {userJustMessaged && (
            <span className="text-[#ef5350] text-[10px] sm:text-xs font-sans animate-pulse">Bot informed</span>
          )}
          {botJustMessaged && (
            <div className="w-2.5 h-2.5 rounded-full bg-[#ef5350] animate-pulse shadow-[0_0_8px_#ef5350]" title="Bot just messaged" />
          )}
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 sm:p-4 font-sans text-xs sm:text-sm space-y-3 min-h-[150px] max-h-[250px]"
      >
        {chatHistory.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#c3c3c2] italic">
            Game chat will appear here
          </div>
        ) : (
          chatHistory.map((msg, idx) => (
            <div key={idx} className={`flex flex-col ${msg.sender === 'human' ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] text-[#c3c3c2] mb-1">
                {msg.sender === 'human' ? 'You' : '🦞 Claw'}
              </span>
              <div 
                className={`px-3 py-2 rounded-lg max-w-[85%] break-words ${
                  msg.sender === 'human' 
                    ? 'bg-[#c62828] text-white rounded-tr-none' 
                    : 'bg-[#312e2b] text-[#ffffff] rounded-tl-none'
                }`}
              >
                {msg.text}
                {msg.type === 'resign_request' && msg.sender === 'agent' && (
                  <button
                    onClick={onAcceptResignation}
                    className="mt-2 w-full bg-[#7f0000] hover:bg-[#c62828] text-white font-bold py-1 px-2 rounded text-[10px] transition-colors"
                  >
                    ACCEPT RESIGNATION
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-[#403d39] flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message the bot..."
          className="flex-1 bg-[#312e2b] border border-[#403d39] rounded px-3 py-2 text-[#ffffff] font-sans text-xs sm:text-sm outline-none focus:border-[#c62828] transition-colors"
        />
        <button 
          type="submit"
          disabled={!message.trim()}
          className="bg-[#c62828] hover:bg-[#e53935] disabled:bg-[#312e2b] disabled:text-[#c3c3c2] disabled:border-[#403d39] disabled:active:translate-y-0 disabled:active:border-b-[3px] text-white p-2 rounded-md border-b-[3px] border-[#7f0000] active:border-b-0 active:translate-y-[3px] flex items-center justify-center transition-all"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
