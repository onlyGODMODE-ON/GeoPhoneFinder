import { useI18n } from '../i18n/index.jsx';

/** Freshness / availability tags. Each state has its own text + icon — never colour alone. */
export function OfferTags({ offer }) {
  const { t, formatRelative } = useI18n();
  return (
    <>
      {offer.state === 'current' && <span className="tag tag--ok">✓ {t('offer.current')}</span>}
      {offer.state === 'unavailable' && <span className="tag tag--danger">✕ {t('offer.unavailable')}</span>}
      {offer.state === 'stale' && <span className="tag tag--warn" title={t('offer.staleHint')}>⚠ {t('offer.stale')}</span>}
      {offer.recentlyUpdated && <span className="tag tag--accent">{t('offer.recent')}</span>}
      <span className="faint">{t('offer.updated', { when: formatRelative(offer.lastUpdated) })}</span>
    </>
  );
}

export function OfferList({ offers }) {
  const { t, formatPrice } = useI18n();
  if (!offers?.length) return <p className="muted">{t('offer.none')}</p>;
  return (
    <ul className="offers">
      {offers.map((o) => {
        const notSelected = o.state === 'current' && o.eligible === false;
        return (
          <li key={o.id} className={`offer${o.isPrimary ? ' is-primary' : ''}${o.eligible === false ? ' is-dim' : ''}`}>
            <div>
              <div className="offer__store">{o.storeName}</div>
              {o.isPrimary && <span className="tag tag--accent">★ {t('offer.primary')}</span>}
              {notSelected && <span className="tag">{t('offer.notSelected')}</span>}
            </div>
            <div className="offer__price num">{formatPrice(o.price)}</div>
            <div className="offer__status"><OfferTags offer={o} /></div>
            <a className="btn btn--sm" href={o.url} target="_blank" rel="noopener noreferrer nofollow">
              {t('offer.open')}<span className="sr-only"> — {o.storeName}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
