import { useId } from 'react';
import { useI18n } from '../i18n/index.jsx';

const R = 32;
const C = 2 * Math.PI * R;

/** Circular match gauge. Value is also printed as a number, so colour is never the only cue. */
export default function MatchRing({ value, overall = false }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const { t } = useI18n();
  const v = Math.min(100, Math.max(0, value));
  const ariaLabel = overall ? t('card.overallValue', { n: v }) : t('card.matchValue', { n: v });
  return (
    <div className="match-ring" role="img" aria-label={ariaLabel}>
      <svg viewBox="0 0 76 76" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6c98ff" />
            <stop offset="1" stopColor="#a58bff" />
          </linearGradient>
        </defs>
        <circle className="match-ring__bg" cx="38" cy="38" r={R} fill="none" strokeWidth="6" />
        <circle cx="38" cy="38" r={R} fill="none" strokeWidth="6" strokeLinecap="round" stroke={`url(#${id})`} strokeDasharray={C} strokeDashoffset={C * (1 - v / 100)} />
      </svg>
      <div className="match-ring__num" aria-hidden="true">
        <span>{v}%</span>
        <small>{overall ? t('card.overallLabel') : t('card.match')}</small>
      </div>
    </div>
  );
}
