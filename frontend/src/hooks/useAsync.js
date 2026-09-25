import { useCallback, useEffect, useRef, useState } from 'react';
import { cacheGet, cacheSet } from '../lib/cache.js';
import { MAX_AUTO_RETRIES, backoffDelay, isTransient } from '../lib/retry.js';

/**
 * Runs an async function (receives an AbortSignal) whenever `deps` change.
 * With `cacheKey`, previously loaded data is shown instantly (browser Back/Forward) and only
 * re-fetched when older than `ttlMs`.
 *
 * Transient failures (the backend still warming up, see lib/retry.js) are retried automatically with
 * backoff and never reach the caller as `error` — the page just keeps showing its loading state a
 * little longer. This is what stops "the page doesn't load, I have to refresh" on a cold start: the
 * user does not have to do anything, the app quietly keeps trying until the server is ready.
 */
export function useAsync(fn, deps, { cacheKey = null, ttlMs = 5 * 60_000 } = {}) {
  const [state, setState] = useState(() => {
    const hit = cacheKey ? cacheGet(cacheKey) : null;
    return hit ? { data: hit.data, error: null, loading: false } : { data: null, error: null, loading: true };
  });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const hit = cacheKey ? cacheGet(cacheKey) : null;
    if (hit) {
      setState({ data: hit.data, error: null, loading: false });
      if (tick === 0 && Date.now() - hit.at < ttlMs) return undefined; // still fresh, no request needed
    } else {
      setState((s) => ({ data: s.data, error: null, loading: true })); // keep previous data (dimmed by the page) while loading
    }

    const ctrl = new AbortController();
    let timer = null;
    let attempt = 0;

    const run = () => {
      fnRef.current(ctrl.signal).then(
        (data) => {
          if (ctrl.signal.aborted) return;
          if (cacheKey) cacheSet(cacheKey, data);
          setState({ data, error: null, loading: false });
        },
        (error) => {
          if (ctrl.signal.aborted || error.name === 'AbortError') return;
          if (isTransient(error) && attempt < MAX_AUTO_RETRIES) {
            attempt += 1;
            timer = setTimeout(run, backoffDelay(attempt));
            return; // stay in the loading state — no user-visible error for a condition that resolves itself
          }
          setState((s) => ({ data: hit ? s.data : null, error, loading: false }));
        },
      );
    };
    run();

    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}
