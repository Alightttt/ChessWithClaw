import React from 'react';

export const HeartFilled = ({ size = 20, color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 512 512" fill={color} {...props}>
    <path d="M256 448c-8.5 0-16.6-3.2-22.8-8.9C181.1 392.6 96 308.1 96 208c0-61.9 50.1-112 112-112 38.1 0 71.8 19 92 48 20.2-29 53.9-48 92-48 61.9 0 112 50.1 112 112 0 100.1-85.1 184.6-137.2 231.1-6.2 5.7-14.3 8.9-22.8 8.9z"/>
  </svg>
);

export const HeartOutline = ({ size = 20, color = 'currentColor', strokeWidth = 32, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 512 512" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M256 448c-8.5 0-16.6-3.2-22.8-8.9C181.1 392.6 96 308.1 96 208c0-61.9 50.1-112 112-112 38.1 0 71.8 19 92 48 20.2-29 53.9-48 92-48 61.9 0 112 50.1 112 112 0 100.1-85.1 184.6-137.2 231.1-6.2 5.7-14.3 8.9-22.8 8.9z"/>
  </svg>
);
