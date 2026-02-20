'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  function goToDashboardAsGuest() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ppe_guest', 'true');
    }
    router.push('/dashboard');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold text-accent">PPE Monitoring</h1>
      <p className="text-slate-400">Construction site safety — real-time PPE detection</p>
      <div className="flex flex-wrap gap-4 justify-center">
        <Link
          href="/login"
          className="rounded-lg bg-accent px-6 py-3 text-surface font-medium hover:opacity-90"
        >
          Log in
        </Link>
        <button
          type="button"
          onClick={goToDashboardAsGuest}
          className="rounded-lg border border-slate-600 text-slate-300 px-6 py-3 font-medium hover:bg-slate-800"
        >
          Open Dashboard (no backend)
        </button>
      </div>
      <p className="text-slate-500 text-sm max-w-md text-center">
        Use &quot;Open Dashboard&quot; to run Live AI Detection with your camera when the backend is not running.
      </p>
    </div>
  );
}
