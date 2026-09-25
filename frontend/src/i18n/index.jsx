import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import ka from './ka.js';
import en from './en.js';

const DICTS = { ka, en };
const LOCALES = { ka: 'ka-GE', en: 'en-US' };
const STORAGE_KEY = 'pf.lang';

export function translate(lang, key, vars) {
  const raw = DICTS[lang]?.[key] ?? DICTS.en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) => (vars[k] === undefined ? `{${k}}` : String(vars[k])));
}

const I18nContext = createContext(null);

function initialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ka' || saved === 'en') return saved;
  } catch { /* storage unavailable */ }
  return 'ka';
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  }, []);

  const value = useMemo(() => {
    const locale = LOCALES[lang];
    const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
    let rtf;
    try { rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }); } catch { rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' }); }
    const df = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
    return {
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
      formatNumber: (n) => nf.format(n),
      formatPrice: (n) => `${nf.format(n)} ₾`,
      formatDate: (iso) => df.format(new Date(iso)),
      formatRelative: (iso, now = Date.now()) => {
        const diff = new Date(iso).getTime() - now;
        const abs = Math.abs(diff);
        if (abs < 60_000) return rtf.format(0, 'second');
        if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute');
        if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), 'hour');
        return rtf.format(Math.round(diff / 86_400_000), 'day');
      },
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
