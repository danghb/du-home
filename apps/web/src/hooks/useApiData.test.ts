import { describe, expect, it } from 'vitest';
import { apiDataAgeMs, refreshApiData } from './useApiData';

describe('shared API data cache', () => {
  it('reuses a recent background response instead of requesting it twice', async () => {
    let calls = 0;
    const loader = async () => ({ value: ++calls });
    const cacheKey = `prefetch-test-${Math.random()}`;

    await refreshApiData(loader, { cacheKey, maxAgeMs: 30_000 });
    await refreshApiData(loader, { cacheKey, maxAgeMs: 30_000 });

    expect(calls).toBe(1);
    expect(apiDataAgeMs(cacheKey)).not.toBeNull();
  });
});
