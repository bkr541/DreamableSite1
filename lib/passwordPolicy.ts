// One rule for every place a password is chosen (invitation, reset, change). Returns a message or null.
const COMMON = new Set([
  'password', 'password1', 'password12', 'password123', 'passw0rd123', '1234567890', '12345678901', 'qwertyuiop', 'qwerty12345',
  'letmein1234', 'welcome1234', 'iloveyou123', 'admin12345', 'dreamable123', 'changeme123', 'abcdefghij', 'abc1234567',
]);

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;
export const PASSWORD_HINT = `At least ${PASSWORD_MIN} characters. Avoid common passwords and your email address.`;

export function passwordProblem(password: unknown, ctx: { email?: string; name?: string } = {}): string | null {
  if (typeof password !== 'string') return 'Enter a password.';
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Password must be ${PASSWORD_MAX} characters or fewer.`;
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password) || /^(?:0123456789|1234567890|abcdefghij|qwertyuiop)/.test(lower) && new Set(lower).size <= 10) {
    return 'That password is too easy to guess. Choose something less common.';
  }
  if (ctx.email && lower.includes(ctx.email.toLowerCase())) return 'Your password can’t contain your email address.';
  const local = ctx.email?.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return 'Your password can’t contain your email address.';
  return null;
}
