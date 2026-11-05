import { describe, expect, it } from 'vitest';
import { dueBadge } from '@/lib/projectDue';

const now = new Date('2026-11-05T23:30:00-08:00'); // already Nov 6 in UTC: calendar days are compared in UTC

describe('project due badge', () => {
  it('warns when overdue, due today or due within a week', () => {
    expect(dueBadge('IN_PROGRESS', '2026-11-03T00:00:00.000Z', now)).toEqual({ label: 'Overdue by 3 days', tone: 'red' });
    expect(dueBadge('IN_PROGRESS', '2026-11-05T00:00:00.000Z', now)).toEqual({ label: 'Overdue by 1 day', tone: 'red' });
    expect(dueBadge('REVIEW', '2026-11-06T00:00:00.000Z', now)).toEqual({ label: 'Due today', tone: 'amber' });
    expect(dueBadge('ONBOARDING', '2026-11-13T00:00:00.000Z', now)).toEqual({ label: 'Due in 7 days', tone: 'amber' });
  });
  it('is quiet when the date is far off', () => {
    expect(dueBadge('IN_PROGRESS', '2026-12-25T00:00:00.000Z', now)).toEqual({ label: 'Due in 49 days', tone: 'slate' });
  });
  it('shows nothing without a target date or once the project is finished or cancelled', () => {
    expect(dueBadge('IN_PROGRESS', null, now)).toBeNull();
    expect(dueBadge('IN_PROGRESS', undefined, now)).toBeNull();
    expect(dueBadge('COMPLETED', '2026-01-01T00:00:00.000Z', now)).toBeNull();
    expect(dueBadge('CANCELLED', '2026-01-01T00:00:00.000Z', now)).toBeNull();
  });
});
