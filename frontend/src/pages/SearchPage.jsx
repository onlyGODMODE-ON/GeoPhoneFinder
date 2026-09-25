import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { usePageMeta } from '../hooks/usePageMeta.js';
import { useI18n } from '../i18n/index.jsx';
import { useMeta } from '../state/MetaContext.jsx';
import { storageLabel } from '../lib/format.js';
import { PRIORITY_KEYS } from '../lib/priorities.js';
import PhoneCard from '../components/PhoneCard.jsx';
import { CardSkeletons, EmptyState, ErrorState } from '../components/States.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';

const ARRAY_KEYS = ['brand', 'store', 'storage', 'ram'];
const BOOL_KEYS = ['fiveG', 'nfc', 'wireless'];

/** Filters live in the URL: back/forward work and results can be shared. */
function useSearchState() {
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => {
    const s = { q: params.get('q') ?? '', sort: params.get('sort') ?? '', page: Number(params.get('page')) || 1 };
    ARRAY_KEYS.forEach((k) => { s[k] = params.getAll(k); });
    ['minPrice', 'maxPrice', 'minRefresh', 'minBattery', 'minCameraScore', 'processor'].forEach((k) => { s[k] = params.get(k) ?? ''; });
    BOOL_KEYS.forEach((k) => { s[k] = params.get(k) === 'true'; });
    return s;
  }, [params]);

  const update = (patch, { replace = false } = {}) => {
    const next = { ...state, ...patch };
    if (!('page' in patch)) next.page = 1;
    const p = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach((x) => p.append(k, x));
      else if (v === true) p.set(k, 'true');
      else if (v && v !== false && !(k === 'page' && v === 1)) p.set(k, String(v));
    });
    setParams(p, { replace });
  };
  return { state, update, reset: () => setParams(new URLSearchParams()), key: params.toString() };
}

