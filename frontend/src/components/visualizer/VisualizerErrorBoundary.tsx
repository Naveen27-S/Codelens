/**
 * src/components/visualizer/VisualizerErrorBoundary.tsx
 *
 * Local React class error boundary that catches errors from the visualizer
 * without letting them crash the rest of the editor page.
 */

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class VisualizerErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : 'Unknown rendering error.';
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.warn('[VisualizerErrorBoundary] caught error:', error, info);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false, message: '' });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-400 opacity-70" />
          <p className="text-slate-300 font-medium text-sm">Visualizer Error</p>
          <p className="text-slate-500 text-xs max-w-xs leading-relaxed">
            {this.state.message}
          </p>
          <p className="text-slate-600 text-xs">
            The editor and console are still fully usable.
          </p>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-300 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry Visualizer
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
