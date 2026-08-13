import { describe, expect, it } from 'vitest';
import type { TodoItem } from '@family-display/contracts';
import { selectTodayTodos } from './today-todos.js';

describe('selectTodayTodos', () => {
  it('keeps date-only values in the family calendar timezone', () => {
    const items: TodoItem[] = [
      { id: 'date', summary: '纯日期事项', description: null, due: { kind: 'date', value: '2026-08-12' }, completed: false },
      { id: 'late', summary: '今晚事项', description: null, due: { kind: 'datetime', value: '2026-08-12T20:00:00+08:00' }, completed: false },
      { id: 'yesterday', summary: '昨天事项', description: null, due: { kind: 'date', value: '2026-08-11' }, completed: false },
      { id: 'done', summary: '已完成事项', description: null, due: { kind: 'date', value: '2026-08-12' }, completed: true },
    ];

    const result = selectTodayTodos(items, 'Asia/Hong_Kong', new Date('2026-08-12T01:00:00Z'));
    expect(result.map((item) => item.id)).toEqual(['date', 'late']);
  });
});
