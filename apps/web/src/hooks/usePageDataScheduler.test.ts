import { describe, expect, it } from 'vitest';
import { circularPageDistance, distanceFromPages, refreshIntervalForDistance } from './usePageDataScheduler';

const pages = [{ id: 'home' }, { id: 'weather' }, { id: 'status' }, { id: 'photos' }];

describe('page data scheduling distance', () => {
  it('uses the shorter direction around the page loop', () => {
    expect(circularPageDistance(0, 3, 4)).toBe(1);
    expect(circularPageDistance(0, 2, 4)).toBe(2);
  });

  it('uses the nearest page when data appears on multiple pages', () => {
    expect(distanceFromPages('weather', ['home', 'photos'], pages)).toBe(1);
    expect(distanceFromPages('photos', ['home', 'weather'], pages)).toBe(1);
    expect(distanceFromPages('home', ['home', 'photos'], pages)).toBe(0);
  });

  it('multiplies the normal refresh period by distance plus one', () => {
    expect(refreshIntervalForDistance(30_000, 0)).toBe(30_000);
    expect(refreshIntervalForDistance(30_000, 1)).toBe(60_000);
    expect(refreshIntervalForDistance(30_000, 2)).toBe(90_000);
  });
});
