// Pure secret-validation rules. No Node or framework imports, so this runs in
// route handlers, Edge middleware, instrumentation and the pre-build script.
// Messages name the variable and the rule that failed — never the value.

export const MIN_SECRET_LENGTH = 32;

const WEAK_FRAGMENTS = ['change-me', 'changeme', 'change_me', 'your-secret', 'your_secret', 'placeholder', 'example', 'default', 'secret', 'password', 'replace-me', 'todo'];

/**
 * @param {string} name
 * @param {string | undefined} value
 * @returns {string[]} human-readable problems (empty when the value is acceptable)
 */
export function secretProblems(name, value) {
  if (value === undefined || value === '') return [`${name} is not set.`];
  const problems = [];
  if (value !== value.trim()) problems.push(`${name} has leading or trailing whitespace.`);
  if (value.length < MIN_SECRET_LENGTH) problems.push(`${name} must be at least ${MIN_SECRET_LENGTH} characters.`);
  const lower = value.toLowerCase();
  if (WEAK_FRAGMENTS.some((w) => lower.includes(w))) problems.push(`${name} looks like a placeholder or default value.`);
  if (new Set(value).size < 10) problems.push(`${name} has too little variety to be random.`);
  return problems;
}

/**
 * @param {{ SESSION_SECRET?: string, RESET_SECRET?: string }} env
 * @returns {{ ok: boolean, problems: string[] }}
 */
export function validateAuthSecrets(env) {
  const problems = [
    ...secretProblems('SESSION_SECRET', env.SESSION_SECRET),
    ...secretProblems('RESET_SECRET', env.RESET_SECRET),
  ];
  if (env.SESSION_SECRET && env.SESSION_SECRET === env.RESET_SECRET) {
    problems.push('SESSION_SECRET and RESET_SECRET must be different values.');
  }
  return { ok: problems.length === 0, problems };
}

export const SECRET_SETUP_HINT = 'Generate each one with `openssl rand -hex 32` and set them in .env.local (development) or the hosting provider\'s environment (production).';
