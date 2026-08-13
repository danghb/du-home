import type { TodoItem } from '@family-display/contracts';

const TIMEZONE = 'Asia/Hong_Kong';
const DAY_MS = 86_400_000;

export type MemoTone = 'overdue' | 'today' | 'soon' | 'normal';

export interface PresentedMemo {
  item: TodoItem;
  label: string;
  tone: MemoTone;
  sortTime: number;
}

function calendarDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dayNumber(value: string) {
  const [year = 0, month = 1, day = 1] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

function shortDate(value: string, includeYear: boolean) {
  const [year = 0, month = 1, day = 1] = value.split('-').map(Number);
  return includeYear ? `${year}年${month}月${day}日` : `${month}月${day}日`;
}

function dueCalendarDate(item: TodoItem) {
  if (!item.due) return null;
  return item.due.kind === 'date' ? item.due.value : calendarDate(new Date(item.due.value));
}

function dueTime(item: TodoItem) {
  if (item.due?.kind !== 'datetime') return null;
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(item.due.value));
}

export function presentMemo(item: TodoItem, now = new Date()): PresentedMemo {
  const dueDate = dueCalendarDate(item);
  if (!dueDate) return { item, label: '备忘', tone: 'normal', sortTime: Number.POSITIVE_INFINITY };

  const today = calendarDate(now);
  const days = dayNumber(dueDate) - dayNumber(today);
  const time = dueTime(item);
  const suffix = time ? ` ${time}` : '';
  const sortTime = item.due?.kind === 'datetime'
    ? Date.parse(item.due.value)
    : dayNumber(dueDate) * DAY_MS;

  if (days < 0) return { item, label: `逾期 ${Math.abs(days)} 天`, tone: 'overdue', sortTime };
  if (days === 0) return { item, label: `今天${suffix}`, tone: 'today', sortTime };
  if (days === 1) return { item, label: `明天${suffix}`, tone: 'soon', sortTime };
  if (days === 2) return { item, label: `后天${suffix}`, tone: 'soon', sortTime };
  if (days <= 7) return { item, label: `${days}天后${suffix}`, tone: 'soon', sortTime };
  return {
    item,
    label: shortDate(dueDate, dueDate.slice(0, 4) !== today.slice(0, 4)),
    tone: 'normal',
    sortTime,
  };
}

export function selectDisplayedMemos(items: TodoItem[], now = new Date()) {
  const presented = items
    .filter((item) => !item.completed)
    .map((item, originalIndex) => ({ ...presentMemo(item, now), originalIndex }))
    .sort((a, b) => a.sortTime - b.sortTime || a.originalIndex - b.originalIndex);

  const visible: PresentedMemo[] = [];
  let usedHeight = 0;
  for (const memo of presented) {
    const rowHeight = memo.item.description ? 104 : 74;
    if (visible.length >= 5 || usedHeight + rowHeight > 340) break;
    visible.push(memo);
    usedHeight += rowHeight;
  }
  return { visible, hiddenCount: presented.length - visible.length, totalCount: presented.length };
}
