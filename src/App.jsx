import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import Home from './pages/Home';
import Game from './pages/Game';
import Agent from './pages/Agent';
import ErrorBoundary from './components/ErrorBoundary';

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
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
