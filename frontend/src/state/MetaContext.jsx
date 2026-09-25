import { createContext, useContext } from 'react';
import { api } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';

const Ctx = createContext(null);

/**
 * Loads catalog metadata once (brands, stores, priorities, price bounds, demo flag).
 * Uses useAsync so a cold backend start (503 while the first ingestion runs, or the dev server not
 * listening yet) is retried automatically — the recommendation wizard on the home page no longer
 * needs a manual page reload to appear.
 */
export function MetaProvider({ children }) {
  const { data: meta, error, loading, reload } = useAsync((signal) => api.meta(signal), []);
  return <Ctx.Provider value={{ meta, error, loading, reload }}>{children}</Ctx.Provider>;
}

export const useMeta = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMeta must be used inside <MetaProvider>');
  return v;
};
