import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { useI18n } from '../i18n/index.jsx';
import { useCompare } from '../state/CompareContext.jsx';
import { memoryLabel, storageLabel } from '../lib/format.js';
import { SPEC_ROWS, specCell } from '../lib/specs.js';
import PhoneImage from './PhoneImage.jsx';
import MatchRing from './MatchRing.jsx';
import { ScoreList, ScorePills } from './Scores.jsx';
import { OfferList, OfferTags } from './Offers.jsx';

const KEY_SPECS = ['chipset', 'chipsetCores', 'gpu', 'ram', 'storage', 'displaySize', 'refresh', 'panel', 'battery', 'wired', 'mainCamera', 'fiveG', 'weight', 'os'];

export function StorageFitBadge({ fit }) {
  const { t } = useI18n();
  if (!fit) return null;
  const gb = fit.actual ? storageLabel(fit.actual) : '';
  const cls = { exact: 'tag tag--ok', nearby: 'tag tag--accent', other: 'tag', unknown: 'tag' }[fit.status];
  const label = fit.status === 'exact' ? t('storageFit.exact', { gb: storageLabel(fit.target) }) : t(`storageFit.${fit.status}`, { gb });
  return <span className={cls}>{fit.status === 'exact' ? '✓ ' : ''}{label}</span>;
}

/** Key specs, loaded lazily the first time a result card is expanded. */
function CardDetail({ card, offers, priorityScores, finalScore, rank, missing, overall }) {
  const { t } = useI18n();
  const { data, error, loading, reload } = useAsync((signal) => api.phone(card.slug, signal), [card.slug], { cacheKey: `phone:${card.slug}` });
  const selected = priorityScores?.map((p) => p.key) ?? [];
  const detail = data?.phone;
  return (
    <div className="phone-card__detail">
      <div className="detail-cols">
        <div>
          {finalScore !== null && finalScore !== undefined && (
            <p style={{ marginBottom: 14 }}>
              <span className="muted">{overall ? t('card.overallScoreLabel') : t('card.finalScore')}: </span><strong className="num">{finalScore.toFixed(1)}</strong>
              {rank && <span className="faint"> — {t('card.rank', { n: rank })}</span>}
            </p>
          )}
          <h4>{selected.length ? t('card.priorityScores') : t('card.allScores')}</h4>
          <ScoreList scores={card.scores} details={detail?.scoreDetails} selected={selected} />
          {missing?.length > 0 && <p className="note">{t('card.partial')}</p>}
        </div>
        <div>
          <h4>{t('card.specs')}</h4>
          {loading && !detail && <p className="muted" role="status">{t('card.loadingSpecs')}</p>}
          {error && <button type="button" className="btn btn--sm" onClick={reload}>{t('common.retry')}</button>}
          {detail && (
            <dl className="spec-list">
              {SPEC_ROWS.filter((r) => KEY_SPECS.includes(r.key)).map((row) => {
                const cell = specCell(row, detail, t);
                return (
                  <div key={row.key}>
                    <dt>{t(`spec.${row.key}`)}</dt>
                    <dd className={cell.text === null ? 'unknown' : ''}>{cell.text ?? '—'}</dd>
                  </div>
                );
              })}
            </dl>
          )}
        </div>
      </div>
      <div>
        <h4>{t('card.offers')}</h4>
        <OfferList offers={offers ?? data?.offers} />
      </div>
      <div><Link className="btn btn--sm" to={`/phone/${card.slug}`}>{t('card.openFull')}</Link></div>
    </div>
  );
}

/**
 * Phone card used by recommendations (expandable) and search (links to the product page).
 * Presentation only: every number shown here was computed by the backend.
 *
 * The picture and colour are those of the store that offers the best price, and the store button opens
 * THAT store's page for THIS exact variant (primaryOffer.url).
 *
 * `open` / `onToggle` are optional: pass them to keep the expanded state outside (survives Back/Forward).
 */
