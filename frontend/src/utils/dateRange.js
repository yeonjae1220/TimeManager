import { DateTime } from 'luxon';

export function getDailyRange(date) {
  const d = DateTime.fromJSDate(date).startOf('day');
  return { start: d.toISODate(), end: d.toISODate() };
}

export function getWeeklyRange(date) {
  const d = DateTime.fromJSDate(date);
  const start = d.startOf('week');
  const end = d.endOf('week');
  return { start: start.toISODate(), end: end.toISODate() };
}

export function getMonthlyRange(date) {
  const d = DateTime.fromJSDate(date);
  const start = d.startOf('month');
  const end = d.endOf('month');
  return { start: start.toISODate(), end: end.toISODate() };
}

export function formatRangeLabel(tab, date) {
  const d = DateTime.fromJSDate(date);
  if (tab === 'daily') return d.toFormat('yyyy-MM-dd');
  if (tab === 'weekly') {
    const start = d.startOf('week');
    const end = d.endOf('week');
    return `${start.toFormat('MM/dd')} – ${end.toFormat('MM/dd')}`;
  }
  return d.toFormat('yyyy년 M월');
}

export function shiftDate(tab, date, direction) {
  const d = DateTime.fromJSDate(date);
  const delta = direction === 'prev' ? -1 : 1;
  if (tab === 'daily') return d.plus({ days: delta }).toJSDate();
  if (tab === 'weekly') return d.plus({ weeks: delta }).toJSDate();
  return d.plus({ months: delta }).toJSDate();
}

export function formatSeconds(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
