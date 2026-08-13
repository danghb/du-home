import { useEffect, useState } from 'react';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string };

interface UseApiDataOptions {
  refreshIntervalMs?: number;
}

export function useApiData<T>(loader: () => Promise<T>, options: UseApiDataOptions = {}): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const refreshIntervalMs = options.refreshIntervalMs ?? 0;
  useEffect(() => {
    let active = true;
    let requestInProgress = false;
    const refresh = async () => {
      if (requestInProgress) return;
      requestInProgress = true;
      try {
        const data = await loader();
        if (active) setState({ status: 'ready', data });
      } catch (error: unknown) {
        if (active) setState((previous) => previous.status === 'ready'
          ? previous
          : { status: 'error', message: error instanceof Error ? error.message : '数据不可用' });
      } finally {
        requestInProgress = false;
      }
    };
    void refresh();
    const timer = refreshIntervalMs > 0 ? window.setInterval(() => void refresh(), refreshIntervalMs) : null;
    return () => {
      active = false;
      if (timer !== null) window.clearInterval(timer);
    };
  }, [loader, refreshIntervalMs]);
  return state;
}
