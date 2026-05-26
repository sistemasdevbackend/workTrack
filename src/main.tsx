import { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
          <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-6 max-w-lg w-full">
            <h2 className="text-red-400 font-bold text-lg mb-2">Error de aplicación</h2>
            <pre className="text-red-300 text-xs whitespace-pre-wrap break-all">{String((this.state.error as Error).message)}</pre>
            <button
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition"
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
