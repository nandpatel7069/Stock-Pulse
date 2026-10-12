'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { ToastContainer } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';

function FullScreenLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        {/* Spinner */}
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-2 border-border" />
          <div className="absolute inset-0 rounded-full border-2 border-t-primary animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground tracking-wide">Loading…</p>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  // Show full-screen loader while session is being resolved
  if (authLoading) return <FullScreenLoader />;

  // Avoid rendering protected content before redirect fires
  if (!user) return <FullScreenLoader />;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden ml-[220px]" id="main-content">
        <Header onOpenCommandPalette={() => setCmdOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />
      <ToastContainer />
    </div>
  );
}
