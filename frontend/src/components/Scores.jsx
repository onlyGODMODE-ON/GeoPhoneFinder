import { PRIORITY_KEYS } from '../lib/priorities.js';
import { useI18n } from '../i18n/index.jsx';

/** One score bar. `value === null` means the score is unknown: hatched bar + "—", never a fake 0. */
export function ScoreBar({ label, value, selected = false, coverage = null }) {
  const { t } = useI18n();
  const none = value === null || value === undefined;
  return (
    <li className={`score${none ? ' score--none' : ''}${selected ? ' score--selected' : ''}`}>
      <span className="score__label" id={undefined}>
        {label}
        {!none && coverage !== null && coverage < 1 && (
          <span className="faint" title={t('score.coverage', { n: Math.round(coverage * 100) })}> *</span>
        )}
      </span>
      <div
        className="score__bar"
        role="img"
        aria-label={none ? t('score.ariaNone', { label }) : t('score.aria', { label, value })}
      >
        {!none && <div className="score__fill" style={{ width: `${value}%` }} />}
      </div>
      <span className="score__value num" aria-hidden="true">{none ? '—' : value}</span>
    </li>
  );
}

/** All priority scores. Selected priorities are emphasised and listed first, in the user's order. */
export function ScoreList({ scores, details = null, selected = [] }) {
  const { t } = useI18n();
  const order = [...selected, ...PRIORITY_KEYS.filter((k) => !selected.includes(k))];
  return (
    <ul className="score-list">
      {order.map((k) => (
        <ScoreBar
          key={k}
          label={t(`priority.${k}`)}
          value={scores?.[k] ?? null}
          selected={selected.includes(k)}
          coverage={details?.[k]?.coverage ?? null}
        />
      ))}
    </ul>
  );
}

/** Compact pills for the collapsed result card. */
export function ScorePills({ items }) {
  const { t } = useI18n();
  return (
    <ul className="score-pills" aria-label={t('card.priorityScores')} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {items.map(({ key, score }) => (
        <li key={key} className={`score-pill${score === null ? ' score-pill--none' : ''}`}>
          {t(`priority.${key}`)} <b className="num">{score === null ? '—' : score}</b>
        </li>
      ))}
    </ul>
  );
}
