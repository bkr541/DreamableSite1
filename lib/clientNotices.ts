// Everything an admin should know about one client, in one list: invitation problems, undelivered emails, overdue
// invoices and projects, suspended accounts and plain information. Notices are DERIVED from facts we already store
// (the account, its invitation email, other emails to it, its invoices and projects), so there is nothing extra to keep
// in sync, and a notice disappears as soon as the underlying problem is fixed.
//
// To add a kind of notice, add a rule in buildClientNotices() and a test; the screen renders whatever comes back.
import type { InvitationState } from '@/lib/invitations';
import { INVITE_TTL_MS } from '@/lib/invitations';
import { dueBadge } from '@/lib/projectDue';

export type NoticeSeverity = 'error' | 'warning' | 'info' | 'success';
export type NoticeCategory = 'invitation' | 'account' | 'email' | 'billing' | 'projects';

export interface ClientNotice {
  id: string;
  severity: NoticeSeverity;
  category: NoticeCategory;
  title: string;
  detail: string | null;
  /** When it happened (ISO), if that is meaningful. */
  at: string | null;
  /** A one-click fix or a place to look. */
  action?: { kind: 'resend-invite' | 'open-project' | 'open-billing'; label: string; projectId?: string };
}

export interface NoticeInput {
  user: { id: string; status: string; createdAt: string; invitedAt: string | null; lastLoginAt: string | null; hasCompany: boolean };
  invitation: { state: InvitationState; at: string | null };
  /** The latest invitation email, if any. */
  invitationJob: { status: string; attempts: number; lastError: string | null; sentAt: string | null; createdAt: string } | null;
  /** Other emails sent to this client (password resets, confirmations…). */
  emails: { id: string; label: string; status: string; attempts: number; lastError: string | null; createdAt: string }[];
  projects: { id: string; name: string; status: string; targetEndDate: string | null }[];
  invoices: { id: string; invoiceNumber: string; status: string; dueDate: string; numberConflict: boolean }[];
}

const RANK: Record<NoticeSeverity, number> = { error: 0, warning: 1, info: 2, success: 3 };
const DAY = 86_400_000;

