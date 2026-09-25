import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useMeta } from '../state/MetaContext.jsx';
import { useWizard } from '../state/WizardContext.jsx';
import { CAMERA_LEVELS, REQ_TIERS, encodeCriteria, hasRequirements } from '../state/criteria.js';
import { storageLabel } from '../lib/format.js';
import { requirementLabels } from '../lib/requirements.js';
import RangeSlider from './RangeSlider.jsx';
import { ErrorState } from './States.jsx';
import LoadingScreen from './LoadingScreen.jsx';

const STEPS = ['budget', 'brands', 'stores', 'priorities', 'details', 'review'];

/** The current step lives in the URL (?step=…), so browser Back/Forward move between steps. */
function useStep() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const raw = params.get('step');
  const name = STEPS.includes(raw) ? raw : 'budget';
  const index = STEPS.indexOf(name);

  const goTo = (next) => navigate({ pathname: '/', search: next === 'budget' ? '' : `?step=${next}` }, { state: { from: name } });
  const back = () => {
    const prev = STEPS[index - 1];
    // if we came from the previous step, behave exactly like the browser's Back button
    if (location.state?.from === prev) navigate(-1);
    else goTo(prev);
  };
  return { name, index, goTo, back };
}

function BudgetStep({ meta }) {
  const { t, formatPrice } = useI18n();
  const { criteria, dispatch } = useWizard();
  const domainMax = Math.max(meta.price.max, 1000);
  const allowed = Math.round(criteria.maxPrice * (1 + meta.budgetTolerance) * 100) / 100;
  return (
    <>
      <p className="wizard__help">{t('budget.help')}</p>
      <RangeSlider
        min={0} max={domainMax} step={50}
        low={criteria.minPrice} high={Math.min(criteria.maxPrice, domainMax)}
        lowLabel={t('budget.min')} highLabel={t('budget.max')} format={formatPrice}
        onChange={(min, max) => dispatch({ type: 'setBudget', min, max })}
      />
      <p className="note">{t('budget.tolerance', { allowed: formatPrice(allowed) })}</p>
    </>
  );
}

