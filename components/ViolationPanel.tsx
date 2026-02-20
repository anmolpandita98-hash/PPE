'use client';

import type { Violation, Camera } from '@/lib/api';

interface ViolationPanelProps {
  violations: Violation[];
  cameras: Camera[];
  filterCameraId: number | '';
  filterType: string;
  onFilterCameraChange: (v: number | '') => void;
  onFilterTypeChange: (v: string) => void;
  onRefresh: () => void;
}

export function ViolationPanel({
  violations,
  cameras,
  filterCameraId,
  filterType,
  onFilterCameraChange,
  onFilterTypeChange,
  onRefresh,
}: ViolationPanelProps) {
  const formatTime = (ts: string) => new Date(ts).toLocaleString();

  return (
    <div className="w-full lg:w-96 shrink-0 rounded-xl border border-slate-700 bg-card flex flex-col max-h-[calc(100vh-8rem)]">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-3">Violations</h2>
        <div className="space-y-2">
          <select
            value={filterCameraId === '' ? '' : filterCameraId}
            onChange={(e) => onFilterCameraChange(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full rounded-lg bg-surface border border-slate-600 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
          >
            <option value="">All cameras</option>
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => onFilterTypeChange(e.target.value)}
            className="w-full rounded-lg bg-surface border border-slate-600 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
          >
            <option value="">All types</option>
            <option value="hardhat">Hard hat</option>
            <option value="vest">Vest</option>
            <option value="gloves">Gloves</option>
            <option value="glasses">Glasses</option>
          </select>
          <button
            onClick={onRefresh}
            className="w-full rounded-lg bg-slate-600 hover:bg-slate-500 py-2 text-sm font-medium"
          >
            Refresh
          </button>
        </div>
      </div>
      <ul className="flex-1 overflow-y-auto p-2 space-y-2">
        {violations.length === 0 ? (
          <li className="text-slate-500 text-sm p-4 text-center">No violations recorded</li>
        ) : (
          violations.map((v) => (
            <li
              key={v.id}
              className="rounded-lg border border-slate-700 bg-surface/50 p-3 text-sm"
            >
              <div className="text-slate-400 text-xs mb-1">
                {formatTime(v.timestamp)} · Cam {v.camera_id}
              </div>
              <div className="flex flex-wrap gap-1">
                {v.violation_types.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded bg-danger/20 text-danger text-xs"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
