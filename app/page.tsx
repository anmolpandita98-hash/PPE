import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 bg-surface">
      <h1 className="text-3xl font-bold text-accent">PPE Monitoring</h1>
      <p className="text-slate-400">Construction site safety — real-time PPE detection</p>
      <Link
        href="/login"
        className="rounded-lg bg-accent px-6 py-3 text-surface font-medium hover:opacity-90"
      >
        Log in
      </Link>
    </div>
  );
}
