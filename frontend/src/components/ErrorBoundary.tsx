import { Component, type ErrorInfo, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/** Top-level failure boundary: if a screen throws, show a recovery message + retry instead of a blank app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("PANDI AI crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-6 text-center" data-testid="error-boundary">
        <p className="font-heading text-sm tracking-[0.3em] text-[#ff8a1f]">PANDI AI HIT A SNAG</p>
        <p className="max-w-sm text-sm text-[#ffe3b8]">Something went wrong while rendering this screen. Your chats and profile are safe. Try again below.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          data-testid="error-boundary-retry"
          className="inline-flex items-center gap-2 rounded border border-[#ff8a1f] bg-[#ff8a1f]/15 px-5 py-2.5 font-heading text-xs tracking-[0.25em] text-white hover:bg-[#ff8a1f]/30"
        >
          <RotateCcw size={14} /> RETRY
        </button>
      </div>
    );
  }
}
