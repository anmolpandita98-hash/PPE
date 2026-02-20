/**
 * WebSocket URL for real-time detection stream.
 */
export function getWsUrl(): string {
  if (typeof window === 'undefined') return '';
  const base = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || window.location.origin;
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
