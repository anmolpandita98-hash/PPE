/**
 * WebSocket URL for real-time detection stream.
 * Returns empty string when no backend is configured so we don't try to connect and show "connection failed".
 */
export function getWsUrl(): string {
  if (typeof window === 'undefined') return '';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  // If no backend URL is set, don't connect WebSocket (avoids connection failed when running frontend-only)
  if (!wsUrl && !apiUrl) return '';
  const base = wsUrl || apiUrl || window.location.origin;
  const url = new URL(base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws';
  return url.toString();
}

export interface DetectionPayload {
  camera_id: number;
  camera_name: string;
  timestamp: number;
  detections: Array<{
    bbox: [number, number, number, number];
    compliant: boolean;
    violations: string[];
  }>;
  snapshot_base64?: string | null;
  violation?: boolean;
  violation_types?: string[];
}
