import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PPE Monitoring | Construction Site Safety',
  description: 'Real-time CCTV PPE detection for construction sites',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="antialiased">
      <body className="min-h-screen bg-surface font-sans text-slate-200">
        {children}
      </body>
    </html>
  );
}
