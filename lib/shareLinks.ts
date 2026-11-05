import { randomBytes } from 'crypto';

// Share links are bearer URLs, so their only protection is the token. The rules:
//   • tokens are 192 random bits, unique in the database
//   • a token is never reused: turning sharing OFF replaces it, turning sharing ON issues a fresh one, and
//     "Rotate link" replaces it on demand — so a URL that has leaked can't be revived by toggling sharing
//   • every public lookup matches on the current token AND isPublic, so an old URL is simply "not found"
export const newShareToken = () => randomBytes(24).toString('base64url');

export type ShareReason = 'rotate' | 'revoke' | 'enable';

/** Fields to write when the link changes. */
export function shareChange(reason: ShareReason, now = new Date()) {
  return {
    shareToken: newShareToken(),
    shareRotatedAt: now,
    ...(reason === 'revoke' ? { isPublic: false } : reason === 'enable' ? { isPublic: true } : {}),
  };
}
