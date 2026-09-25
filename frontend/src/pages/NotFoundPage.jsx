import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { usePageMeta } from '../hooks/usePageMeta.js';
import { EmptyState } from '../components/States.jsx';

export default function NotFoundPage() {
  const { t } = useI18n();
  usePageMeta({ title: `${t('notFound.title')} — ${t('app.name')}`, noindex: true });
  return (
    <div className="container page">
      <EmptyState title={t('notFound.title')} body={t('notFound.body')}>
        <Link className="btn btn--primary" to="/">{t('notFound.home')}</Link>
      </EmptyState>
    </div>
  );
}
