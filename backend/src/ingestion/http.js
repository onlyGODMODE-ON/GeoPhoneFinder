/**
 * Polite HTTP helpers for live adapters (PRD §13.2): bounded retries with backoff,
 * per-host rate limiting and a small TTL cache so retailers are never hit needlessly.
 * Browsers never call retailers; only backend workers use this.
 */
const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function withRetry(fn, { retries = 3, baseDelayMs = 500, sleep = defaultSleep, shouldRetry = () => true, onRetry } = {}) {
  let attempt = 0;
  for (;;) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt >= retries || !shouldRetry(err)) throw err;
      const delay = baseDelayMs * 2 ** attempt;
      onRetry?.(err, attempt + 1, delay);
      await sleep(delay);
      attempt += 1;
    }
  }
}

export class HttpStatusError extends Error {
  constructor(status, url) {
    super(`HTTP ${status} for ${url}`);
    this.status = status;
  }
}

export function createPoliteFetcher({
  minIntervalMs = 1000,
  ttlMs = 5 * 60_000,
  timeoutMs = 15_000,
  retries = 3,
  fetchImpl = globalThis.fetch,
  sleep = defaultSleep,
  now = () => Date.now(),
} = {}) {
  const cache = new Map();
  const lastRequest = new Map(); // host -> timestamp

  return {
    async getJson(url, { headers = {} } = {}) {
      const hit = cache.get(url);
      if (hit && now() - hit.at < ttlMs) return hit.body;

      const body = await withRetry(
        async () => {
          const host = new URL(url).host;
          const wait = (lastRequest.get(host) ?? 0) + minIntervalMs - now();
          if (wait > 0) await sleep(wait);
          lastRequest.set(host, now());
          const res = await fetchImpl(url, {
            headers: { accept: 'application/json', 'user-agent': 'GeorgianPhoneFinderBot/0.1', ...headers },
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (!res.ok) throw new HttpStatusError(res.status, url);
          return res.json();
        },
        {
          retries,
          sleep,
          // retry network errors, 429 and 5xx — never other 4xx
          shouldRetry: (e) => !(e instanceof HttpStatusError) || e.status === 429 || e.status >= 500,
        },
      );
      cache.set(url, { at: now(), body });
      return body;
    },
  };
}
