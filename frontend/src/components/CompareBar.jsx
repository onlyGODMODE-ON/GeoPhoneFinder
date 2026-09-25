import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useCompare } from '../state/CompareContext.jsx';

/** Persistent comparison tray (max 3). Hidden while empty. */
export default function CompareBar() {
  const { t } = useI18n();
  const { items, remove, clear, notice, setNotice } = useCompare();

  useEffect(() => {
    if (!notice) return undefined;
    const id = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(id);
  }, [notice, setNotice]);

  return (
    <div className="compare-bar" hidden={items.length === 0 && !notice} role="region" aria-label={t('compare.bar')}>
      <div className="container compare-bar__inner">
        <strong>{t('compare.bar')} <span className="num muted">{t('compare.count', { n: items.length })}</span></strong>
        <ul className="compare-bar__items">
          {items.map((p) => (
            <li key={p.id} className="compare-bar__item">
              <span>{p.name}</span>
              <button type="button" className="btn btn--sm btn--icon btn--ghost" onClick={() => remove(p.id)} aria-label={t('compare.remove', { name: p.name })}>✕</button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn--sm btn--ghost" onClick={clear}>{t('compare.clear')}</button>
        <Link to="/compare" className="btn btn--sm btn--primary">{t('compare.open')}</Link>
        <div className="compare-bar__notice" role="status" aria-live="polite">{notice}</div>
      </div>
    </div>
  );
}
