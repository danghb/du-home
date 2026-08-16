import { describe, expect, it } from 'vitest';
import { formatLunarDate } from './date-display';

describe('formatLunarDate', () => {
  it('formats lunar month and traditional day names locally', () => {
    expect(formatLunarDate(new Date(2024, 1, 10, 12))).toBe('农历正月初一');
    expect(formatLunarDate(new Date(2024, 1, 24, 12))).toBe('农历正月十五');
  });
});
