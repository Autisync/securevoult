'use client';

import { useState, useCallback } from 'react';
import { AuthService } from '@/lib/auth';
import { getStoredSessionId } from '@/lib/auth';

export interface DeviceSession {
  sessionId: string;
  clientType: 'web' | 'extension' | 'mobile';
  deviceLabel: string;
  lastSeenAt: string;
  createdAt: string;
  isCurrent: boolean;
}

interface UseDeviceSessionsReturn {
  sessions: DeviceSession[];
  loading: boolean;
  error: string | null;
  fetchSessions: () => Promise<void>;
  revokeSession: (sessionId: string) => Promise<void>;
  revokeOtherSessions: () => Promise<void>;
}

async function authedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await AuthService.getIdToken();
  const sessionId = getStoredSessionId();
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
}

export function useDeviceSessions(): UseDeviceSessionsReturn {
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch('/api/sessions');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? 'Failed to load sessions');
      }
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  const revokeSession = useCallback(async (sessionId: string) => {
    await authedFetch('/api/sessions/revoke', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
    setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
  }, []);

  const revokeOtherSessions = useCallback(async () => {
    await authedFetch('/api/sessions/revoke', {
      method: 'POST',
      body: JSON.stringify({ revokeOthers: true }),
    });
    setSessions((prev) => prev.filter((s) => s.isCurrent));
  }, []);

  return { sessions, loading, error, fetchSessions, revokeSession, revokeOtherSessions };
}
