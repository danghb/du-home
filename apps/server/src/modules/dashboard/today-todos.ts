import type { TodoItem } from '@family-display/contracts';

function calendarDate(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function selectTodayTodos(
  items: TodoItem[],
  timezone: string,
  now = new Date(),
): TodoItem[] {
  const today = calendarDate(now, timezone);
  return items
    .map((item, originalIndex) => ({ item, originalIndex }))
    .filter(({ item }) => {
      if (item.completed || !item.due) return false;
      if (item.due.kind === 'date') return item.due.value === today;
      return calendarDate(new Date(item.due.value), timezone) === today;
    })
    .sort((a, b) => {
      const aTime = a.item.due?.kind === 'datetime' ? Date.parse(a.item.due.value) : Number.NEGATIVE_INFINITY;
      const bTime = b.item.due?.kind === 'datetime' ? Date.parse(b.item.due.value) : Number.NEGATIVE_INFINITY;
      return aTime - bTime || a.originalIndex - b.originalIndex;
    })
    .map(({ item }) => item);
}
