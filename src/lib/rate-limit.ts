/**
 * Rate limiting — server-side, per-IP sliding window.
 *
 * Store selection (automatic, no call-site changes needed):
 *   - Redis (Upstash)  — when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set.
 *                        Works correctly across multiple processes / Vercel regions.
 *   - In-memory        — fallback for local dev / single-process deployments.
 */

import { Redis } from '@upstash/redis';

// ── Store interface ─────────────────────────────────────────────────────────

interface RateLimitRecord {
  count: number;
  windowStart: number;
}

interface RateLimitStore {
  get(key: string): Promise<RateLimitRecord | null>;
  set(key: string, record: RateLimitRecord, ttlMs: number): Promise<void>;
}

// ── In-memory store (single-process fallback) ───────────────────────────────

class InMemoryStore implements RateLimitStore {
  private map = new Map<string, { record: RateLimitRecord; expiresAt: number }>();

  async get(key: string): Promise<RateLimitRecord | null> {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return entry.record;
  }

  async set(key: string, record: RateLimitRecord, ttlMs: number): Promise<void> {
    this.map.set(key, { record, expiresAt: Date.now() + ttlMs });
  }
}

// ── Redis store (Upstash — production) ─────────────────────────────────────

class RedisStore implements RateLimitStore {
  private client: Redis;

  constructor(client: Redis) {
    this.client = client;
  }

  async get(key: string): Promise<RateLimitRecord | null> {
    const raw = await this.client.get<RateLimitRecord>(key);
    return raw ?? null;
  }

  async set(key: string, record: RateLimitRecord, ttlMs: number): Promise<void> {
    // EX is in whole seconds; ceil so we never expire a window too early.
    await this.client.set(key, record, { ex: Math.ceil(ttlMs / 1000) });
  }
}

// ── Auto-select store ───────────────────────────────────────────────────────

function createDefaultStore(): RateLimitStore {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return new RedisStore(new Redis({ url, token }));
  }
  return new InMemoryStore();
}

// Singleton store shared across all rate limiter instances in this process.
const defaultStore: RateLimitStore = createDefaultStore();
const memoryFallback: RateLimitStore = new InMemoryStore();
let redisWarned = false;

// ── Rate limiter ────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Unique namespace for this limit rule (e.g. 'vault-write', 'auth-sync'). */
  key: string;
  /** Max requests allowed per window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
  /** Optional store override (for Redis integration). */
  store?: RateLimitStore;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix timestamp (ms) when the window resets
}

/**
 * Check whether the given identifier (e.g. IP address) is within the rate limit.
 * Call this at the top of any sensitive API route handler.
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const storeKey = `rl:${config.key}:${identifier}`;
  const now = Date.now();
  let store = config.store ?? defaultStore;

  // If Redis is unreachable (expired Upstash database, network), fall back to
  // this process's memory instead of failing every vault request with a 500.
  let record: RateLimitRecord | null;
  try {
    record = await store.get(storeKey);
  } catch (err) {
    if (!redisWarned) { console.error('[rate-limit] Redis unavailable, using in-memory limits:', err instanceof Error ? err.message : err); redisWarned = true; }
    store = memoryFallback;
    record = await store.get(storeKey);
  }

  if (!record || now - record.windowStart >= config.windowMs) {
    // New window
    record = { count: 1, windowStart: now };
    await store.set(storeKey, record, config.windowMs);
    return {
      allowed: true,
      remaining: config.limit - 1,
      resetAt: now + config.windowMs,
    };
  }

  record.count += 1;
  await store.set(storeKey, record, config.windowMs - (now - record.windowStart));

  const remaining = Math.max(0, config.limit - record.count);
  return {
    allowed: record.count <= config.limit,
    remaining,
    resetAt: record.windowStart + config.windowMs,
  };
}

/**
 * Extract the best available client IP from a Next.js request.
 * Falls back to 'unknown' — rate limits will still apply but will share a bucket.
 */
export function getClientIp(request: Request): string {
  // Behind Cloudflare: the visitor's address as Cloudflare saw it.
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();

  // Vercel / common proxies
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  return 'unknown';
}

// ── Pre-configured limits for SecureVoult endpoints ─────────────────────────

export const RATE_LIMITS = {
  /** auth/sync-user: 20 syncs per 15 min per IP */
  authSync: { key: 'auth-sync', limit: 20, windowMs: 15 * 60 * 1000 } as RateLimitConfig,

  /** vault POST: 60 writes per 15 min per IP */
  vaultWrite: { key: 'vault-write', limit: 60, windowMs: 15 * 60 * 1000 } as RateLimitConfig,

  /** vault GET: 120 reads per 15 min per IP */
  vaultRead: { key: 'vault-read', limit: 120, windowMs: 15 * 60 * 1000 } as RateLimitConfig,

  /** session list/revoke: 30 requests per 5 min per IP */
  sessions: { key: 'sessions', limit: 30, windowMs: 5 * 60 * 1000 } as RateLimitConfig,

  /** admin browse (list/search): 100 requests per 10 min per IP */
  admin: { key: 'admin', limit: 100, windowMs: 10 * 60 * 1000 } as RateLimitConfig,

  /** admin mutations (role change, disable account): 20 per 10 min per IP */
  adminAction: { key: 'admin-action', limit: 20, windowMs: 10 * 60 * 1000 } as RateLimitConfig,

  /** auth actions (login, register, passkey): 10 per minute per IP */
  auth: { key: 'auth', limit: 10, windowMs: 60 * 1000 } as RateLimitConfig,

  /** auth mutations (passkey credential management): 20 per 10 min per IP */
  authAction: { key: 'auth-action', limit: 20, windowMs: 10 * 60 * 1000 } as RateLimitConfig,
} as const;
