// Runs once when the server starts. Logs (variable names and rules only, never values) if the auth secrets are
// unusable. Requests that need them fail closed on their own; this just makes the cause obvious in the logs.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { validateAuthSecrets, SECRET_SETUP_HINT } = await import('./lib/secretPolicy.mjs');
  const { ok, problems } = validateAuthSecrets({ SESSION_SECRET: process.env.SESSION_SECRET, RESET_SECRET: process.env.RESET_SECRET });
  if (!ok) console.error(`[config] Sign-in and password reset are disabled until this is fixed:\n  - ${problems.join('\n  - ')}\n  ${SECRET_SETUP_HINT}`);
}
