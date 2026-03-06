import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#1a1917] text-white flex flex-col items-center justify-center p-4 font-sans text-center">
      <h1 className="text-6xl md:text-8xl font-black text-[#c62828] mb-4">404</h1>
      <h2 className="text-2xl md:text-3xl font-bold mb-6">Page Not Found</h2>
      <p className="text-[#c3c3c2] max-w-md mx-auto mb-8">
        The page you are looking for doesn&apos;t exist or has been moved.
      </p>
      <Link 
        to="/" 
        className="inline-flex items-center gap-2 px-6 py-3 bg-[#c62828] hover:bg-[#e53935] text-white font-bold rounded-lg transition-colors"
      >
        <Home size={20} />
        Return to Home
      </Link>
    </div>
  );
}
