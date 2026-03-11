import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, Plus } from 'lucide-react';
import { Button } from '../components/ui';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] flex flex-col items-center justify-center p-4 font-sans text-center relative overflow-hidden">
      <div className="relative flex items-center justify-center mb-8">
        <h1 className="text-9xl md:text-[12rem] font-black text-[var(--color-red-primary)] opacity-10 leading-none select-none">
          404
        </h1>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-8xl md:text-9xl text-white drop-shadow-2xl select-none">♔</span>
        </div>
      </div>
      
      <h2 className="text-3xl md:text-4xl font-bold mb-4 text-[var(--color-text-primary)]">Position not found</h2>
      <p className="text-[var(--color-text-secondary)] max-w-md mx-auto mb-10 text-lg">
        This game room doesn&apos;t exist or has expired.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md mx-auto">
        <Button 
          onClick={() => navigate('/')} 
          variant="primary" 
          size="lg" 
          className="flex-1"
          leftIcon={<Home size={20} />}
        >
          Go Home
        </Button>
        <Button 
          onClick={() => navigate('/')} 
          variant="secondary" 
          size="lg" 
          className="flex-1"
          leftIcon={<Plus size={20} />}
        >
          Create New Game
        </Button>
      </div>
    </div>
  );
}
