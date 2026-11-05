// The inquiry review rules in one place (used by the approve, reject and reopen routes and mirrored by the UI).
//
//   INQUIRY  --approve-->  APPROVED     creates client + company + project, queues the invitation
//   INQUIRY  --reject--->  REJECTED     closes the lead; creates nothing; nothing is emailed
//   REJECTED --reopen--->  INQUIRY      the only way back, so a rejection is never silently overridden
//   APPROVED --reject--->  (refused)    it already has a client and project; manage those instead
//   archived inquiries                  can't be approved, rejected or reopened until restored
export type ReviewAction = 'approve' | 'reject' | 'reopen';

export type Verdict = { ok: true } | { ok: false; code: 'ARCHIVED' | 'REJECTED' | 'APPROVED' | 'NOT_REJECTED'; error: string };

export function canReview(inquiry: { status: string; archivedAt: Date | null }, action: ReviewAction): Verdict {
  if (inquiry.archivedAt) return { ok: false, code: 'ARCHIVED', error: 'Restore this inquiry before reviewing it.' };
  switch (action) {
    case 'approve':
      if (inquiry.status === 'REJECTED') return { ok: false, code: 'REJECTED', error: 'This inquiry was rejected. Reopen it first if you want to approve it.' };
      return { ok: true };
    case 'reject':
      if (inquiry.status === 'APPROVED') return { ok: false, code: 'APPROVED', error: 'This inquiry is already approved and has a client and project. Archive it or manage the project instead.' };
      return { ok: true };
    case 'reopen':
      if (inquiry.status !== 'REJECTED') return { ok: false, code: 'NOT_REJECTED', error: 'Only a rejected inquiry can be reopened.' };
      return { ok: true };
  }
}
