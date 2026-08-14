import { useEffect, useState } from 'react';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string };

interface UseApiDataOptions {
  cacheKey: string;
  refreshIntervalMs?: number;
}

interface RefreshApiDataOptions {
  cacheKey: string;
  maxAgeMs?: number;
  force?: boolean;
}

interface CacheEntry<T> {
  state: AsyncState<T>;
  loader: () => Promise<T>;
  listeners: Set<(state: AsyncState<T>) => void>;
  inFlight: Promise<void> | null;
  lastUpdatedAt: number;
  refreshIntervalMs: number;
  timer: number | null;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCacheEntry<T>(cacheKey: string, loader: () => Promise<T>, refreshIntervalMs: number): CacheEntry<T> {
  const existing = cache.get(cacheKey) as CacheEntry<T> | undefined;
  if (existing) {
    existing.loader = loader;
    existing.refreshIntervalMs = refreshIntervalMs;
    return existing;
  }
  const entry: CacheEntry<T> = {
    state: { status: 'loading' },
    loader,
    listeners: new Set(),
    inFlight: null,
    lastUpdatedAt: 0,
    refreshIntervalMs,
    timer: null,
  };
  cache.set(cacheKey, entry as CacheEntry<unknown>);
  return entry;
}

function publish<T>(entry: CacheEntry<T>, state: AsyncState<T>) {
  entry.state = state;
  for (const listener of entry.listeners) listener(state);
}

function refresh<T>(entry: CacheEntry<T>) {
  if (entry.inFlight) return entry.inFlight;
  entry.inFlight = entry.loader()
    .then((data) => {
      entry.lastUpdatedAt = Date.now();
      publish(entry, { status: 'ready', data });
    })
    .catch((error: unknown) => {
      if (entry.state.status !== 'ready') {
        publish(entry, { status: 'error', message: error instanceof Error ? error.message : '数据不可用' });
      }
    })
    .finally(() => {
      entry.inFlight = null;
    });
  return entry.inFlight;
}

export function refreshApiData<T>(loader: () => Promise<T>, options: RefreshApiDataOptions) {
  const entry = getCacheEntry(options.cacheKey, loader, 0);
  const maxAgeMs = options.maxAgeMs ?? 0;
  const fresh = entry.lastUpdatedAt > 0
    && (maxAgeMs === 0 || Date.now() - entry.lastUpdatedAt < maxAgeMs);
  if (!options.force && fresh) return Promise.resolve();
  return refresh(entry);
}

export function apiDataAgeMs(cacheKey: string, now = Date.now()) {
  const entry = cache.get(cacheKey);
  return entry?.lastUpdatedAt ? Math.max(0, now - entry.lastUpdatedAt) : null;
}

export function readApiData<T>(cacheKey: string) {
  const state = cache.get(cacheKey)?.state;
  return state?.status === 'ready' ? state.data as T : null;
}

export function useApiData<T>(loader: () => Promise<T>, options: UseApiDataOptions): AsyncState<T> {
  const { cacheKey } = options;
  const refreshIntervalMs = options.refreshIntervalMs ?? 0;
  const entry = getCacheEntry(cacheKey, loader, refreshIntervalMs);
  const [state, setState] = useState<AsyncState<T>>(() => entry.state);

  useEffect(() => {
    entry.listeners.add(setState);
    setState(entry.state);
    const stale = entry.lastUpdatedAt === 0
      || (refreshIntervalMs > 0 && Date.now() - entry.lastUpdatedAt >= refreshIntervalMs);
    if (stale) void refresh(entry);
    if (entry.timer === null && refreshIntervalMs > 0) {
      entry.timer = window.setInterval(() => void refresh(entry), refreshIntervalMs);
    }
    return () => {
      entry.listeners.delete(setState);
      if (entry.listeners.size === 0 && entry.timer !== null) {
        window.clearInterval(entry.timer);
        entry.timer = null;
      }
    };
  }, [entry, refreshIntervalMs]);
  return state;
}
