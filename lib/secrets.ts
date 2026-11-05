import { validateAuthSecrets, SECRET_SETUP_HINT } from './secretPolicy.mjs';

/** Raised when a required secret is missing or weak. The message never contains a secret value. */
export class ConfigError extends Error {
  constructor(problems: string[]) {
    super(`Server configuration error: ${problems.join(' ')} ${SECRET_SETUP_HINT}`);
    this.name = 'ConfigError';
  }
}

function load(name: 'SESSION_SECRET' | 'RESET_SECRET'): string {
  const env = { SESSION_SECRET: process.env.SESSION_SECRET, RESET_SECRET: process.env.RESET_SECRET };
  // Both secrets are validated together so "independent" is enforced wherever either is used.
  const { ok, problems } = validateAuthSecrets(env);
  if (!ok) throw new ConfigError(problems);
  return env[name] as string;
}

export const getSessionSecret = () => load('SESSION_SECRET');
export const getResetSecret = () => load('RESET_SECRET');
