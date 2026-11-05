// Pre-build check. On Vercel/CI an invalid configuration fails the build so a broken deploy never goes live.
// Locally it only warns, so `npm run build` is not blocked by a missing .env.local.
import { validateAuthSecrets, SECRET_SETUP_HINT } from '../lib/secretPolicy.mjs';

const { ok, problems } = validateAuthSecrets({ SESSION_SECRET: process.env.SESSION_SECRET, RESET_SECRET: process.env.RESET_SECRET });
if (ok) process.exit(0);

const strict = !!(process.env.VERCEL || process.env.CI);
console.error(`\n${strict ? 'ERROR' : 'WARNING'}: auth secrets are not configured correctly:\n  - ${problems.join('\n  - ')}\n${SECRET_SETUP_HINT}\n`);
process.exit(strict ? 1 : 0);
