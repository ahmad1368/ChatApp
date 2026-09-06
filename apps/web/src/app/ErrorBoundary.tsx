"use client";

import { Component, ReactNode } from "react";
import { reportError } from "./errorReporting";

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    reportError(error, { componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="chat-app">
          <h1>Something went wrong</h1>
          <p className="chat-app__status">The error has been reported automatically. Try reloading the page.</p>
          <button className="chat-app__send" onClick={() => window.location.reload()}>
            Reload
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
