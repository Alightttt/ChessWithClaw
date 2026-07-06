import React from 'react';
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Caught by ErrorBoundary:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: '#fff', fontFamily: "'Inter', sans-serif" }}>
          <h2>Something went wrong.</h2>
          <p>Please reload the page.</p>
          <button onClick={() => window.location.reload()} style={{ padding: '8px 16px', marginTop: 16, background: '#e63946', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}
