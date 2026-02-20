'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { getWsUrl } from '@/lib/ws';
import type { DetectionPayload } from '@/lib/ws';

export function useWebSocket(onMessage: (payload: DetectionPayload) => void) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    const url = getWsUrl();
    if (!url) return;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as DetectionPayload;
        onMessageRef.current(data);
      } catch {
        // ignore
      }
    };
    return () => {
      ws.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, []);

  useEffect(() => {
    const cleanup = connect();
    return () => cleanup?.();
  }, [connect]);

  return { connected, reconnect: connect };
}
