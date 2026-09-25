import { Component } from 'react';

/** Last-resort safety net so a rendering bug never leaves a blank page. */
export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.error(err); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ padding: 40, textAlign: 'center' }} role="alert">
        <h1 style={{ fontSize: '1.6rem' }}>Something went wrong / რაღაც არასწორად წავიდა</h1>
        <button type="button" className="btn btn--primary" onClick={() => window.location.assign('/')}>Reload / თავიდან</button>
      </div>
    );
  }
}
