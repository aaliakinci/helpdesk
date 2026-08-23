import { Component, type ErrorInfo, type PropsWithChildren } from "react";

interface AppErrorBoundaryState {
  readonly failed: boolean;
}

export class AppErrorBoundary extends Component<PropsWithChildren, AppErrorBoundaryState> {
  public override state: AppErrorBoundaryState = { failed: false };

  public static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Application render failed", {
      componentStack: info.componentStack,
      name: error.name,
    });
  }

  public override render() {
    if (!this.state.failed) {
      return this.props.children;
    }

    return (
      <main id="application-error" role="alert">
        <h1>Uygulama görüntülenemedi</h1>
        <p>Sayfayı yenileyip tekrar deneyin.</p>
        <button type="button" onClick={() => globalThis.location.reload()}>
          Yenile
        </button>
      </main>
    );
  }
}
