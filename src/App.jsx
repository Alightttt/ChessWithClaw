import React, { Suspense } from 'react';
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
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AnimatedRoutes />
    </BrowserRouter>
  );
}
