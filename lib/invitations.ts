// Invitation lifecycle, derived from facts we already store (the account's status + its latest invitation email),
// so there is no separate state to drift out of sync.

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // an invitation link is valid for 7 days

export type InvitationState = 'pending' | 'sent' | 'failed' | 'expired' | 'accepted' | 'none';

export interface InvitationJob { status: string; sentAt: Date | null; createdAt: Date; attempts?: number }

export function invitationState(user: { status: string }, job: InvitationJob | null, now = new Date()): { state: InvitationState; at: Date | null } {
  if (user.status === 'ACTIVE') return { state: 'accepted', at: null };
  if (user.status !== 'INVITED') return { state: 'none', at: null };   // suspended etc.: nothing to resend
  if (!job) return { state: 'none', at: null };                           // invited before invitations existed
  switch (job.status) {
    case 'SENT':
      return job.sentAt && now.getTime() - job.sentAt.getTime() > INVITE_TTL_MS
        ? { state: 'expired', at: job.sentAt }
        : { state: 'sent', at: job.sentAt };
    case 'DEAD':
    case 'SUPPRESSED':
      return { state: 'failed', at: job.createdAt };
    default: // PENDING, SENDING, RETRY
      return { state: 'pending', at: job.createdAt };
  }
}

export const INVITATION_LABEL: Record<InvitationState, string> = {
  pending: 'Invitation queued',
  sent: 'Invitation sent',
  failed: 'Invitation failed',
  expired: 'Invitation expired',
  accepted: 'Accepted',
  none: 'Not invited yet',
};
