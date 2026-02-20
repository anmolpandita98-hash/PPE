'use client';

import { useState } from 'react';
import type { Camera } from '@/lib/api';
import type { DetectionPayload } from '@/lib/ws';
import { PolicyBadge } from './PolicyBadge';

interface CameraCardProps {
  camera: Camera;
  stream: DetectionPayload | undefined;
  isActive: boolean;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
}

export function CameraCard({ camera, stream, isActive, onStart, onStop, onDelete }: CameraCardProps) {
  const [deleting, setDeleting] = useState(false);

  function handleDelete() {
    if (confirm('Remove this camera?')) {
      setDeleting(true);
      onDelete();
    }
  }

  const snapshot = stream?.snapshot_base64;
  const hasViolation = stream?.violation === true;

  return (
    <div className="rounded-xl border border-slate-700 bg-card overflow-hidden flex flex-col">
      <div className="p-3 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-white truncate">{camera.name}</span>
          {hasViolation && (
            <span className="shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-danger/20 text-danger">
              Violation
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isActive ? (
            <button
              onClick={onStop}
              className="rounded-lg bg-danger/20 text-danger px-3 py-1.5 text-sm font-medium hover:bg-danger/30"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={onStart}
              className="rounded-lg bg-accent/20 text-accent px-3 py-1.5 text-sm font-medium hover:bg-accent/30"
            >
              Start
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-slate-500 hover:text-danger text-sm disabled:opacity-50"
            title="Delete camera"
          >
            Delete
          </button>
        </div>
      </div>
      <div className="aspect-video bg-black relative flex items-center justify-center min-h-[200px]">
        {snapshot ? (
          <img
            src={`data:image/jpeg;base64,${snapshot}`}
            alt={camera.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-slate-600 text-sm">
            {isActive ? 'Connecting…' : 'Stopped'}
          </div>
        )}
      </div>
      <div className="p-2 flex flex-wrap gap-1">
        {Object.entries(camera.ppe_policy || {}).map(([key, required]) => (
          <PolicyBadge key={key} name={key} required={required} />
        ))}
      </div>
    </div>
  );
}
