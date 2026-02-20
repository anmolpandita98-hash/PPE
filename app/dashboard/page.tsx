'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  listCameras,
  listViolations,
  startCamera,
  stopCamera,
  getActiveCameras,
  createCamera,
  deleteCamera,
  getMe,
  type Camera,
  type Violation,
} from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { DetectionPayload } from '@/lib/ws';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CameraGrid } from '@/components/CameraGrid';
import { ViolationPanel } from '@/components/ViolationPanel';
import { AddCameraModal } from '@/components/AddCameraModal';
import { HumanDetectionCamera } from '@/components/HumanDetectionCamera';

export default function DashboardPage() {
  const router = useRouter();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [activeIds, setActiveIds] = useState<number[]>([]);
  const [streamByCamera, setStreamByCamera] = useState<Record<number, DetectionPayload>>({});
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [filterCameraId, setFilterCameraId] = useState<number | ''>('');
  const [filterType, setFilterType] = useState('');

  const loadCameras = useCallback(async () => {
    try {
      const list = await listCameras();
      setCameras(list);
    } catch (e) {
      const isGuest = localStorage.getItem('ppe_guest') === 'true';
      if (!isGuest && String(e).includes('401')) {
        router.push('/login');
      }
      // In guest mode, just set empty array if API fails
      if (isGuest) {
        setCameras([]);
      }
    }
  }, [router]);

  const loadViolations = useCallback(async () => {
    try {
      const list = await listViolations({
        camera_id: filterCameraId === '' ? undefined : filterCameraId,
        violation_type: filterType || undefined,
        limit: 50,
      });
      setViolations(list);
    } catch {
      // In guest mode or if API fails, just set empty array
      setViolations([]);
    }
  }, [filterCameraId, filterType]);

  const loadActive = useCallback(async () => {
    try {
      const { camera_ids } = await getActiveCameras();
      setActiveIds(camera_ids);
    } catch {
      setActiveIds([]);
    }
  }, []);

  useEffect(() => {
    // Check if guest mode
    const isGuest = localStorage.getItem('ppe_guest') === 'true';
    if (!isGuest) {
      getMe().catch(() => router.push('/login'));
    }
    async function init() {
      await loadCameras();
      await loadViolations();
      await loadActive();
      
      // Auto-start any cameras that were previously active
      const { camera_ids } = await getActiveCameras().catch(() => ({ camera_ids: [] }));
      if (camera_ids.length > 0) {
        // Ensure active IDs are set
        setActiveIds(camera_ids);
      }
      
      setLoading(false);
    }
    init();
  }, [router, loadCameras, loadViolations, loadActive]);

  useWebSocket((payload) => {
    setStreamByCamera((prev) => ({ ...prev, [payload.camera_id]: payload }));
  });

  async function handleStart(id: number) {
    try {
      await startCamera(id);
      setActiveIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    } catch (err: any) {
      alert(`Failed to start camera: ${err.message || 'Unknown error'}`);
    }
  }

  async function handleStop(id: number) {
    try {
      await stopCamera(id);
      setActiveIds((prev) => prev.filter((x) => x !== id));
      setStreamByCamera((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err: any) {
      alert(`Failed to stop camera: ${err.message || 'Unknown error'}`);
    }
  }

  async function handleAddCamera(data: { name: string; rtsp_url: string; ppe_policy?: Record<string, boolean> }) {
    try {
      const newCamera = await createCamera(data);
      await loadCameras();
      setAddModalOpen(false);
      
      // Automatically start the camera after adding it
      try {
        await startCamera(newCamera.id);
        setActiveIds((prev) => (prev.includes(newCamera.id) ? prev : [...prev, newCamera.id]));
      } catch (startErr: any) {
        // Camera added but failed to start - user can manually start it
        console.warn('Camera added but failed to auto-start:', startErr);
      }
    } catch (err: any) {
      alert(`Failed to add camera: ${err.message || 'Unknown error'}`);
    }
  }

  async function handleDeleteCamera(id: number) {
    await deleteCamera(id);
    await loadCameras();
    setActiveIds((prev) => prev.filter((x) => x !== id));
  }

  useEffect(() => {
    const t = setInterval(loadViolations, 10000);
    return () => clearInterval(t);
  }, [loadViolations]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh] text-slate-400">Loading…</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 h-full">
        {/* Human Detection Camera Section */}
        <HumanDetectionCamera />
        
        {/* Existing Camera Feeds Section */}
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Live feeds</h2>
              <button
                onClick={() => setAddModalOpen(true)}
                className="rounded-lg bg-accent px-4 py-2 text-surface text-sm font-medium hover:opacity-90"
              >
                Add camera
              </button>
            </div>
            <CameraGrid
              cameras={cameras}
              streamByCamera={streamByCamera}
              activeIds={activeIds}
              onStart={handleStart}
              onStop={handleStop}
              onDelete={handleDeleteCamera}
            />
          </div>
          <ViolationPanel
            violations={violations}
            cameras={cameras}
            filterCameraId={filterCameraId}
            filterType={filterType}
            onFilterCameraChange={setFilterCameraId}
            onFilterTypeChange={setFilterType}
            onRefresh={loadViolations}
          />
        </div>
      </div>
      {addModalOpen && (
        <AddCameraModal
          onClose={() => setAddModalOpen(false)}
          onAdd={handleAddCamera}
        />
      )}
    </DashboardLayout>
  );
}
