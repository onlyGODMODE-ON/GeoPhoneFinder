import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { usePageMeta } from '../hooks/usePageMeta.js';
import { useI18n } from '../i18n/index.jsx';
import { useMeta } from '../state/MetaContext.jsx';
import { useCompare } from '../state/CompareContext.jsx';
import { memoryLabel } from '../lib/format.js';
import { SPEC_GROUPS, SPEC_ROWS, specCell } from '../lib/specs.js';
import PhoneImage from '../components/PhoneImage.jsx';
import { ScoreList } from '../components/Scores.jsx';
import { OfferList, OfferTags } from '../components/Offers.jsx';
import { CardSkeletons, EmptyState, ErrorState } from '../components/States.jsx';

/**
 * Photos: the store's own picture when it has one; otherwise an illustration tinted with the colour
 * that store sells. One thumbnail per store offer, so the page shows the variety across stores.
 */
function Gallery({ phone, offers, primaryOffer }) {
  const { t } = useI18n();
  const [active, setActive] = useState(0);
  const items = useMemo(() => {
    const list = [];
    const seen = new Set();
    for (const o of [primaryOffer, ...offers].filter(Boolean)) {
      const id = `${o.imageUrl ?? ''}|${o.color ?? ''}`;
      if (seen.has(id) || list.length >= 6) continue;
      seen.add(id);
      list.push({
        key: `o-${o.id}`, src: o.imageUrl ?? undefined, color: o.color, view: 'back',
        label: o.imageUrl ? t('details.photoOf', { store: o.storeName }) : `${o.storeName}${o.color ? `: ${o.color}` : ''}`,
      });
    }
    list.push({ key: 'front', color: primaryOffer?.color ?? offers[0]?.color, view: 'front', label: t('details.viewFront') });
    return list;
  }, [offers, primaryOffer, t]);
  const cur = items[Math.min(active, items.length - 1)];
  return (
    <div className="gallery">
      <div className="gallery__main"><PhoneImage key={cur.key} phone={phone} src={cur.src} color={cur.color} view={cur.view} label={cur.label} /></div>
      <ul className="gallery__thumbs" aria-label={t('details.photos')}>
        {items.map((it, i) => (
          <li key={it.key}>
            <button type="button" className="gallery__thumb" aria-pressed={i === active} aria-label={it.label} title={it.label} onClick={() => setActive(i)}>
              <PhoneImage phone={phone} src={it.src} color={it.color} view={it.view} />
            </button>
          </li>
        ))}
      </ul>
      <p className="faint gallery__caption">{cur.label}</p>
    </div>
  );
}

export default function PhoneDetailsPage() {
  const { id } = useParams();
  const { t, formatPrice, formatDate } = useI18n();
  const { meta } = useMeta();
  const { has, add, remove, setNotice } = useCompare();
  const { data, error, loading, reload } = useAsync((signal) => api.phone(id, signal), [id], { cacheKey: `phone:${id}`, ttlMs: 60_000 });
  const phone = data?.phone;
  const notFound = error?.status === 404;
  const label = phone ? memoryLabel(phone.ram, phone.storage) : '';

  usePageMeta({
    title: phone ? `${phone.name}${label ? ` ${label}` : ''} — ${t('app.name')}` : t('app.name'),
    description: phone ? `${phone.name} ${label}${data.primaryOffer ? ` — ${formatPrice(data.primaryOffer.price)}` : ''}` : undefined,
    canonical: phone ? `${window.location.origin}/phone/${phone.slug}` : undefined,
    noindex: notFound,
  });

  if (loading && !data) return <div className="container page"><CardSkeletons n={2} /></div>;
  if (notFound) {
    return (
      <div className="container page">
        <EmptyState title={t('details.notFound')}><Link className="btn btn--primary" to="/search">{t('details.back')}</Link></EmptyState>
      </div>
    );
  }
  if (error) return <div className="container page"><ErrorState error={error} onRetry={reload} /></div>;

  const { primaryOffer, offers } = data;
  const inCompare = has(phone.id);
  const sourceStore = meta?.stores.find((s) => s.id === phone.source)?.name ?? phone.source;
  const toggleCompare = () => {
    if (inCompare) return remove(phone.id);
    if (add(phone) === 'full') setNotice(t('compare.limit'));
    return undefined;
  };

  return (
    <div className="container page">
      <p><Link to="/search">← {t('details.back')}</Link></p>

      <section className="detail-hero glass" aria-labelledby="phone-title">
        <div className="detail-hero__media"><Gallery phone={phone} offers={offers} primaryOffer={primaryOffer} /></div>
        <div>
          <h1 id="phone-title" style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.6rem)' }}>{phone.name}</h1>
          <div className="phone-card__meta">
            {label && <span className="tag">{label}</span>}
            {primaryOffer?.color && <span className="tag">{t('card.color', { color: primaryOffer.color })}</span>}
            {phone.chipset && <span className="tag">{phone.chipset.name}</span>}
          </div>
          {primaryOffer ? (
            <>
              <div className="detail-hero__price num">{formatPrice(primaryOffer.price)}</div>
              <p className="muted" style={{ marginBottom: 0 }}>{t('card.at', { store: primaryOffer.storeName })} <OfferTags offer={primaryOffer} /></p>
            </>
          ) : <p className="muted">{t('card.noOffer')}</p>}
          <div className="detail-hero__actions">
            {primaryOffer && <a className="btn btn--primary" href={primaryOffer.url} target="_blank" rel="noopener noreferrer nofollow">{t('card.viewOffer')}</a>}
            <button type="button" className={`btn${inCompare ? ' btn--primary' : ''}`} aria-pressed={inCompare} onClick={toggleCompare}>
              {inCompare ? t('card.compareRemove') : t('card.compareAdd')}
            </button>
          </div>
        </div>
      </section>

      <section className="section glass" aria-labelledby="h-offers">
        <h2 id="h-offers">{t('details.offers')}</h2>
        <OfferList offers={offers} />
      </section>

      <section className="section glass" aria-labelledby="h-scores">
        <h2 id="h-scores">{t('details.scores')}</h2>
        <ScoreList scores={phone.scores} details={phone.scoreDetails} />
        <p className="note">{t('details.scoreNote')}</p>
      </section>

      <section className="section glass" aria-labelledby="h-specs">
        <h2 id="h-specs">{t('details.specs')}</h2>
        <div className="spec-groups">
          {SPEC_GROUPS.map((g) => (
            <div key={g} className="spec-group">
              <h3>{t(`specGroup.${g}`)}</h3>
              <dl className="spec-list">
                {SPEC_ROWS.filter((r) => r.group === g).map((row) => {
                  const cell = specCell(row, phone, t);
                  return (
                    <div key={row.key}>
                      <dt>{t(`spec.${row.key}`)}</dt>
                      <dd className={cell.text === null ? 'unknown' : ''}>{cell.text ?? '—'}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section className="section glass" aria-labelledby="h-source">
        <h2 id="h-source">{t('details.source')}</h2>
        <p className="muted">{t('details.sourceText', { store: sourceStore })}</p>
        <p className="muted">
          {t('details.lastUpdated', { when: formatDate(phone.lastUpdated) })}
          {' · '}
          <a href={phone.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">{t('details.sourceLink')}</a>
        </p>
      </section>
    </div>
  );
}
