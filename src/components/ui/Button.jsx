import React from 'react';
import { Loader2 } from 'lucide-react';

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  onClick,
  children,
  className = '',
  ...props
}) {
  const baseStyles = 'inline-flex items-center justify-center font-bold tracking-widest transition-all duration-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 active:translate-y-[1px] active:scale-[0.98] rounded-md uppercase';
  
  const variants = {
    primary: 'design-btn-primary',
    secondary: 'bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-white hover:border-[var(--color-border-default)] hover:bg-[var(--color-bg-hover)]',
    ghost: 'bg-transparent border border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-white',
    danger: 'bg-red-900/20 text-red-500 hover:bg-red-900/40 border border-red-900/50 hover:border-red-500/50',
  };

  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
    xl: 'h-14 px-8 text-lg',
  };

  const isDisabled = disabled || loading;
  const disabledStyles = isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer';

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${disabledStyles} ${className}`}
      onClick={onClick}
      disabled={isDisabled}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {!loading && leftIcon && <span className="mr-2">{leftIcon}</span>}
      {children}
      {!loading && rightIcon && <span className="ml-2">{rightIcon}</span>}
    </button>
  );
}
