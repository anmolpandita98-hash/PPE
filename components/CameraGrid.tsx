'use client';

import type { Camera } from '@/lib/api';
import type { DetectionPayload } from '@/lib/ws';
import { CameraCard } from './CameraCard';

interface CameraGridProps {
  cameras: Camera[];
  streamByCamera: Record<number, DetectionPayload>;
  activeIds: number[];
  onStart: (id: number) => void;
  onStop: (id: number) => void;
  onDelete: (id: number) => void;
}

export function CameraGrid({
  cameras,
  streamByCamera,
  activeIds,
  onStart,
  onStop,
  onDelete,
}: CameraGridProps) {
  if (cameras.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700 bg-card p-8 text-center text-slate-400">
        No cameras yet. Add one to start monitoring.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {cameras.map((cam) => (
        <CameraCard
          key={cam.id}
          camera={cam}
          stream={streamByCamera[cam.id]}
          isActive={activeIds.includes(cam.id)}
          onStart={() => onStart(cam.id)}
          onStop={() => onStop(cam.id)}
          onDelete={() => onDelete(cam.id)}
        />
      ))}
    </div>
  );
}
