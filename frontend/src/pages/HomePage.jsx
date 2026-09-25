import { useI18n } from '../i18n/index.jsx';
import { usePageMeta } from '../hooks/usePageMeta.js';
import { CheckCircle } from '../components/Icons.jsx';
import Wizard from '../components/Wizard.jsx';

export default function HomePage() {
  const { t } = useI18n();
  usePageMeta({
    title: `${t('app.name')} — ${t('hero.title')}`,
    description: t('hero.subtitle'),
    canonical: `${window.location.origin}/`,
  });
  return (
    <section className="hero">
      <div className="container hero__grid">
        {/* the copy column stays put (sticky) while the wizard card changes height between steps */}
        <div className="hero__copy">
          <h1 className="hero__title">{t('hero.title')}</h1>
          <p className="hero__sub">{t('hero.subtitle')}</p>
          <ul className="hero__points">
            {['hero.point1', 'hero.point2', 'hero.point3'].map((k) => (
              <li key={k}><CheckCircle /><span>{t(k)}</span></li>
            ))}
          </ul>
        </div>
        <Wizard />
      </div>
    </section>
  );
}
