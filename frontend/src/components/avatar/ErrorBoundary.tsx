import React, { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('❌ ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      // Check if it's a WebGL error
      const isWebGLError = this.state.error?.message?.includes('WebGL') || 
                          this.state.error?.message?.includes('Error creating WebGL context');
      
      if (isWebGLError) {
        return (
          <div className="min-h-screen bg-black flex items-center justify-center relative">
            <div className="hero-canvas-fallback" style={{ position: 'fixed', inset: 0, zIndex: 0 }}></div>
            <div className="relative z-10 text-center px-6">
              <h1 className="text-6xl md:text-8xl font-bold mb-6 text-white">LEADFORGE</h1>
              <div className="text-xl md:text-2xl text-white/80 space-y-2">
                <p>Where AI meets lead generation,</p>
                <p>we transform prospects into customers</p>
              </div>
            </div>
          </div>
        );
      }
      
      return (
        <div className="flex items-center justify-center h-full text-white text-center p-5 bg-red-500/10 rounded-xl">
          <div>
            <h2 className="text-red-400 text-xl mb-2">⚠️ Error Loading Component</h2>
            <p className="text-sm text-white/60 mb-4">
              {this.state.error?.message || 'Unknown error'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

