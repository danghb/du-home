import { describe, expect, it } from 'vitest';
import type { TodoItem } from '@family-display/contracts';
import { presentMemo, selectDisplayedMemos } from './memo-display';

const now = new Date('2026-08-13T09:00:00+08:00');
const item = (id: string, due: TodoItem['due'], description: string | null = null): TodoItem => ({ id, summary: id, description, due, completed: false });

describe('memo presentation', () => {
  it('formats relative dates and times in the family timezone', () => {
    expect(presentMemo(item('late', { kind: 'date', value: '2026-08-11' }), now).label).toBe('逾期 2 天');
    expect(presentMemo(item('today', { kind: 'datetime', value: '2026-08-13T19:30:00+08:00' }), now).label).toBe('今天 19:30');
    expect(presentMemo(item('tomorrow', { kind: 'date', value: '2026-08-14' }), now).label).toBe('明天');
    expect(presentMemo(item('later', { kind: 'date', value: '2026-08-19' }), now).label).toBe('6天后');
    expect(presentMemo(item('future', { kind: 'date', value: '2026-08-28' }), now).label).toBe('8月28日');
  });

  it('sorts dated items before undated notes and respects the card height budget', () => {
    const result = selectDisplayedMemos([
      item('none', null),
      item('third', { kind: 'date', value: '2026-08-16' }, '备注'),
      item('first', { kind: 'date', value: '2026-08-13' }, '备注'),
      item('second', { kind: 'date', value: '2026-08-14' }, '备注'),
      item('fourth', { kind: 'date', value: '2026-08-17' }),
    ], now);
    expect(result.visible.map((memo) => memo.item.id)).toEqual(['first', 'second', 'third']);
    expect(result.hiddenCount).toBe(2);
    expect(result.totalCount).toBe(5);
  });
});
