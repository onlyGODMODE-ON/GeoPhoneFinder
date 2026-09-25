/**
 * Transient conditions worth retrying automatically, without bothering the user with an error.
 *
 * The backend answers `503` (see backend/src/app.js) while the very first catalog ingestion is still
 * running — this is guaranteed to resolve on its own. A request that never reached the server at all
 * (e.g. the dev backend is still starting up) throws a plain network error with no `status`, which is
 * the same "not ready yet" situation from the browser's point of view.
 */
export const isTransient = (error) => error?.status === 503 || error?.status === undefined;

/** Capped exponential backoff: ~500ms, 700ms, 980ms … up to 4s, so a slow first ingest is still covered. */
export const backoffDelay = (attempt, base = 500, cap = 4000) => Math.min(base * 1.4 ** attempt, cap);

/** Generous but finite: about a minute of retrying before a real error is finally shown. */
export const MAX_AUTO_RETRIES = 20;
