// How close a project is to its target end date. Dates are calendar days (no time of day), so everything is compared in UTC.
const DAY = 86_400_000;
const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/** "Overdue by 3 days" / "Due in 5 days" / "Due today", or null when there is nothing to show (no target, or finished/cancelled). */
export function dueBadge(status: string, targetEndDate: string | null | undefined, now = new Date()): { label: string; tone: 'red' | 'amber' | 'slate' } | null {
  if (!targetEndDate || status === 'COMPLETED' || status === 'CANCELLED') return null;
  const days = Math.round((utcDay(new Date(targetEndDate)) - utcDay(now)) / DAY);
  const n = (v: number) => `${v} day${v === 1 ? '' : 's'}`;
  if (days < 0) return { label: `Overdue by ${n(-days)}`, tone: 'red' };
  if (days === 0) return { label: 'Due today', tone: 'amber' };
  if (days <= 7) return { label: `Due in ${n(days)}`, tone: 'amber' };
  return { label: `Due in ${n(days)}`, tone: 'slate' };
}
