import { useState, useCallback } from 'react';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: object;
}

export function useApi() {
  const [loading, setLoading] = useState(false);

  const call = useCallback(async <T>(endpoint: string, options: ApiOptions = {}): Promise<T | null> => {
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: options.method || 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return await res.json() as T;
    } catch (e) {
      console.error(`API Error [${endpoint}]:`, e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { call, loading };
}
