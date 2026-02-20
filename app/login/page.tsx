'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, signup } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [isSignup, setIsSignup] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (isSignup) {
        await signup(username, password);
        setSuccess('Account created! Please sign in.');
        setIsSignup(false);
        setPassword('');
      } else {
        const { access_token } = await login(username, password);
        localStorage.setItem('ppe_token', access_token);
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || (isSignup ? 'Failed to create account' : 'Invalid username or password'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl bg-card border border-slate-700 p-8 shadow-xl">
        <h1 className="text-xl font-bold text-white mb-2">{isSignup ? 'Create Account' : 'Sign in'}</h1>
        <p className="text-slate-400 text-sm mb-6">
          {isSignup ? 'Create a new account to get started' : 'Sign in to your account'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg bg-surface border border-slate-600 px-3 py-2 text-white focus:border-accent focus:outline-none"
              required
              minLength={3}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-surface border border-slate-600 px-3 py-2 text-white focus:border-accent focus:outline-none"
              required
              minLength={4}
            />
          </div>
          {error && <p className="text-danger text-sm">{error}</p>}
          {success && <p className="text-accent text-sm">{success}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent py-2.5 text-surface font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (isSignup ? 'Creating account…' : 'Signing in…') : (isSignup ? 'Create Account' : 'Sign in')}
          </button>
        </form>
        <div className="mt-4 pt-4 border-t border-slate-700">
          <button
            type="button"
            onClick={() => {
              setIsSignup(!isSignup);
              setError('');
              setSuccess('');
              setPassword('');
            }}
            className="w-full text-slate-400 hover:text-white text-sm transition-colors"
          >
            {isSignup ? (
              <>Already have an account? <span className="text-accent font-medium">Sign in</span></>
            ) : (
              <>Don't have an account? <span className="text-accent font-medium">Sign up</span></>
            )}
          </button>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-700">
          <button
            type="button"
            onClick={() => {
              localStorage.setItem('ppe_guest', 'true');
              router.push('/dashboard');
              router.refresh();
            }}
            className="w-full rounded-lg border-2 border-accent/50 text-accent py-2.5 font-medium hover:bg-accent/10 transition-colors"
          >
            Continue as Guest
          </button>
          <p className="mt-2 text-slate-500 text-xs text-center">Test the dashboard without authentication</p>
        </div>
        {!isSignup && (
          <p className="mt-4 text-slate-500 text-xs text-center">Default: admin / admin</p>
        )}
      </div>
    </div>
  );
}
