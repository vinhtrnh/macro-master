export const SYNC_SECRET = (import.meta as any).env?.VITE_SYNC_SECRET || '';

export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (SYNC_SECRET) headers['x-sync-secret'] = SYNC_SECRET;
  return headers;
}