/** Server error text can be long and technical; keep enough to be useful, never a wall of text. */
const brief = (s: string | null, max = 240) => (s ? (s.length > max ? `${s.slice(0, max).trimEnd()}…` : s) : null);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function buildClientNotices(input: NoticeInput, now = new Date()): ClientNotice[] {
  const { user, invitation, invitationJob: job, emails, projects, invoices } = input;
  const out: ClientNotice[] = [];
  const add = (n: ClientNotice) => out.push(n);
  const resend = { kind: 'resend-invite' as const, label: 'Send a new invitation' };

  // ── Invitation ────────────────────────────────────────────────────────────────────────────────────────────
  if (user.status === 'INVITED') {
    switch (invitation.state) {
      case 'failed':
        add({
          id: 'invitation-failed', severity: 'error', category: 'invitation', title: 'Invitation email failed',
          detail: job?.status === 'SUPPRESSED'
            ? 'The invitation was deliberately not sent (the address is suppressed).'
            : `We tried ${plural(job?.attempts ?? 0, 'time')} and gave up. The client has not received an invitation.${job?.lastError ? ` Last error: ${brief(job.lastError)}` : ''}`,
          at: invitation.at, action: resend,
        });
        break;
      case 'expired':
        add({ id: 'invitation-expired', severity: 'warning', category: 'invitation', title: 'Invitation expired', detail: 'The link was valid for 7 days and was not used.', at: invitation.at, action: resend });
        break;
      case 'pending': {
        const retrying = (job?.attempts ?? 0) > 0;
        add({
          id: 'invitation-pending', severity: retrying ? 'warning' : 'info', category: 'invitation',
          title: retrying ? 'Invitation is being retried' : 'Invitation queued',
          detail: retrying ? `${plural(job!.attempts, 'attempt')} so far did not go through; it will be tried again automatically.${job?.lastError ? ` Last error: ${brief(job.lastError)}` : ''}` : 'It will be sent in a moment.',
          at: invitation.at,
        });
        break;
      }
      case 'sent': {
        const left = job?.sentAt ? Math.max(0, Math.ceil((new Date(job.sentAt).getTime() + INVITE_TTL_MS - now.getTime()) / DAY)) : null;
        add({
          id: 'invitation-sent', severity: 'info', category: 'invitation', title: 'Invitation sent, waiting for the client',
          detail: `They have not set a password yet.${left === null ? '' : ` The link expires in ${plural(left, 'day')}.`}`, at: invitation.at,
        });
        break;
      }
      default:
        add({ id: 'invitation-none', severity: 'warning', category: 'invitation', title: 'No invitation on record', detail: 'This account was set up before invitations were tracked. Send one so they can choose a password.', at: null, action: resend });
    }
  }

  // ── Account ───────────────────────────────────────────────────────────────────────────────────────────────
  if (user.status === 'SUSPENDED') {
    add({ id: 'account-suspended', severity: 'warning', category: 'account', title: 'Account suspended', detail: 'They cannot sign in until the account is reactivated.', at: null });
  } else if (user.status === 'ACTIVE') {
    add(user.lastLoginAt
      ? { id: 'account-last-login', severity: 'success', category: 'account', title: 'Last signed in', detail: null, at: user.lastLoginAt }
      : { id: 'account-never-signed-in', severity: 'info', category: 'account', title: 'Has not signed in yet', detail: 'The account is active but they have not used the portal.', at: null });
  }
  if (!user.hasCompany) add({ id: 'account-no-company', severity: 'info', category: 'account', title: 'No company on file', detail: null, at: null });

  // ── Other email ───────────────────────────────────────────────────────────────────────────────────────────
  for (const e of emails) {
    if (e.status === 'DEAD') add({ id: `email-${e.id}`, severity: 'error', category: 'email', title: `Email not delivered: ${e.label}`, detail: brief(e.lastError) ?? `We tried ${plural(e.attempts, 'time')} and gave up.`, at: e.createdAt });
    else if (e.status === 'SUPPRESSED') add({ id: `email-${e.id}`, severity: 'info', category: 'email', title: `Email not sent: ${e.label}`, detail: 'It was deliberately not sent.', at: e.createdAt });
    else if (e.status === 'RETRY' && e.attempts > 0) add({ id: `email-${e.id}`, severity: 'warning', category: 'email', title: `Email delayed: ${e.label}`, detail: brief(e.lastError) ?? 'It will be retried automatically.', at: e.createdAt });
  }

  // ── Billing ───────────────────────────────────────────────────────────────────────────────────────────────
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (const inv of invoices) {
    if (inv.status === 'Not Paid') {
      const late = Math.round((today - Date.parse(`${inv.dueDate}T00:00:00Z`)) / DAY);
      if (late > 0) add({ id: `invoice-overdue-${inv.id}`, severity: 'warning', category: 'billing', title: `Invoice ${inv.invoiceNumber} is overdue`, detail: `Due ${inv.dueDate}, ${plural(late, 'day')} ago.`, at: `${inv.dueDate}T00:00:00.000Z`, action: { kind: 'open-billing', label: 'Open billing' } });
    }
    if (inv.numberConflict) add({ id: `invoice-conflict-${inv.id}`, severity: 'warning', category: 'billing', title: `Invoice number ${inv.invoiceNumber} needs review`, detail: 'More than one invoice carries this number.', at: null, action: { kind: 'open-billing', label: 'Open billing' } });
  }

  // ── Projects ──────────────────────────────────────────────────────────────────────────────────────────────
  for (const p of projects) {
    const due = dueBadge(p.status, p.targetEndDate, now);
    if (due && due.tone !== 'slate') add({ id: `project-due-${p.id}`, severity: due.tone === 'red' ? 'warning' : 'info', category: 'projects', title: `${p.name}: ${due.label.toLowerCase()}`, detail: null, at: p.targetEndDate, action: { kind: 'open-project', label: 'Open project', projectId: p.id } });
  }
  if (projects.length === 0 && user.status === 'ACTIVE') add({ id: 'projects-none', severity: 'info', category: 'projects', title: 'No projects yet', detail: null, at: null });

  // ── Always present, so the screen is never blank ──────────────────────────────────────────────────────────
  add({ id: 'account-created', severity: 'info', category: 'account', title: 'Client record created', detail: null, at: user.createdAt });

  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity] || (Date.parse(b.at ?? '') || 0) - (Date.parse(a.at ?? '') || 0));
}

/** How loudly to flag a client in the list: the worst thing on their screen, ignoring plain information. */
export function noticeAlertLevel(notices: ClientNotice[]): 'error' | 'warning' | null {
  if (notices.some((n) => n.severity === 'error')) return 'error';
  if (notices.some((n) => n.severity === 'warning')) return 'warning';
  return null;
}
