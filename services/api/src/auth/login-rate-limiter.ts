type Attempt = {
  failures: number;
  resetAt: number;
};

export class LoginRateLimiter {
  private readonly attempts = new Map<string, Attempt>();

  constructor(
    private readonly maximumFailures = 5,
    private readonly windowMs = 15 * 60 * 1000,
  ) {}

  isBlocked(key: string, now = Date.now()) {
    const attempt = this.attempts.get(key);
    if (!attempt || attempt.resetAt <= now) {
      this.attempts.delete(key);
      return false;
    }
    return attempt.failures >= this.maximumFailures;
  }

  registerFailure(key: string, now = Date.now()) {
    const current = this.attempts.get(key);
    if (!current || current.resetAt <= now) {
      this.attempts.set(key, { failures: 1, resetAt: now + this.windowMs });
      return;
    }
    current.failures += 1;
  }

  clear(key: string) {
    this.attempts.delete(key);
  }
}
