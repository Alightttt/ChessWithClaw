import React from 'react';

export function ChessPiece({ pieceKey, theme = 'neo', className = "w-full h-full" }) {
  if (!pieceKey || pieceKey.length < 2) return null;
  const color = pieceKey[0]; // 'w' or 'b'
  const type = pieceKey[1].toUpperCase(); // 'K', 'Q', 'R', 'B', 'N', 'P'
  
  // Define fills and strokes based on theme and color
  let fill = "currentColor";
  let stroke = "none";
  let gradientId = "";
  
  const currentTheme = theme || 'neo';
  
  if (currentTheme === 'ocean') {
    if (color === 'w') {
      gradientId = 'ocean-white-grad';
      stroke = '#0284c7';
    } else {
      gradientId = 'ocean-black-grad';
      stroke = '#e0f2fe';
    }
  } else if (currentTheme === 'tournament') {
    if (color === 'w') {
      fill = '#ffffff';
      stroke = '#1a1a1a';
    } else {
      fill = '#3b2f2f';
      stroke = '#ffe5d9';
    }
  } else { // default to 'neo' (modern/rounder shapes)
    if (color === 'w') {
      fill = '#ffffff';
      stroke = '#1e293b';
    } else {
      fill = '#1e293b';
      stroke = '#f8fafc';
    }
  }

  // Gradients for Ocean theme
  const renderGradients = () => {
    if (currentTheme === 'ocean') {
      return (
        <defs>
          <linearGradient id="ocean-white-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e0f2fe" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
          <linearGradient id="ocean-black-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>
        </defs>
      );
    }
    return null;
  };

  const currentFill = gradientId ? `url(#${gradientId})` : fill;

  // Render SVG based on piece type
  switch (type) {
    case 'P':
      return (
        <svg viewBox="0 0 45 45" className={className} xmlns="http://www.w3.org/2000/svg">
          {renderGradients()}
          <g fill={currentFill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
            <path d="M 16,39 C 16,39 29,39 29,39 C 29,39 27.5,35 27.5,35 C 27.5,35 17.5,35 17.5,35 C 17.5,35 16,39 16,39 Z" />
            <path d="M 22.5,35 C 26,30 26,24 26,19 C 26,17.5 25,17 25,17 C 24,16 23.5,15.5 23.5,15.5 C 21.5,15.5 21,16 20,17 C 20,17 19,17.5 19,19 C 19,24 19,30 22.5,35 Z" />
            <circle cx="22.5" cy="11.5" r="5" />
          </g>
        </svg>
      );
    case 'R':
      return (
        <svg viewBox="0 0 45 45" className={className} xmlns="http://www.w3.org/2000/svg">
          {renderGradients()}
          <g fill={currentFill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
            <path d="M 12,39 L 33,39 L 33,34 L 12,34 Z" />
            <path d="M 15,34 L 30,34 L 28,19 L 17,19 Z" />
            <path d="M 13,19 L 32,19 L 32,10 L 28,10 L 28,13 L 25,13 L 25,10 L 20,10 L 20,13 L 17,13 L 17,10 L 13,10 Z" />
          </g>
        </svg>
      );
    case 'N':
      return (
        <svg viewBox="0 0 45 45" className={className} xmlns="http://www.w3.org/2000/svg">
          {renderGradients()}
          <g fill={currentFill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
            <path d="M 33,38 C 30,38 28,34 27,33 C 24,31 22,25 21,21 C 18,18 16,14 16,11 C 18,13 22,15 25,12 C 26,10 24,7 21,7 C 18,7 15,9 13,12 C 11,15 11,19 12,23 C 13,27 16,30 19,32 C 17,33 14,35 12,38 L 33,38 Z" />
            <circle cx="18" cy="13" r="2" fill={stroke} stroke="none" />
          </g>
        </svg>
      );
    case 'B':
      return (
        <svg viewBox="0 0 45 45" className={className} xmlns="http://www.w3.org/2000/svg">
          {renderGradients()}
          <g fill={currentFill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
            <path d="M 13,39 L 32,39 L 31,34 L 14,34 Z" />
            <path d="M 14,34 C 13,27 17.5,17 22.5,12 C 27.5,17 32,27 31,34 Z" />
            <circle cx="22.5" cy="8.5" r="3" />
            <path d="M 18,22 Q 22.5,15 27,22" fill="none" stroke={stroke} strokeWidth="2.5" />
          </g>
        </svg>
      );
    case 'Q':
      return (
        <svg viewBox="0 0 45 45" className={className} xmlns="http://www.w3.org/2000/svg">
          {renderGradients()}
          <g fill={currentFill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
            <path d="M 12,39 L 33,39 L 31,34 L 14,34 Z" />
            <path d="M 15,34 L 30,34 L 28,21 L 17,21 Z" />
            <path d="M 14,21 L 10,13 L 17.5,18 L 22.5,10 L 27.5,18 L 35,13 L 31,21 Z" />
            <circle cx="10" cy="11.5" r="2.5" />
            <circle cx="17.5" cy="16.5" r="2.5" />
            <circle cx="22.5" cy="8.5" r="2.5" />
            <circle cx="27.5" cy="16.5" r="2.5" />
            <circle cx="35" cy="11.5" r="2.5" />
          </g>
        </svg>
      );
    case 'K':
      return (
        <svg viewBox="0 0 45 45" className={className} xmlns="http://www.w3.org/2000/svg">
          {renderGradients()}
          <g fill={currentFill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
            <path d="M 12,39 L 33,39 L 31,34 L 14,34 Z" />
            <path d="M 15,34 L 30,34 L 28,22 L 17,22 Z" />
            <path d="M 17,22 C 17,14 28,14 28,22" />
            <path d="M 22.5,14 L 22.5,6 M 19,9 L 26,9" fill="none" stroke={stroke} strokeWidth="3" />
          </g>
        </svg>
      );
    default:
      return null;
  }
}
