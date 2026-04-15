import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useParams } from 'react-router-dom';
import PageTransition from './components/PageTransition';
import ScrollToTop from './components/ScrollToTop';

const Home = lazy(() => import('./pages/Home'));
const Game = lazy(() => import('./pages/Game'));
const Agent = lazy(() => import('./pages/Agent'));
const NotFound = lazy(() => import('./pages/NotFound'));
const GameCreated = lazy(() => import('./components/GameCreated'));

const GameCreatedWrapper = () => {
  const { id } = useParams();
  const location = useLocation();
  return <GameCreated gameId={id} agentToken={location.state?.agentToken} />;
};

const Fallback = () => (
  <div
    style={{
      minHeight: '100dvh',
      background: '#080808',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <div
      style={{
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        background: '#e63946',
        animation: 'pulse 1s ease-in-out infinite',
        willChange: 'transform, opacity',
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
        transform: 'translateZ(0)',
      }}
    />
    <style>
      {`
        @keyframes pulse {
          0%, 100% { transform: scale(1) translateZ(0); opacity: 1; }
          50% { transform: scale(0.8) translateZ(0); opacity: 0.5; }
        }
      `}
    </style>
  </div>
);

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <Routes location={location}>
      <Route path="/" element={<PageTransition key={location.key}><Home /></PageTransition>} />
      <Route path="/game/:id" element={<PageTransition key={location.key}><Game /></PageTransition>} />
      <Route path="/created/:id" element={<PageTransition key={location.key}><GameCreatedWrapper /></PageTransition>} />
      <Route path="/Agent" element={<PageTransition key={location.key}><Agent /></PageTransition>} />
      <Route path="/Board" element={<PageTransition key={location.key}><Agent /></PageTransition>} />
      <Route path="*" element={<PageTransition key={location.key}><NotFound /></PageTransition>} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Suspense fallback={<Fallback />}>
        <AnimatedRoutes />
      </Suspense>
    </BrowserRouter>
  );
}
