import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 'pf.compare';
export const MAX_COMPARE = 3;
const Ctx = createContext(null);

function init() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (Array.isArray(saved)) return saved.filter((x) => x && x.id && x.slug).slice(0, MAX_COMPARE);
  } catch { /* ignore */ }
  return [];
}

/** Single source of truth for the comparison list (max 3), shared by cards, bar and page. */
export function CompareProvider({ children }) {
  const [items, setItems] = useState(init);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
  }, [items]);

  const add = useCallback((phone) => {
    if (items.some((p) => p.id === phone.id)) return 'exists';
    if (items.length >= MAX_COMPARE) return 'full';
    setItems([...items, { id: phone.id, slug: phone.slug, name: phone.name, brand: phone.brand, imageUrl: phone.imageUrl ?? null }]);
    return 'added';
  }, [items]);

  const remove = useCallback((id) => setItems((cur) => cur.filter((p) => p.id !== id)), []);
  const clear = useCallback(() => setItems([]), []);
  const prune = useCallback((validIds) => setItems((cur) => cur.filter((p) => validIds.includes(p.id))), []);

  const value = useMemo(
    () => ({ items, add, remove, clear, prune, has: (id) => items.some((p) => p.id === id), full: items.length >= MAX_COMPARE, notice, setNotice }),
    [items, add, remove, clear, prune, notice],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCompare = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCompare must be used inside <CompareProvider>');
  return v;
};
