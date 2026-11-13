import type { BeliRecommendations, BeliSearch, BeliStatus, BeliCredentials } from '@trek/shared';

// Bypass mutation queues and Axios error configs: Beli credentials/results are memory-only.
async function request<T>(path = '', method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/integrations/beli${path}`, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'error',
    signal,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Beli request failed.');
  return data as T;
}
export const beliApi = {
  status: (signal?: AbortSignal) => request<BeliStatus>('', 'GET', undefined, signal),
  connect: (body: BeliCredentials, signal?: AbortSignal) =>
    request<BeliStatus>('/connect', 'POST', body, signal),
  sync: (signal?: AbortSignal) => request<BeliStatus>('/sync', 'POST', undefined, signal),
  disconnect: (signal?: AbortSignal) => request<BeliStatus>('', 'DELETE', undefined, signal),
  recommendations: (body: BeliSearch, signal?: AbortSignal) =>
    request<BeliRecommendations>('/recommendations', 'POST', body, signal),
};
