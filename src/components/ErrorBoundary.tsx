import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: string; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error?.message || String(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-8">
          <div className="text-center max-w-md">
            <h2 className="text-xl font-bold text-destructive mb-2">เกิดข้อผิดพลาด</h2>
            <p className="text-sm text-muted-foreground mb-4">{this.state.error}</p>
            <Button onClick={() => { this.setState({ hasError: false, error: "" }); window.location.reload(); }}>
              โหลดหน้าใหม่
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
