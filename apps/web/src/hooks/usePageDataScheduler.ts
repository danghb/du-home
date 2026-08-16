import { useEffect } from 'react';
import { api } from '../services/api';
import { apiDataAgeMs, refreshApiData } from './useApiData';

interface PageDefinition {
  id: string;
}

interface ScheduledResource {
  cacheKey: string;
  loader: () => Promise<unknown>;
  baseIntervalMs: number;
  pageIds: string[];
}

const resources: ScheduledResource[] = [
  { cacheKey: 'dashboard', loader: api.dashboard, baseIntervalMs: 30_000, pageIds: ['home'] },
  { cacheKey: 'weather', loader: api.weather, baseIntervalMs: 5 * 60_000, pageIds: ['home', 'weather', 'status', 'photos'] },
  { cacheKey: 'status', loader: api.status, baseIntervalMs: 30_000, pageIds: ['status'] },
  { cacheKey: 'photos', loader: api.photos, baseIntervalMs: 60 * 60_000, pageIds: ['home', 'photos'] },
];

export function circularPageDistance(currentIndex: number, targetIndex: number, pageCount: number) {
  if (pageCount <= 1) return 0;
  const directDistance = Math.abs(currentIndex - targetIndex);
  return Math.min(directDistance, pageCount - directDistance);
}

export function distanceFromPages(currentPageId: string, targetPageIds: string[], pages: PageDefinition[]) {
  const currentIndex = Math.max(0, pages.findIndex((page) => page.id === currentPageId));
  const distances = targetPageIds
    .map((pageId) => pages.findIndex((page) => page.id === pageId))
    .filter((index) => index >= 0)
    .map((index) => circularPageDistance(currentIndex, index, pages.length));
  return distances.length ? Math.min(...distances) : 0;
}

export function refreshIntervalForDistance(baseIntervalMs: number, distance: number) {
  return baseIntervalMs * (Math.max(0, distance) + 1);
}

export function usePageDataScheduler(currentPageId: string, pages: PageDefinition[]) {
  const pageOrderKey = pages.map((page) => page.id).join('|');

  useEffect(() => {
    let active = true;
    const timers = new Set<number>();

    const schedule = async (resource: ScheduledResource) => {
      const distance = distanceFromPages(currentPageId, resource.pageIds, pages);
      const intervalMs = refreshIntervalForDistance(resource.baseIntervalMs, distance);
      await refreshApiData(resource.loader, { cacheKey: resource.cacheKey, maxAgeMs: intervalMs });
      if (!active) return;
      const ageMs = apiDataAgeMs(resource.cacheKey);
      const delayMs = ageMs === null ? intervalMs : Math.max(1_000, intervalMs - ageMs);
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        void schedule(resource);
      }, delayMs);
      timers.add(timer);
    };

    resources.forEach((resource) => void schedule(resource));
    return () => {
      active = false;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [currentPageId, pageOrderKey]);
}