function BrandsStep({ meta }) {
  const { t } = useI18n();
  const { criteria, dispatch } = useWizard();
  return (
    <>
      <p className="wizard__help">{t('brands.help')}</p>
      <ul className="chips">
        {meta.brands.map((b) => (
          <li key={b.name}>
            <button type="button" className="chip" aria-pressed={criteria.brands.includes(b.name)} onClick={() => dispatch({ type: 'toggleBrand', name: b.name })}>
              <span className="tick" aria-hidden="true">{criteria.brands.includes(b.name) ? '✓' : ''}</span>
              {b.name} <span className="count">{b.count}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="wizard__actions" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn--sm" onClick={() => dispatch({ type: 'setBrands', brands: meta.brands.map((b) => b.name) })}>{t('brands.selectAll')}</button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => dispatch({ type: 'setBrands', brands: [] })}>{t('brands.clear')}</button>
      </div>
      {criteria.brands.length === 0 && <p className="note" role="status">{t('brands.allIncluded')}</p>}
    </>
  );
}

function StoresStep({ meta }) {
  const { t } = useI18n();
  const { criteria, dispatch } = useWizard();
  const allIds = meta.stores.map((s) => s.id);
  const selected = criteria.stores ?? allIds;
  return (
    <>
      <p className="wizard__help">{t('stores.help')}</p>
      <ul className="chips">
        <li>
          <button type="button" className="chip" aria-pressed={criteria.stores === null} onClick={() => dispatch({ type: 'setStores', stores: null })}>
            <span className="tick" aria-hidden="true">{criteria.stores === null ? '✓' : ''}</span>{t('stores.all')}
          </button>
        </li>
        {meta.stores.map((s) => (
          <li key={s.id}>
            <button type="button" className="chip" aria-pressed={selected.includes(s.id)} onClick={() => dispatch({ type: 'toggleStore', id: s.id, allIds })}>
              <span className="tick" aria-hidden="true">{selected.includes(s.id) ? '✓' : ''}</span>{s.name}
            </button>
          </li>
        ))}
      </ul>
      <p className="note">{t('stores.atLeastOne')}</p>
    </>
  );
}

function PrioritiesStep({ meta }) {
  const { t } = useI18n();
  const { criteria, dispatch } = useWizard();
  const [live, setLive] = useState('');
  const remaining = meta.priorities.filter((p) => !criteria.priorities.includes(p.key));
  const move = (key, dir) => {
    const i = criteria.priorities.indexOf(key);
    const j = Math.min(Math.max(i + dir, 0), criteria.priorities.length - 1);
    dispatch({ type: 'movePriority', key, dir });
    setLive(`${t(`priority.${key}`)}: ${t('priorities.position', { n: j + 1 })}`);
  };
  return (
    <>
      <p className="wizard__help">{t('priorities.help')}</p>
      {criteria.priorities.length === 0 ? (
        <p className="note" style={{ marginTop: 0 }}>{t('priorities.none')}</p>
      ) : (
        <ol className="priority-list" aria-label={t('priorities.list')}>
          {criteria.priorities.map((key, i) => (
            <li key={key} className="priority-item">
              <span className="priority-item__n" aria-hidden="true">{i + 1}</span>
              <span className="priority-item__label">
                <span className="sr-only">{t('priorities.position', { n: i + 1 })}: </span>
                {t(`priority.${key}`)}
              </span>
              <button type="button" className="btn btn--sm btn--icon" disabled={i === 0} onClick={() => move(key, -1)} aria-label={`${t('priorities.moveUp')}: ${t(`priority.${key}`)}`}>↑</button>
              <button type="button" className="btn btn--sm btn--icon" disabled={i === criteria.priorities.length - 1} onClick={() => move(key, 1)} aria-label={`${t('priorities.moveDown')}: ${t(`priority.${key}`)}`}>↓</button>
              <button type="button" className="btn btn--sm btn--icon btn--ghost" onClick={() => dispatch({ type: 'removePriority', key })} aria-label={`${t('priorities.remove')}: ${t(`priority.${key}`)}`}>✕</button>
            </li>
          ))}
        </ol>
      )}
      <div className="sr-only" role="status" aria-live="polite">{live}</div>
      <h3 style={{ fontSize: '0.95rem', color: 'var(--text-dim)', marginTop: 18 }}>{remaining.length ? t('priorities.add') : t('priorities.noneLeft')}</h3>
      {remaining.length > 0 && (
        <ul className="priority-menu" style={{ listStyle: 'none', padding: 0 }}>
          {remaining.map((p) => (
            <li key={p.key}>
              <button type="button" className="chip chip--block" onClick={() => dispatch({ type: 'addPriority', key: p.key })}>
                <span>+ {t(`priority.${p.key}`)}</span>
                <small className="faint">{t(`priorityHint.${p.key}`)}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Single-choice chips; pressing the selected chip again clears it. */
function ChoiceChips({ options, value, onChange, format }) {
  return (
    <ul className="chips chips--sm">
      {options.map((o) => (
        <li key={o.key ?? o}>
          <button type="button" className="chip" aria-pressed={value === (o.value ?? o)} onClick={() => onChange(value === (o.value ?? o) ? null : (o.value ?? o))}>
            {format(o)}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** OPTIONAL technical minimums for people who know phones. Nothing here is required. */
function DetailsStep({ meta }) {
  const { t } = useI18n();
  const { criteria, dispatch } = useWizard();
  const r = criteria.requirements;
  const set = (key, value) => dispatch({ type: 'setRequirement', key, value });
  const flag = (key) => (
    <label key={key} className="check">
      <input type="checkbox" checked={Boolean(r[key])} onChange={(e) => set(key, e.target.checked)} />
      {t(`adv.${key}`)}
    </label>
  );
  const count = requirementLabels(r, t).length;

  return (
    <>
      <p className="wizard__help">{t('adv.help')}</p>
      <div className="adv__bar">
        <span className="tag" role="status">{count ? t('adv.count', { n: count }) : t('adv.none')}</span>
        {hasRequirements(r) && <button type="button" className="btn btn--sm btn--ghost" onClick={() => dispatch({ type: 'clearRequirements' })}>{t('adv.clear')}</button>}
      </div>

      <div className="adv">
        <fieldset className="adv__group">
          <legend>{t('adv.memory')}</legend>
          <p className="adv__label">{t('adv.ram')}</p>
          <ChoiceChips options={[4, 6, 8, 12, 16]} value={r.minRam ?? null} onChange={(v) => set('minRam', v)} format={(n) => `${n} GB`} />
          <p className="adv__label">{t('adv.storage')}</p>
          <ChoiceChips options={meta.storageOptions} value={r.minStorage ?? null} onChange={(v) => set('minStorage', v)} format={storageLabel} />
        </fieldset>

        <fieldset className="adv__group">
          <legend>{t('adv.processor')}</legend>
          <p className="adv__label">{t('adv.vendor')}</p>
          <ul className="chips chips--sm">
            {meta.processors.map((v) => (
              <li key={v}>
                <button type="button" className="chip" aria-pressed={Boolean(r.vendors?.includes(v))} onClick={() => dispatch({ type: 'toggleVendor', name: v })}>{v}</button>
              </li>
            ))}
          </ul>
          <p className="adv__label">{t('adv.tier')}</p>
          <ChoiceChips options={REQ_TIERS} value={r.minChipsetTier ?? null} onChange={(v) => set('minChipsetTier', v)} format={(k) => t(`adv.tier.${k}`)} />
        </fieldset>

        <fieldset className="adv__group">
          <legend>{t('adv.camera')}</legend>
          <p className="adv__label">{t('adv.cameraLevel')}</p>
          <ChoiceChips options={CAMERA_LEVELS.map((l) => ({ key: l.key, value: l.score }))} value={r.minCameraScore ?? null} onChange={(v) => set('minCameraScore', v)} format={(o) => t(`adv.level.${o.key}`)} />
          <div className="adv__checks">{flag('telephoto')}{flag('ois')}</div>
        </fieldset>

        <fieldset className="adv__group">
          <legend>{t('adv.display')}</legend>
          <p className="adv__label">{t('adv.refresh')}</p>
          <ChoiceChips options={[90, 120, 144]} value={r.minRefresh ?? null} onChange={(v) => set('minRefresh', v)} format={(n) => `${n} Hz`} />
          <div className="adv__checks">{flag('oled')}</div>
        </fieldset>

        <fieldset className="adv__group">
          <legend>{t('adv.battery')}</legend>
          <ChoiceChips options={[4000, 4500, 5000]} value={r.minBattery ?? null} onChange={(v) => set('minBattery', v)} format={(n) => `${n} mAh`} />
        </fieldset>

        <fieldset className="adv__group">
          <legend>{t('adv.features')}</legend>
          <div className="adv__checks">{['fiveG', 'nfc', 'esim', 'wireless', 'waterResistant'].map(flag)}</div>
        </fieldset>
      </div>
      <p className="note">{t('adv.note')}</p>
    </>
  );
}

function ReviewStep({ meta, goTo }) {
  const { t, formatPrice } = useI18n();
  const { criteria } = useWizard();
  const reqs = requirementLabels(criteria.requirements, t);
  const rows = [
    ['budget', t('review.budget'), `${formatPrice(criteria.minPrice)} – ${formatPrice(criteria.maxPrice)}`],
    ['brands', t('review.brands'), criteria.brands.length ? criteria.brands.join(', ') : t('brands.allIncluded')],
    ['stores', t('review.stores'), criteria.stores ? criteria.stores.map((id) => meta.stores.find((s) => s.id === id)?.name ?? id).join(', ') : t('stores.all')],
    ['priorities', t('review.priorities'), criteria.priorities.length ? criteria.priorities.map((k, i) => `${i + 1}. ${t(`priority.${k}`)}`).join(' · ') : t('priorities.none')],
    ['details', t('review.requirements'), reqs.length ? reqs.join(' · ') : t('adv.none')],
  ];
  return (
    <dl className="review" style={{ margin: 0 }}>
      {rows.map(([step, label, value]) => (
        <div key={step} className="review__row">
          <dt className="review__label">{label}</dt>
          <dd className="review__value" style={{ margin: 0 }}>{value}</dd>
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => goTo(step)}>
            {t('review.edit')}<span className="sr-only"> — {label}</span>
          </button>
        </div>
      ))}
    </dl>
  );
}

export default function Wizard() {
  const { t } = useI18n();
  const { meta, error, loading, reload } = useMeta();
  const { criteria, dispatch } = useWizard();
  const navigate = useNavigate();
  const { name, index, goTo, back } = useStep();
  const [cleared, setCleared] = useState(false);
  const panelRef = useRef(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    panelRef.current?.focus({ preventScroll: true });
    if (panelRef.current) panelRef.current.scrollTop = 0;
  }, [name]);

  useEffect(() => {
    if (!cleared) return undefined;
    const id = setTimeout(() => setCleared(false), 3000);
    return () => clearTimeout(id);
  }, [cleared]);

  if (loading && !meta) return <div className="wizard glass"><LoadingScreen /></div>;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const submit = () => navigate({ pathname: '/results', search: `?${encodeCriteria(criteria).toString()}` });
  const last = index === STEPS.length - 1;
  const panelTitle = t(`${name === 'details' ? 'adv' : name}.title`);

  return (
    <section className="wizard glass" aria-labelledby="wizard-title">
      <h2 className="sr-only" id="wizard-title">{t('wizard.title')}</h2>
      <ol className="wizard__steps" aria-label={t('wizard.steps')}>
        {STEPS.map((s, i) => (
          <li key={s} className={`step${i === index ? ' is-active' : ''}${i < index ? ' is-done' : ''}`}>
            <button type="button" onClick={() => goTo(s)} aria-current={i === index ? 'step' : undefined}>
              <span className="step__n" aria-hidden="true">{i < index ? '✓' : i + 1}</span>
              {t(`wizard.step.${s}`)}
            </button>
          </li>
        ))}
      </ol>

      <div className="wizard__panel" ref={panelRef} tabIndex={-1}>
        <h2>
          {panelTitle}
          {name === 'details' && <span className="tag wizard__optional">{t('wizard.optional')}</span>}
        </h2>
        {name === 'budget' && <BudgetStep meta={meta} />}
        {name === 'brands' && <BrandsStep meta={meta} />}
        {name === 'stores' && <StoresStep meta={meta} />}
        {name === 'priorities' && <PrioritiesStep meta={meta} />}
        {name === 'details' && <DetailsStep meta={meta} />}
        {name === 'review' && <ReviewStep meta={meta} goTo={goTo} />}
      </div>

      <div className="wizard__actions">
        <button type="button" className="btn" onClick={back} disabled={index === 0}>{t('wizard.back')}</button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => { dispatch({ type: 'reset' }); setCleared(true); }}>{t('wizard.reset')}</button>
        <span className="spacer" />
        {!last && <button type="button" className="btn btn--ghost" onClick={submit}>{t('wizard.quick')}</button>}
        {last
          ? <button type="button" className="btn btn--primary" onClick={submit}>{t('wizard.show')}</button>
          : <button type="button" className="btn btn--primary" onClick={() => goTo(STEPS[index + 1])}>{t('wizard.next')}</button>}
      </div>
      <p className="sr-only" role="status" aria-live="polite">{cleared ? t('wizard.resetDone') : ''}</p>
    </section>
  );
}
