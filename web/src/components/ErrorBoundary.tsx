import { Component, type ReactNode } from "react";

/** A crash must never leave a distressed student on a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="gate">
        <h1>Something went wrong</h1>
        <p>The chat stopped working. If you need to talk to someone now:</p>
        <ul>
          <li>
            Samaritans of Singapore: <a href="tel:1767">1767</a> (24 hours)
          </li>
          <li>
            mindline: <a href="tel:1771">1771</a>
          </li>
          <li>
            Emergency: <a href="tel:995">995</a>
          </li>
        </ul>
        <button onClick={() => window.location.reload()}>Reload the chat</button>
      </main>
    );
  }
}
