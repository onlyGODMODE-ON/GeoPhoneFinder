import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { usePageMeta } from '../hooks/usePageMeta.js';
import { useI18n } from '../i18n/index.jsx';
import { useMeta } from '../state/MetaContext.jsx';
import { useWizard } from '../state/WizardContext.jsx';
import { decodeCriteria, encodeCriteria, toRequest } from '../state/criteria.js';
import { storageLabel } from '../lib/format.js';
import { requirementLabels } from '../lib/requirements.js';
import PhoneCard from '../components/PhoneCard.jsx';
import { CardSkeletons, EmptyState, ErrorState } from '../components/States.jsx';

function Summary({ criteria, allowedMax }) {
  const { t, formatPrice } = useI18n();
  const { meta } = useMeta();
  const storeNames = criteria.stores?.map((id) => meta?.stores.find((s) => s.id === id)?.name ?? id);
  return (
    <ul className="summary-chips" style={{ listStyle: 'none', padding: 0 }}>
      <li className="tag tag--accent">{t('results.budget', { min: formatPrice(criteria.minPrice), max: formatPrice(criteria.maxPrice), allowed: formatPrice(allowedMax ?? criteria.maxPrice * 1.05) })}</li>
      <li className="tag">{criteria.brands.length ? criteria.brands.join(', ') : t('brands.allIncluded')}</li>
      {criteria.storage && <li className="tag">{storageLabel(criteria.storage)}</li>}
      <li className="tag">{storeNames ? storeNames.join(', ') : t('stores.all')}</li>
      {criteria.priorities.map((k, i) => <li key={k} className="tag">{i + 1}. {t(`priority.${k}`)}</li>)}
      {requirementLabels(criteria.requirements, t).map((label) => <li key={label} className="tag">{label}</li>)}
    </ul>
  );
}

export default function ResultsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { criteria: wizardCriteria, dispatch } = useWizard();
  const key = params.toString();
  const criteria = useMemo(() => decodeCriteria(params), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasParams = params.has('max');

  usePageMeta({ title: `${t('results.title')} — ${t('app.name')}`, noindex: true });

  const { data, error, loading, reload } = useAsync(
    (signal) => (hasParams ? api.recommend(toRequest(criteria), signal) : Promise.resolve(null)),
    [key],
    { cacheKey: hasParams ? `rec:${key}` : null },
  );

  // Which cards are expanded is remembered per result set, so Back from a product page restores it.
  const openKey = `pf.open:${key}`;
  const [openIds, setOpenIds] = useState(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem(openKey) || '[]')); } catch { return new Set(); }
  });
  const setOpen = (id, isOpen) => {
    const next = new Set(openIds);
    if (isOpen) next.add(id); else next.delete(id);
    setOpenIds(next);
    try { sessionStorage.setItem(openKey, JSON.stringify([...next])); } catch { /* ignore */ }
  };

  // A direct visit to /results without parameters reuses the wizard state (or defaults).
  if (!hasParams) return <Navigate replace to={{ pathname: '/results', search: `?${encodeCriteria(wizardCriteria).toString()}` }} />;

  const edit = () => {
    dispatch({ type: 'load', criteria });
    navigate({ pathname: '/', search: '?step=review' }, { state: { from: 'results' } });
  };
  const results = data?.results ?? [];
  const total = data?.candidateCount ?? 0;

  return (
    <div className="container page">
      <div className="results-head">
        <div>
          <h1 style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.5rem)' }}>{t('results.title')}</h1>
          <p className="muted" role="status" aria-live="polite">
            {loading ? t('results.loading') : data && total > 0 ? t('results.showing', { shown: results.length, total }) : ''}
          </p>
        </div>
        <button type="button" className="btn" onClick={edit}>{t('results.edit')}</button>
      </div>

      <Summary criteria={criteria} allowedMax={data?.criteria.allowedMax} />

      {loading && <CardSkeletons />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {data && !loading && (
        <>
          {results.length > 0 && results.length < 10 && total === results.length && <p className="notice">{t('results.only', { n: results.length })}</p>}
          {data.rankedBy === 'overall' && results.length > 0 && <p className="notice">{t('results.overallOrder')}</p>}
          {data.storageSummary && results.length > 0 && (
            <p className="notice">{t('results.storageNote', { target: storageLabel(data.storageSummary.target), exact: data.storageSummary.exact, nearby: data.storageSummary.nearby })}</p>
          )}

          {results.length === 0 ? (
            <EmptyState title={t('results.empty.title')} body={t('results.empty.body')}>
              <button type="button" className="btn btn--primary" onClick={edit}>{t('results.edit')}</button>{' '}
              <Link className="btn btn--ghost" to="/search">{t('nav.search')}</Link>
            </EmptyState>
          ) : (
            <ol className="result-list" aria-label={t('results.list')} style={{ padding: 0 }}>
              {results.map((r) => (
                <li key={r.phone.id}>
                  <PhoneCard
                    expandable phone={r.phone} rank={r.rank} match={r.match} finalScore={r.finalScore}
                    overall={data.rankedBy === 'overall'}
                    primaryOffer={r.primaryOffer} offers={r.offers} priorityScores={r.priorityScores}
                    missingPriorities={r.missingPriorities} storageFit={r.storageFit}
                    open={openIds.has(r.phone.id)} onToggle={setOpen}
                  />
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
