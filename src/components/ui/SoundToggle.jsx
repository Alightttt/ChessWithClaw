import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';

export const SoundToggle = ({ soundEnabled, setSoundEnabled, disabled = false, style = {} }) => {
  const baseColor = disabled ? '#444' : (soundEnabled ? '#e63946' : '#888');
  const hoverColor = disabled ? '#444' : (soundEnabled ? '#ff4d5a' : '#f0f0f0');

  return (
    <button
      onClick={() => !disabled && setSoundEnabled(!soundEnabled)}
      disabled={disabled}
      style={{
        background: 'transparent',
        color: baseColor,
        border: 'none',
        padding: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'color 0.15s, transform 0.15s',
        outline: 'none',
        transform: 'scale(1)',
        ...style
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.color = hoverColor; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.color = baseColor; }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'scale(0.95)'; }}
      onMouseUp={e => { if (!disabled) e.currentTarget.style.transform = 'scale(1)'; }}
      onFocus={e => { if (!disabled) e.currentTarget.style.boxShadow = '0 0 0 2px rgba(230,57,70,0.4)'; }}
      onBlur={e => { if (!disabled) e.currentTarget.style.boxShadow = 'none'; }}
      title={soundEnabled ? "Sound On" : "Sound Off"}
    >
      {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
    </button>
  );
};
