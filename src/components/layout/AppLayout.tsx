import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="flex h-14 items-center gap-3 border-b bg-card px-3 sm:px-6 sticky top-0 z-20">
          <SidebarTrigger className="-ml-1" />
          <span className="font-semibold text-sm sm:hidden">งบส่งเสริม</span>
        </header>
        <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-6 animate-fade-in">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}