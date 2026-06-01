const DEFAULT_MAX_FAILED_LOGIN_ATTEMPTS = 5;
const DEFAULT_LOGIN_LOCKOUT_MINUTES = 15;

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const MAX_FAILED_LOGIN_ATTEMPTS = parsePositiveInteger(
  process.env.MAX_FAILED_LOGIN_ATTEMPTS,
  DEFAULT_MAX_FAILED_LOGIN_ATTEMPTS,
);

export const LOGIN_LOCKOUT_MINUTES = parsePositiveInteger(
  process.env.LOGIN_LOCKOUT_MINUTES,
  DEFAULT_LOGIN_LOCKOUT_MINUTES,
);

export function getLockoutExpiry(now: Date): Date {
  return new Date(now.getTime() + LOGIN_LOCKOUT_MINUTES * 60 * 1000);
}

export function isActiveLoginLockout(lockedUntil: Date | null | undefined, now: Date): boolean {
  return Boolean(lockedUntil && lockedUntil.getTime() > now.getTime());
}

export function getCurrentFailedAttempts(
  failedLoginAttempts: number,
  lastFailedLoginAt: Date | null | undefined,
  now: Date,
): number {
  if (!lastFailedLoginAt) {
    return 0;
  }

  const windowStart = now.getTime() - LOGIN_LOCKOUT_MINUTES * 60 * 1000;
  return lastFailedLoginAt.getTime() >= windowStart ? failedLoginAttempts : 0;
}
