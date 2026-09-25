import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { usePageMeta } from '../hooks/usePageMeta.js';
import { useI18n } from '../i18n/index.jsx';
import { useCompare } from '../state/CompareContext.jsx';
import { memoryLabel } from '../lib/format.js';
import { PRIORITY_KEYS } from '../lib/priorities.js';
import { SPEC_GROUPS, SPEC_ROWS, bestIndexes, specCell } from '../lib/specs.js';
import PhoneImage from '../components/PhoneImage.jsx';
import { CardSkeletons, EmptyState, ErrorState } from '../components/States.jsx';

function Cell({ text, best }) {
  return <td className={`cell num${best ? ' best' : ''}${text === null ? ' unknown' : ''}`}>{text ?? '—'}{best && <span className="sr-only"> ({/* announced to screen readers */}✓)</span>}</td>;
}

export default function ComparePage() {
  const { t, formatPrice } = useI18n();
  const { items, remove, clear, prune } = useCompare();
  const ids = items.map((i) => i.id);
  usePageMeta({ title: `${t('compare.title')} — ${t('app.name')}`, noindex: true });

  const { data, error, loading, reload } = useAsync(
    (signal) => (ids.length ? api.compare(ids, signal) : Promise.resolve({ phones: [], missing: [] })),
    [ids.join(',')],
  );

  // drop phones that no longer exist in the catalog
  useEffect(() => {
    if (data?.missing?.length) prune(data.phones.map((p) => p.phone.id));
  }, [data, prune]);

  if (items.length === 0) {
    return (
      <div className="container page">
        <EmptyState title={t('compare.emptyTitle')} body={t('compare.emptyBody')}>
          <Link className="btn btn--primary" to="/search">{t('nav.search')}</Link>{' '}
          <Link className="btn btn--ghost" to="/">{t('nav.recommend')}</Link>
        </EmptyState>
      </div>
    );
  }
  if (error) return <div className="container page"><ErrorState error={error} onRetry={reload} /></div>;
  if (!data) return <div className="container page"><CardSkeletons n={2} /></div>;

  const cols = data.phones;
  const colCount = cols.length + 1;

  const row = (key, label, values, texts, better) => {
    const best = bestIndexes(values, better);
    return (
      <tr key={key}>
        <th scope="row">{label}</th>
        {texts.map((text, i) => <Cell key={cols[i].phone.id} text={text} best={best.includes(i)} />)}
      </tr>
    );
  };

  return (
    <div className="container page">
      <div className="results-head">
        <div>
          <h1 style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.5rem)' }}>{t('compare.title')}</h1>
          <p className="muted">{t('compare.hint')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {items.length < 3 && <Link className="btn" to="/search">{t('compare.add')}</Link>}
          <button type="button" className="btn btn--ghost" onClick={clear}>{t('compare.clear')}</button>
        </div>
      </div>

      <div className="table-wrap glass" style={{ opacity: loading ? 0.6 : 1 }}>
        <table className="compare-table">
          <caption className="sr-only">{t('compare.title')}</caption>
          <thead>
            <tr>
              <td />
              {cols.map(({ phone, primaryOffer }) => (
                <th scope="col" key={phone.id}>
                  <div className="compare-col">
                    <PhoneImage phone={phone} src={primaryOffer?.imageUrl ?? phone.imageUrl} color={primaryOffer?.color} />
                    <Link to={`/phone/${phone.slug}`}>{phone.name}</Link>
                    <span className="tag">{memoryLabel(phone.ram, phone.storage)}</span>
                    <button type="button" className="btn btn--sm btn--ghost" onClick={() => remove(phone.id)} aria-label={t('compare.remove', { name: phone.name })}>✕ {t('priorities.remove')}</button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {row('price', t('compare.price'), cols.map((c) => (c.primaryOffer ? -c.primaryOffer.price : null)),
              cols.map((c) => (c.primaryOffer ? `${formatPrice(c.primaryOffer.price)} · ${c.primaryOffer.storeName}` : null)), 'higher')}

            <tr className="group-row"><th colSpan={colCount} scope="colgroup">{t('compare.scores')}</th></tr>
            {PRIORITY_KEYS.map((k) => row(`s-${k}`, t(`priority.${k}`), cols.map((c) => c.phone.scores[k] ?? null), cols.map((c) => (c.phone.scores[k] ?? null) === null ? null : String(c.phone.scores[k])), 'higher'))}

            {SPEC_GROUPS.map((g) => (
              [
                <tr className="group-row" key={`g-${g}`}><th colSpan={colCount} scope="colgroup">{t(`specGroup.${g}`)}</th></tr>,
                ...SPEC_ROWS.filter((r) => r.group === g).map((r) => {
                  const cells = cols.map((c) => specCell(r, c.phone, t));
                  return row(r.key, t(`spec.${r.key}`), cells.map((c) => c.value), cells.map((c) => c.text), r.better);
                }),
              ]
            ))}
          </tbody>
        </table>
      </div>
      {data.missing.length > 0 && <p className="note">{t('compare.missing')}</p>}
    </div>
  );
}
