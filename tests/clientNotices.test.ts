import { describe, expect, it } from 'vitest';
import { buildClientNotices, noticeAlertLevel, type NoticeInput } from '@/lib/clientNotices';

const now = new Date('2026-11-05T12:00:00Z');
const base = (over: Partial<NoticeInput> = {}): NoticeInput => ({
  user: { id: 'u1', status: 'INVITED', createdAt: '2026-10-01T00:00:00.000Z', invitedAt: null, lastLoginAt: null, hasCompany: true },
  invitation: { state: 'none', at: null }, invitationJob: null, emails: [], projects: [], invoices: [], ...over,
});
const ids = (i: NoticeInput) => buildClientNotices(i, now).map((n) => n.id);

describe('invitation notices', () => {
  it('a failed invitation is an error with the reason and a resend action', () => {
    const [n] = buildClientNotices(base({ invitation: { state: 'failed', at: '2026-11-01T00:00:00.000Z' }, invitationJob: { status: 'DEAD', attempts: 8, lastError: 'SMTP 550 mailbox unavailable', sentAt: null, createdAt: '2026-11-01T00:00:00.000Z' } }), now);
    expect(n).toMatchObject({ id: 'invitation-failed', severity: 'error', title: 'Invitation email failed', action: { kind: 'resend-invite' } });
    expect(n.detail).toContain('8 times');
    expect(n.detail).toContain('SMTP 550 mailbox unavailable');
  });
  it('truncates very long error text', () => {
    const [n] = buildClientNotices(base({ invitation: { state: 'failed', at: null }, invitationJob: { status: 'DEAD', attempts: 1, lastError: 'x'.repeat(2000), sentAt: null, createdAt: '2026-11-01T00:00:00.000Z' } }), now);
    expect(n.detail!.length).toBeLessThan(400);
  });
  it('covers expired, queued, retrying, sent and never-invited', () => {
    expect(ids(base({ invitation: { state: 'expired', at: null } }))).toContain('invitation-expired');
    expect(ids(base({ invitation: { state: 'pending', at: null }, invitationJob: { status: 'PENDING', attempts: 0, lastError: null, sentAt: null, createdAt: '2026-11-05T00:00:00.000Z' } }))).toContain('invitation-pending');
    const retry = buildClientNotices(base({ invitation: { state: 'pending', at: null }, invitationJob: { status: 'RETRY', attempts: 2, lastError: 'timeout', sentAt: null, createdAt: '2026-11-05T00:00:00.000Z' } }), now).find((n) => n.id === 'invitation-pending')!;
    expect(retry.severity).toBe('warning');
    const sent = buildClientNotices(base({ invitation: { state: 'sent', at: '2026-11-03T12:00:00.000Z' }, invitationJob: { status: 'SENT', attempts: 1, lastError: null, sentAt: '2026-11-03T12:00:00.000Z', createdAt: '2026-11-03T12:00:00.000Z' } }), now).find((n) => n.id === 'invitation-sent')!;
    expect(sent.detail).toContain('expires in 5 days');
    expect(ids(base())).toContain('invitation-none');
  });
  it('has no invitation notice once the account is active, and the failure disappears when fixed', () => {
    const active = base({ user: { ...base().user, status: 'ACTIVE', lastLoginAt: '2026-11-04T00:00:00.000Z' }, invitation: { state: 'accepted', at: null } });
    expect(ids(active).filter((i) => i.startsWith('invitation'))).toEqual([]);
  });
});

describe('other notices', () => {
  it('flags undelivered email, overdue invoices, duplicate numbers and overdue projects', () => {
    const list = buildClientNotices(base({
      user: { ...base().user, status: 'ACTIVE' },
      emails: [{ id: 'e1', label: 'Password reset link', status: 'DEAD', attempts: 8, lastError: 'bounced', createdAt: '2026-11-02T00:00:00.000Z' }, { id: 'e2', label: 'Password reset code', status: 'SENT', attempts: 1, lastError: null, createdAt: '2026-11-02T00:00:00.000Z' }],
      invoices: [{ id: 'i1', invoiceNumber: 'DS-1', status: 'Not Paid', dueDate: '2026-10-25', numberConflict: false }, { id: 'i2', invoiceNumber: 'DS-2', status: 'Paid', dueDate: '2026-01-01', numberConflict: false }, { id: 'i3', invoiceNumber: 'DS-3', status: 'Not Paid', dueDate: '2026-12-01', numberConflict: true }],
      projects: [{ id: 'p1', name: 'Site', status: 'IN_PROGRESS', targetEndDate: '2026-11-01T00:00:00.000Z' }, { id: 'p2', name: 'Logo', status: 'COMPLETED', targetEndDate: '2026-01-01T00:00:00.000Z' }],
    }), now);
    const got = list.map((n) => n.id);
    expect(got).toContain('email-e1');
    expect(got).not.toContain('email-e2');
    expect(got).toContain('invoice-overdue-i1');
    expect(got).not.toContain('invoice-overdue-i2');
    expect(got).not.toContain('invoice-overdue-i3');
    expect(got).toContain('invoice-conflict-i3');
    expect(got).toContain('project-due-p1');
    expect(got).not.toContain('project-due-p2');
    expect(list.find((n) => n.id === 'invoice-overdue-i1')!.detail).toBe('Due 2026-10-25, 11 days ago.');
  });
  it('notes suspended accounts, missing company and never-signed-in', () => {
    expect(ids(base({ user: { ...base().user, status: 'SUSPENDED', hasCompany: false } }))).toEqual(expect.arrayContaining(['account-suspended', 'account-no-company']));
    expect(ids(base({ user: { ...base().user, status: 'ACTIVE' } }))).toContain('account-never-signed-in');
  });
});

describe('ordering and alert level', () => {
  it('lists errors first, then warnings, then information, always ending with the record-created note', () => {
    const list = buildClientNotices(base({ invitation: { state: 'failed', at: null }, invitationJob: { status: 'DEAD', attempts: 8, lastError: null, sentAt: null, createdAt: '2026-11-01T00:00:00.000Z' }, user: { ...base().user, hasCompany: false } }), now);
    expect(list.map((n) => n.severity)).toEqual([...list.map((n) => n.severity)].sort((a, b) => ['error', 'warning', 'info', 'success'].indexOf(a) - ['error', 'warning', 'info', 'success'].indexOf(b)));
    expect(list[0].id).toBe('invitation-failed');
    expect(list.some((n) => n.id === 'account-created')).toBe(true);
  });
  it('alert level ignores plain information', () => {
    expect(noticeAlertLevel(buildClientNotices(base({ invitation: { state: 'failed', at: null } }), now))).toBe('error');
    expect(noticeAlertLevel(buildClientNotices(base({ user: { ...base().user, status: 'SUSPENDED' } }), now))).toBe('warning');
    expect(noticeAlertLevel(buildClientNotices(base({ user: { ...base().user, status: 'ACTIVE', lastLoginAt: '2026-11-04T00:00:00.000Z' }, invitation: { state: 'accepted', at: null }, projects: [{ id: 'p', name: 'x', status: 'IN_PROGRESS', targetEndDate: null }] }), now))).toBeNull();
  });
});