const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function Filters({ state, update, reset, meta, open }) {
  const { t } = useI18n();
  const [prices, setPrices] = useState({ min: state.minPrice, max: state.maxPrice });
  useEffect(() => setPrices({ min: state.minPrice, max: state.maxPrice }), [state.minPrice, state.maxPrice]);
  const applyPrices = () => update({ minPrice: prices.min, maxPrice: prices.max });

  const chipGroup = (legend, key, options, format = String) => (
    <fieldset className="filter-group">
      <legend>{legend}</legend>
      <ul className="chips">
        {options.map((o) => (
          <li key={o.value ?? o}>
            <button type="button" className="chip" aria-pressed={state[key].includes(String(o.value ?? o))} onClick={() => update({ [key]: toggle(state[key], String(o.value ?? o)) })}>
              {o.label ?? format(o)}
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
  );

  const selectGroup = (label, key, options) => (
    <div className="field" style={{ marginBottom: 14 }}>
      <label htmlFor={`f-${key}`}>{label}</label>
      <select id={`f-${key}`} className="select" value={state[key]} onChange={(e) => update({ [key]: e.target.value })}>
        <option value="">{t('common.any')}</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );

  return (
    <aside className={`filters glass${open ? ' is-open' : ''}`} id="search-filters" aria-label={t('search.filters')}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2>{t('search.filters')}</h2>
        <button type="button" className="btn btn--sm btn--ghost" onClick={reset}>{t('search.reset')}</button>
      </div>

      {chipGroup(t('search.brand'), 'brand', meta.brands.map((b) => b.name))}

      <fieldset className="filter-group">
        <legend>{t('search.price')}</legend>
        <div className="two-col">
          <input className="input" type="number" min="0" inputMode="numeric" aria-label={t('search.minPrice')} placeholder={t('search.minPrice')} value={prices.min} onChange={(e) => setPrices({ ...prices, min: e.target.value })} onBlur={applyPrices} onKeyDown={(e) => e.key === 'Enter' && applyPrices()} />
          <input className="input" type="number" min="0" inputMode="numeric" aria-label={t('search.maxPrice')} placeholder={t('search.maxPrice')} value={prices.max} onChange={(e) => setPrices({ ...prices, max: e.target.value })} onBlur={applyPrices} onKeyDown={(e) => e.key === 'Enter' && applyPrices()} />
        </div>
      </fieldset>

      {chipGroup(t('search.storage'), 'storage', meta.storageOptions.map((gb) => ({ value: gb, label: storageLabel(gb) })))}
      {chipGroup(t('search.ram'), 'ram', meta.ramOptions.map((gb) => ({ value: gb, label: `${gb} GB` })))}

      {selectGroup(t('search.processor'), 'processor', meta.processors.map((p) => [p, p]))}
      {selectGroup(t('search.refresh'), 'minRefresh', [[90, '90 Hz+'], [120, '120 Hz+'], [144, '144 Hz']])}
      {selectGroup(t('search.battery'), 'minBattery', [[4000, '4000 mAh+'], [4500, '4500 mAh+'], [5000, '5000 mAh+']])}
      {selectGroup(t('search.camera'), 'minCameraScore', [[50, '50+'], [60, '60+'], [70, '70+'], [80, '80+']])}

      <fieldset className="filter-group">
        <legend>{t('search.features')}</legend>
        {BOOL_KEYS.map((k) => (
          <label key={k} className="check"><input type="checkbox" checked={state[k]} onChange={(e) => update({ [k]: e.target.checked })} />{t(`search.${k}`)}</label>
        ))}
      </fieldset>

      <fieldset className="filter-group">
        <legend>{t('search.stores')}</legend>
        {meta.stores.map((s) => (
          <label key={s.id} className="check"><input type="checkbox" checked={state.store.includes(s.id)} onChange={() => update({ store: toggle(state.store, s.id) })} />{s.name}</label>
        ))}
      </fieldset>
    </aside>
  );
}

export default function SearchPage() {
  const { t } = useI18n();
  const { meta, error: metaError, reload: reloadMeta } = useMeta();
  const { state, update, reset, key } = useSearchState();
  const [q, setQ] = useState(state.q);
  const [suggestions, setSuggestions] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  usePageMeta({ title: `${t('search.title')} — ${t('app.name')}`, noindex: true });

  // The URL is the source of truth (Back/Forward), but never overwrite what the user is typing right now.
  useEffect(() => setQ((cur) => (cur.trim() === state.q ? cur : state.q)), [state.q]);

  // Search while typing: results follow the input after a short pause, no Enter needed.
  // `replace` so typing does not fill the history — Back still goes to the previous page.
  const updateRef = useRef(update);
  updateRef.current = update;
  useEffect(() => {
    if (q.trim() === state.q) return undefined;
    const id = setTimeout(() => updateRef.current({ q: q.trim() }, { replace: true }), 280);
    return () => clearTimeout(id);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  // live suggestions (debounced)
  useEffect(() => {
    if (q.trim().length < 2) { setSuggestions([]); return undefined; }
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      api.suggest(q, ctrl.signal).then((r) => setSuggestions(r.suggestions), () => {});
    }, 250);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [q]);

  const { data, error, loading, reload } = useAsync(
    (signal) => api.search({
      q: state.q, brand: state.brand, store: state.store, storage: state.storage, ram: state.ram,
      minPrice: state.minPrice, maxPrice: state.maxPrice, processor: state.processor,
      minRefresh: state.minRefresh, minBattery: state.minBattery, minCameraScore: state.minCameraScore,
      fiveG: state.fiveG, nfc: state.nfc, wireless: state.wireless, sort: state.sort, page: state.page, pageSize: 12,
    }, signal),
    [key],
    { cacheKey: `search:${key}`, ttlMs: 60_000 },
  );

  return (
    <div className="container page">
      <div className="page__head"><h1 style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.5rem)' }}>{t('search.title')}</h1></div>

      <form className="search-bar" role="search" onSubmit={(e) => { e.preventDefault(); update({ q: q.trim() }); }}>
        <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search.placeholder')} aria-label={t('search.placeholder')} list="phone-suggestions" autoComplete="off" />
        <datalist id="phone-suggestions">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
        <button type="submit" className="btn btn--primary">{t('search.submit')}</button>
      </form>

      <button type="button" className="btn btn--sm filters-toggle" style={{ marginBottom: 14 }} aria-expanded={filtersOpen} aria-controls="search-filters" onClick={() => setFiltersOpen((o) => !o)}>
        {filtersOpen ? t('search.hideFilters') : t('search.showFilters')}
      </button>

      <div className="search-layout">
        {meta ? (
          <Filters state={state} update={update} reset={reset} meta={meta} open={filtersOpen} />
        ) : (
          <aside className={`filters glass${filtersOpen ? ' is-open' : ''}`} id="search-filters" aria-label={t('search.filters')}>
            {metaError ? <ErrorState error={metaError} onRetry={reloadMeta} /> : <LoadingScreen compact />}
          </aside>
        )}
        <section aria-label={t('search.results', { n: data?.total ?? 0 })}>
          <div className="toolbar">
            <p className="muted" role="status" aria-live="polite" style={{ margin: 0 }}>{data ? t('search.results', { n: data.total }) : t('common.loading')}</p>
            <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label htmlFor="sort" style={{ margin: 0 }}>{t('search.sort')}</label>
              <select id="sort" className="select" value={data?.sort ?? ''} onChange={(e) => update({ sort: e.target.value })}>
                {['relevance', 'price-asc', 'price-desc', 'name'].map((s) => <option key={s} value={s}>{t(`search.sort.${s}`)}</option>)}
                {PRIORITY_KEYS.map((k) => <option key={k} value={`score:${k}`}>{t('search.sort.score', { label: t(`priority.${k}`) })}</option>)}
              </select>
            </div>
          </div>

          {loading && !data && <CardSkeletons />}
          {error && <ErrorState error={error} onRetry={reload} />}
          {data && data.items.length === 0 && <EmptyState title={t('search.none')}><button type="button" className="btn" onClick={reset}>{t('search.reset')}</button></EmptyState>}
          {data && data.items.length > 0 && (
            <ul className="grid" style={{ padding: 0, opacity: loading ? 0.6 : 1 }} aria-busy={loading}>
              {data.items.map((i) => <li key={i.phone.id}><PhoneCard phone={i.phone} primaryOffer={i.primaryOffer} /></li>)}
            </ul>
          )}
          {data && data.pages > 1 && (
            <nav className="pager" aria-label={t('search.page', { page: data.page, pages: data.pages })}>
              <button type="button" className="btn btn--sm" disabled={data.page <= 1} onClick={() => update({ page: data.page - 1 })}>{t('search.prev')}</button>
              <span className="num muted">{t('search.page', { page: data.page, pages: data.pages })}</span>
              <button type="button" className="btn btn--sm" disabled={data.page >= data.pages} onClick={() => update({ page: data.page + 1 })}>{t('search.next')}</button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
