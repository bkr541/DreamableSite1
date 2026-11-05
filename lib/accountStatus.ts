// Account lifecycle policy for users.status. Anything not listed here is treated
// as NOT loginable, so an unexpected or legacy value fails closed.
//
//   INVITED   -> created/approved, setup not finished. Cannot sign in. May finish setup with an emailed link/code,
//                which moves it to ACTIVE.
//   ACTIVE    -> can sign in and reset their password (stays ACTIVE).
//   SUSPENDED -> blocked by an admin. Cannot sign in and cannot be reactivated by any password flow.
//                Only an admin action moves it back.

export const USER_STATUSES = ['INVITED', 'ACTIVE', 'SUSPENDED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const isUserStatus = (s: unknown): s is UserStatus =>
  typeof s === 'string' && (USER_STATUSES as readonly string[]).includes(s);

/** May hold a session / sign in. */
export const canSignIn = (status: string) => status === 'ACTIVE';

/** May receive and use a password link/code (recovery for ACTIVE, first-time setup for INVITED). */
export const canUsePasswordFlow = (status: string) => status === 'ACTIVE' || status === 'INVITED';

/** Status a user ends up in after a successful password flow. Never reactivates anything else. */
export const statusAfterPasswordFlow = (status: string): 'ACTIVE' | null =>
  status === 'ACTIVE' || status === 'INVITED' ? 'ACTIVE' : null;

/** Where an admin "unsuspend" lands: back to ACTIVE if they ever signed in, otherwise back to INVITED. */
export const statusAfterUnsuspend = (lastLoginAt: Date | null): 'ACTIVE' | 'INVITED' =>
  lastLoginAt ? 'ACTIVE' : 'INVITED';
