import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useParams } from 'react-router-dom';
import PageTransition from './components/PageTransition';
import ScrollToTop from './components/ScrollToTop';

import Home from './pages/Home';
const Game = lazy(() => import('./pages/Game'));
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
        element={
          <Suspense fallback={
            <div style={{
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              height:'100vh',
              background:'#080808',
              color:'#555',
              fontFamily:'Inter,sans-serif',
              fontSize:14
            }}>
              Loading...
            </div>
          }>
            <PageTransition key={location.key}><Game /></PageTransition>
          </Suspense>
        } 
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
