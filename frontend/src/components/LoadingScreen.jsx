import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';

const STEP_KEYS = ['loading.step1', 'loading.step2', 'loading.step3'];

/**
 * A real loading screen (spinner + rotating status line) instead of a bare grey skeleton, shown
 * while we genuinely have nothing to display yet (e.g. the very first `/api/meta` load on a cold
 * backend — see lib/retry.js). The rotating messages are just company for a wait that can take a
 * while on a fresh server; they don't claim to track real progress.
 */
export default function LoadingScreen({ compact = false }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((n) => (n + 1) % STEP_KEYS.length), 2600);
    return () => clearInterval(id);
  }, []);
  return (
    <div className={`loading-screen${compact ? ' loading-screen--compact' : ''}`} role="status" aria-live="polite" aria-busy="true">
      <span className="loading-spinner" aria-hidden="true" />
      <p className="loading-screen__title">{t('loading.title')}</p>
      <p className="loading-screen__msg">{t(STEP_KEYS[step])}</p>
    </div>
  );
}
