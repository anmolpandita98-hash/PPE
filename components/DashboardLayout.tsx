'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    setIsGuest(localStorage.getItem('ppe_guest') === 'true');
  }, []);

  function logout() {
    localStorage.removeItem('ppe_token');
    localStorage.removeItem('ppe_guest');
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-700 bg-card/80 backdrop-blur flex items-center justify-between px-6 py-4">
        <Link href="/dashboard" className="text-lg font-bold text-accent">
          PPE Monitoring
        </Link>
        <div className="flex items-center gap-4">
          {isGuest && (
            <span className="text-warn text-xs px-2 py-1 rounded bg-warn/20">Guest Mode</span>
          )}
          <span className="text-slate-400 text-sm">Dashboard</span>
          <button
            onClick={logout}
            className="text-slate-400 hover:text-white text-sm"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
