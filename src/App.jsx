import ErrorBoundary from './components/ErrorBoundary';
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useParams } from 'react-router-dom';
import PageTransition from './components/PageTransition';
import ScrollToTop from './components/ScrollToTop';

import Home from './pages/Home';
import Game from './pages/Game';
import NotFound from './pages/NotFound';
import GameCreated from './components/GameCreated';
import Rival from './pages/Rival';
const Legal = React.lazy(() => import('./pages/Legal'));

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
          animation: pageEnter 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          will-change: transform, opacity;
          transform: translateZ(0);
        }
        @keyframes pageEnter {
          from { opacity: 0; transform: translateY(10px) translateZ(0); }
          to { opacity: 1; transform: translateY(0) translateZ(0); }
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
          <Route path="/rival/:agentName" element={<PageTransition key={location.key}><Rival /></PageTransition>} />
          <Route path="/legal" element={<PageTransition key={location.key}><React.Suspense fallback={<div style={{minHeight:'100dvh',background:'#0a0a0a'}}/>}><Legal /></React.Suspense></PageTransition>} />
          <Route path="*" element={<PageTransition key={location.key}><NotFound /></PageTransition>} />
        </Routes>
      </div>
    </>
  );
}

const sendNotificationIfAllowed = () => {
  if (Notification.permission === "granted") {
    const msgs = [
      "Your agent is waiting for you! 🦞 Play a match now.",
      "Are you slipping? Your Agent just learned a new opening.",
      "Time for a quick game of Chess! No latency, just you and your agent."
    ];
    const text = msgs[Math.floor(Math.random() * msgs.length)];
    try {
      new Notification("ChessWithClaw", {
        body: text,
        icon: "https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/favicon.png",
        vibrate: [200, 100, 200]
      });
    } catch(e) {}
  }
};

const setupNotifications = () => {
  if (!("Notification" in window)) return;
  
  // Ask for permission after a few seconds of engagement
  setTimeout(() => {
    if (Notification.permission === "default") {
      Notification.requestPermission().then(perm => {
        if (perm === "granted") {
          // Schedule intervals (4 hours roughly 3-4 times a day)
          setInterval(sendNotificationIfAllowed, 4 * 60 * 60 * 1000);
        }
      });
    } else if (Notification.permission === "granted") {
      setInterval(sendNotificationIfAllowed, 4 * 60 * 60 * 1000);
    }
  }, 5000);
};

export default function App() {
  useEffect(() => {
    const existing = document.querySelectorAll("link[rel*='icon']");
    existing.forEach(el => el.remove());
    
    // Original exact icon for standard browsers
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.type = 'image/png';
    favicon.sizes = '32x32';
    // Use the scaled-down embedded version for standard favicon too, or just keep PNG? Standard is fine as is
    favicon.href = 'https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/favicon.png';
    document.head.appendChild(favicon);
    
    // For iOS/PWA, we must pad the logo so it naturally fits the iOS app icon bounds
    // We achieve this using a data-uri SVG that draws a dark background and places the PNG slightly smaller in the center.
    const paddedSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>
      <rect width='100' height='100' fill='#0B0B0B'/>
      <image href='https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/favicon.png' width='70' height='70' x='15' y='15'/>
    </svg>`;

    const appleIcon = document.createElement('link');
    appleIcon.rel = 'apple-touch-icon';
    appleIcon.sizes = '180x180';
    appleIcon.href = `data:image/svg+xml,${encodeURIComponent(paddedSvg)}`;
    document.head.appendChild(appleIcon);

    // Initialize notification engine
    setupNotifications();
  }, []);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <ErrorBoundary><AnimatedRoutes /></ErrorBoundary>
    </BrowserRouter>
  );
}
