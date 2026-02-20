/**
 * API client for PPE Monitoring backend.
 * Base URL: use env NEXT_PUBLIC_API_URL or fallback to /api/proxy (rewrite to backend).
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? '/api/proxy' : 'http://localhost:8000');

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ppe_token');
}

function getHeaders(includeAuth = true): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const token = getToken();
  const isGuest = typeof window !== 'undefined' && localStorage.getItem('ppe_guest') === 'true';
  // In guest mode, don't require auth
  if (includeAuth && token && !isGuest) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function login(username: string, password: string): Promise<{ access_token: string; token_type: string }> {
  const form = new FormData();
  form.append('username', username);
  form.append('password', password);
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    body: form,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('Invalid credentials');
  return res.json();
}

export async function signup(username: string, password: string): Promise<{ message: string; username: string; id: number }> {
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to create account' }));
    throw new Error(error.detail || 'Failed to create account');
  }
  return res.json();
}

export async function getMe(): Promise<{ username: string; id: number }> {
  const res = await fetch(`${API_BASE}/api/auth/me`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Not authenticated');
  return res.json();
}

export interface Camera {
  id: number;
  name: string;
  rtsp_url: string;
  is_active: boolean;
  ppe_policy: Record<string, boolean>;
}

export async function listCameras(): Promise<Camera[]> {
  const res = await fetch(`${API_BASE}/api/cameras`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch cameras');
  return res.json();
}

export async function createCamera(data: { name: string; rtsp_url: string; ppe_policy?: Record<string, boolean> }): Promise<Camera> {
  const res = await fetch(`${API_BASE}/api/cameras`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create camera');
  return res.json();
}

export async function updateCamera(id: number, data: Partial<Camera>): Promise<Camera> {
  const res = await fetch(`${API_BASE}/api/cameras/${id}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update camera');
  return res.json();
}

export async function deleteCamera(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/cameras/${id}`, { method: 'DELETE', headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to delete camera');
}

export async function startCamera(id: number): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/api/cameras/${id}/start`, { method: 'POST', headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to start camera');
  return res.json();
}

export async function stopCamera(id: number): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/api/cameras/${id}/stop`, { method: 'POST', headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to stop camera');
  return res.json();
}

export async function getActiveCameras(): Promise<{ camera_ids: number[] }> {
  const res = await fetch(`${API_BASE}/api/cameras/active`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch active cameras');
  return res.json();
}

export interface Violation {
  id: number;
  camera_id: number;
  timestamp: string;
  violation_types: string[];
  snapshot_path: string | null;
  metadata: Record<string, unknown> | null;
}

export async function listViolations(params?: {
  from_date?: string;
  to_date?: string;
  camera_id?: number;
  violation_type?: string;
  limit?: number;
  offset?: number;
}): Promise<Violation[]> {
  const sp = new URLSearchParams();
  if (params?.from_date) sp.set('from_date', params.from_date);
  if (params?.to_date) sp.set('to_date', params.to_date);
  if (params?.camera_id != null) sp.set('camera_id', String(params.camera_id));
  if (params?.violation_type) sp.set('violation_type', params.violation_type);
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.offset != null) sp.set('offset', String(params.offset));
  const q = sp.toString();
  const res = await fetch(`${API_BASE}/api/violations${q ? `?${q}` : ''}`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch violations');
  return res.json();
}
