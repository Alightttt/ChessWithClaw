import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import ErrorBoundary from './components/ErrorBoundary';

const Home = lazy(() => import('./pages/Home'));
const Game = lazy(() => import('./pages/Game'));
const Agent = lazy(() => import('./pages/Agent'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Toaster 
          position="top-center" 
          theme="dark" 
          toastOptions={{
            style: {
              background: '#262421',
              border: '1px solid #c62828',
              color: '#ffffff',
            },
          }}
        />
        <Suspense fallback={<div className="min-h-screen bg-[#312e2b] text-white flex items-center justify-center font-sans">Loading...</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/Game" element={<Game />} />
            <Route path="/Agent" element={<Agent />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
