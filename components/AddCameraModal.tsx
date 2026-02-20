'use client';

import { useState } from 'react';

const DEFAULT_POLICY = { hardhat: true, vest: true, gloves: false, glasses: true };

interface AddCameraModalProps {
  onClose: () => void;
  onAdd: (data: { name: string; rtsp_url: string; ppe_policy?: Record<string, boolean> }) => Promise<void>;
}

export function AddCameraModal({ onClose, onAdd }: AddCameraModalProps) {
  const [name, setName] = useState('');
  const [rtspUrl, setRtspUrl] = useState('');
  const [policy, setPolicy] = useState(DEFAULT_POLICY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onAdd({ name, rtsp_url: rtspUrl, ppe_policy: policy });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add camera');
    } finally {
      setLoading(false);
    }
  }

  function togglePolicy(key: keyof typeof policy) {
    setPolicy((p) => ({ ...p, [key]: !p[key] }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-card border border-slate-700 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-white mb-4">Add camera</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-surface border border-slate-600 px-3 py-2 text-white focus:border-accent focus:outline-none"
              placeholder="e.g. Gate North"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">RTSP URL</label>
            <input
              type="url"
              value={rtspUrl}
              onChange={(e) => setRtspUrl(e.target.value)}
              className="w-full rounded-lg bg-surface border border-slate-600 px-3 py-2 text-white focus:border-accent focus:outline-none"
              placeholder="rtsp://user:pass@host:554/stream"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">PPE required</label>
            <div className="flex flex-wrap gap-2">
              {(['hardhat', 'vest', 'gloves', 'glasses'] as const).map((key) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policy[key]}
                    onChange={() => togglePolicy(key)}
                    className="rounded border-slate-600 bg-surface text-accent focus:ring-accent"
                  />
                  <span className="text-sm text-slate-300 capitalize">{key}</span>
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-danger text-sm">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-accent px-4 py-2 text-surface font-medium hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Adding…' : 'Add camera'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
