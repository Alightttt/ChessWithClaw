import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      // Small delay to let the app load first
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem('cookie_consent', 'all');
    setIsVisible(false);
  };

  const handleAcceptEssential = () => {
    localStorage.setItem('cookie_consent', 'essential');
    setIsVisible(false);
  };

  const handleRejectAll = () => {
    localStorage.setItem('cookie_consent', 'rejected');
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100%-32px)] sm:w-[380px] bg-[#0a0a0a] border border-[#1e1e1e] rounded-2xl shadow-2xl overflow-hidden"
          style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)', borderRadius: '16px', background: '#111111' }}
        >
          <div className="p-5 flex flex-col gap-3">
            <h3 className="text-white font-semibold text-base flex items-center gap-2">
              <span className="text-xl">🍪</span> We value your privacy
            </h3>
            <p className="text-neutral-400 text-xs leading-relaxed">
              We use cookies for game session identification and optional analytics. By clicking &quot;Accept All&quot;, you consent to our use of cookies.
            </p>
            
            <div className="flex gap-4 text-xs font-medium mt-1">
              <Link to="/legal" className="text-[#e63946] hover:text-[#ff4d5a] transition-colors">Privacy Policy & Terms</Link>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <button
                onClick={handleAcceptAll}
                className="w-full py-2.5 rounded-xl bg-white text-black font-semibold text-sm transition-all hover:bg-neutral-200 active:scale-[0.98]"
              >
                Accept All
              </button>
              <div className="flex gap-2 w-full">
                <button
                  onClick={handleAcceptEssential}
                  className="flex-1 py-2.5 rounded-xl bg-[#1a1a1a] border border-white/5 text-white/80 font-medium text-xs transition-all hover:bg-[#222] hover:text-white active:scale-[0.98]"
                >
                  Accept Essential
                </button>
                <button
                  onClick={handleRejectAll}
                  className="flex-1 py-2.5 rounded-xl bg-transparent border border-white/5 text-white/60 font-medium text-xs transition-all hover:bg-white/5 hover:text-white active:scale-[0.98]"
                >
                  Reject All
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
