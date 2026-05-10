import React, { Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useParams } from 'react-router-dom';
import PageTransition from './components/PageTransition';
import ScrollToTop from './components/ScrollToTop';

import Home from './pages/Home';
import Game from './pages/Game';
import Agent from './pages/Agent';
import NotFound from './pages/NotFound';
import GameCreated from './components/GameCreated';

const GameCreatedWrapper = () => {
  const { id } = useParams();
  const location = useLocation();
  return <GameCreated gameId={id} agentToken={location.state?.agentToken} />;
};

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <>
      <style>{`
        .page-transition {
          animation: pageEnter 0.25s ease forwards;
        }
        @keyframes pageEnter {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <div key={location.pathname} className="page-transition">
        <Routes location={location}>
          <Route path="/" element={<PageTransition key={location.key}><Home /></PageTransition>} />
          <Route 
            path="/game/:id" 
            element={<PageTransition key={location.key}><Game /></PageTransition>} 
          />
          <Route path="/created/:id" element={<PageTransition key={location.key}><GameCreatedWrapper /></PageTransition>} />
          <Route path="/Agent" element={<PageTransition key={location.key}><Agent /></PageTransition>} />
          <Route path="/Board" element={<PageTransition key={location.key}><Agent /></PageTransition>} />
          <Route path="*" element={<PageTransition key={location.key}><NotFound /></PageTransition>} />
        </Routes>
      </div>
    </>
  );
}

export default function App() {
  useEffect(() => {
    const existing = document.querySelectorAll("link[rel*='icon']");
    existing.forEach(el => el.remove());
    
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.type = 'image/png';
    favicon.sizes = '32x32';
    favicon.href = 'https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/favicon.png';
    document.head.appendChild(favicon);
    
    const appleIcon = document.createElement('link');
    appleIcon.rel = 'apple-touch-icon';
    appleIcon.sizes = '180x180';
    appleIcon.href = 'https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/favicon.png';
    document.head.appendChild(appleIcon);
  }, []);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <AnimatedRoutes />
    </BrowserRouter>
  );
}
