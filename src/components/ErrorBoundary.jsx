import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    try {
      console.error('[ChessWithClaw Error]', error, info);
    } catch (e) {
      // Ignore
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white font-sans flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-6">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Something went wrong</h1>
          <p className="text-neutral-400 text-sm max-w-sm mx-auto mb-8 line-clamp-3">
            {this.state.error?.message || 'An unexpected error occurred in the application layer.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-colors active:scale-95"
          >
            <RefreshCw size={16} /> Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
