import React, { useState, useEffect } from 'react';
import { Link as LinkIcon, Menu, X } from 'lucide-react';
import Button from './ui/Button';

export default function AppHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 60);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setMenuOpen(false);
  };

  return (
    <>
      <header 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled 
            ? 'bg-[var(--color-bg-surface)]/90 backdrop-blur-md border-b border-[var(--color-border-subtle)] py-3' 
            : 'bg-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Left: Logo */}
          <button onClick={scrollToTop} className="flex items-center gap-3 group">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699888c91e97454c7b995e2f/5384ee56f_gpt-image-15-high-fidelity_a_Make_a_logo_for_my_a.png" 
              alt="Logo" 
              className="w-7 h-7 rounded-full border border-[var(--color-border-subtle)] object-cover group-hover:border-[var(--color-red-primary)] transition-colors"
            />
            <span className="font-display font-semibold text-xl text-[var(--color-text-primary)] tracking-tight">
              ChessWithClaw
            </span>
          </button>

          {/* Right: Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            <a 
              href="https://clawhub.ai" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <LinkIcon size={18} />
              ClawHub
            </a>
            <Button size="sm" onClick={scrollToTop}>
              Play Now
            </Button>
          </nav>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <div className="absolute top-[72px] left-0 right-0 bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)] p-4 flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200">
            <a 
              href="https://clawhub.ai" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] font-medium"
              onClick={() => setMenuOpen(false)}
            >
              <LinkIcon size={20} />
              ClawHub
            </a>
            <Button className="w-full mt-2" onClick={scrollToTop}>
              Play Now
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
