import { useI18n } from '../i18n/index.jsx';

export function ErrorState({ error, onRetry }) {
  const { t } = useI18n();
  return (
    <div className="state glass" role="alert">
      <h2>{t('error.load')}</h2>
      <p className="muted">{error?.message && error.message !== 'Failed to fetch' ? error.message : t('error.generic')}</p>
      {onRetry && <button type="button" className="btn btn--primary" onClick={onRetry}>{t('common.retry')}</button>}
    </div>
  );
}

export function EmptyState({ title, body, children }) {
  return (
    <div className="state glass">
      <h2>{title}</h2>
      {body && <p className="muted" style={{ maxWidth: '52ch', margin: '0 auto 20px' }}>{body}</p>}
      {children}
    </div>
  );
}

export function CardSkeletons({ n = 3 }) {
  return (
    <div aria-hidden="true" style={{ display: 'grid', gap: 16 }}>
      {Array.from({ length: n }, (_, i) => <div key={i} className="skeleton" style={{ height: 168 }} />)}
    </div>
  );
}
