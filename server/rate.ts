// Fixed-window message counter: drop above `max`/s, disconnect clients far beyond it.
export type RateVerdict = "ok" | "drop" | "kick";

export class RateLimiter {
  private windowStart = 0;
  private count = 0;

  constructor(
    private readonly max = 30,
    private readonly kickAt = 90,
    private readonly windowMs = 1000,
  ) {}

  hit(now: number): RateVerdict {
    if (now - this.windowStart >= this.windowMs) {
      this.windowStart = now;
      this.count = 0;
    }
    this.count++;
    if (this.count > this.kickAt) return "kick";
    return this.count > this.max ? "drop" : "ok";
  }
}
