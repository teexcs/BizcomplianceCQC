import 'server-only';

// Simple sliding-window limiter, per server instance. For a single-region
// Vercel/Node deployment this is a sound first line of defence for form spam
// and brute force; auth endpoints are additionally rate limited by Supabase.
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;
  const hits = (buckets.get(key) ?? []).filter((t) => t > windowStart);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) {
    // Prevent unbounded growth under scanning traffic.
    const cutoff = now - windowMs;
    for (const [k, v] of buckets) {
      if (v.every((t) => t <= cutoff)) buckets.delete(k);
    }
  }
  return true;
}