export default function PhoneCard({ phone, primaryOffer, rank, match, finalScore, overall = false, offers, priorityScores, missingPriorities, storageFit, expandable = false, open: openProp, onToggle }) {
  const { t, formatPrice } = useI18n();
  const { has, add, remove, setNotice } = useCompare();
  const [openState, setOpenState] = useState(false);
  const regionId = useId();
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const toggleOpen = () => (controlled ? onToggle?.(phone.id, !open) : setOpenState((o) => !o));
  const inCompare = has(phone.id);
  const h = phone.highlights;

  const toggleCompare = () => {
    if (inCompare) return remove(phone.id);
    if (add(phone) === 'full') setNotice(t('compare.limit'));
    return undefined;
  };

  return (
    <article className="phone-card glass" aria-label={phone.name}>
      <div className="phone-card__main">
        <div className="phone-card__media">
          {rank && <span className="rank" aria-label={t('card.rank', { n: rank })}>#{rank}</span>}
          <PhoneImage phone={phone} src={primaryOffer?.imageUrl ?? phone.imageUrl} color={primaryOffer?.color} />
        </div>

        <div className="phone-card__body">
          <h3 className="phone-card__title"><Link to={`/phone/${phone.slug}`}>{phone.name}</Link></h3>
          <div className="phone-card__meta">
            <span className="tag">{memoryLabel(phone.ram, phone.storage) || t('card.ramUnknown')}</span>
            {primaryOffer?.color && <span className="tag">{t('card.color', { color: primaryOffer.color })}</span>}
            {phone.chipset && <span className="tag">{phone.chipset.name}</span>}
            <StorageFitBadge fit={storageFit} />
            {!priorityScores && h.displaySizeInch && <span className="tag">{h.displaySizeInch}″{h.refreshRateHz ? ` · ${h.refreshRateHz} Hz` : ''}</span>}
            {!priorityScores && h.batteryMah && <span className="tag">{h.batteryMah} mAh</span>}
          </div>
          {priorityScores?.length > 0 && <ScorePills items={priorityScores} />}
          <div className="phone-card__price num" style={{ marginTop: 14 }}>
            {primaryOffer ? (
              <>
                {formatPrice(primaryOffer.price)}
                <small>
                  {t('card.at', { store: primaryOffer.storeName })} <OfferTags offer={primaryOffer} />
                </small>
              </>
            ) : (
              <span className="muted" style={{ fontSize: '1rem' }}>{t('card.noOffer')}</span>
            )}
          </div>
        </div>

        <div className="phone-card__side">{match !== null && match !== undefined && <MatchRing value={match} overall={overall} />}</div>
      </div>

      <div className="phone-card__actions">
        {primaryOffer && (
          <a className="btn btn--sm btn--primary" href={primaryOffer.url} target="_blank" rel="noopener noreferrer nofollow">
            {t('card.viewAtStore', { store: primaryOffer.storeName })}
          </a>
        )}
        {expandable ? (
          <button type="button" className="btn btn--sm" aria-expanded={open} aria-controls={regionId} onClick={toggleOpen}>
            {open ? t('card.hide') : t('card.details')}
          </button>
        ) : (
          <Link className="btn btn--sm" to={`/phone/${phone.slug}`}>{t('card.view')}</Link>
        )}
        <button type="button" className={`btn btn--sm${inCompare ? ' btn--primary' : ''}`} aria-pressed={inCompare} onClick={toggleCompare}>
          {inCompare ? t('card.compareRemove') : t('card.compareAdd')}
        </button>
      </div>

      {expandable && (
        <div id={regionId} role="region" aria-label={`${phone.name}: ${t('card.details')}`} hidden={!open}>
          {open && (
            <CardDetail card={phone} offers={offers} priorityScores={priorityScores} finalScore={finalScore} rank={rank} missing={missingPriorities} overall={overall} />
          )}
        </div>
      )}
    </article>
  );
}
