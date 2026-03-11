import React, { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './contexts/ToastContext';
import ToastManager from './components/ToastManager';
import ErrorBoundary from './components/ErrorBoundary';
import { motion } from 'framer-motion';

const Home = lazy(() => import('./pages/Home'));
const Game = lazy(() => import('./pages/Game'));
const Agent = lazy(() => import('./pages/Agent'));
const NotFound = lazy(() => import('./pages/NotFound'));

const Fallback = () => (
  <div className="min-h-screen bg-[var(--color-bg-base)] flex items-center justify-center">
    <motion.div
      animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      className="text-6xl text-[var(--color-text-primary)]"
    >
      ♟
    </motion.div>
  </div>
);

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <HashRouter>
          <Suspense fallback={<Fallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/game/:id" element={<Game />} />
              <Route path="/Agent" element={<Agent />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </HashRouter>
        <ToastManager />
      </ToastProvider>
    </ErrorBoundary>
  );
}
