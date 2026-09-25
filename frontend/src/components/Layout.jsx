import { useEffect, useRef } from 'react';
import { NavLink, Link, Outlet, useLocation, useNavigationType } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useMeta } from '../state/MetaContext.jsx';
import { useCompare } from '../state/CompareContext.jsx';
import { Logo } from './Icons.jsx';
import CompareBar from './CompareBar.jsx';

function LangSwitch() {
  const { t, lang, setLang } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label={t('lang.label')}>
      <button type="button" aria-pressed={lang === 'ka'} onClick={() => setLang('ka')} lang="ka">KA</button>
      <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')} lang="en">EN</button>
    </div>
  );
}

function Header() {
  const { t } = useI18n();
  const { items } = useCompare();
  const cls = ({ isActive }) => `nav__link${isActive ? ' active' : ''}`;
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link to="/" className="brand"><Logo /><span>{t('app.name')}</span></Link>
        <nav className="nav" aria-label={t('nav.main')}>
          <NavLink to="/" end className={cls}>{t('nav.recommend')}</NavLink>
          <NavLink to="/search" className={cls}>{t('nav.search')}</NavLink>
          <NavLink to="/compare" className={cls}>
            {t('nav.compare')}
            {items.length > 0 && <span className="badge" aria-label={t('compare.count', { n: items.length })}>{items.length}</span>}
          </NavLink>
        </nav>
        <LangSwitch />
      </div>
    </header>
  );
}

function Footer() {
  const { t } = useI18n();
  const { meta } = useMeta();
  return (
    <footer className="site-footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <Link to="/" className="brand"><Logo /><span>{t('app.name')}</span></Link>
          <p>{t('footer.about')}</p>
        </div>
        <nav aria-labelledby="footer-nav">
          <h2 className="footer__title" id="footer-nav">{t('footer.nav')}</h2>
          <ul className="footer__list">
            <li><Link to="/">{t('nav.recommend')}</Link></li>
            <li><Link to="/search">{t('nav.search')}</Link></li>
            <li><Link to="/compare">{t('nav.compare')}</Link></li>
          </ul>
        </nav>
        <div>
          <h2 className="footer__title" id="footer-stores">{t('footer.stores')}</h2>
          <ul className="footer__list footer__stores" aria-labelledby="footer-stores">
            {(meta?.stores ?? []).map((s) => (
              <li key={s.id}><a href={s.baseUrl} target="_blank" rel="noopener noreferrer nofollow">{s.name}</a></li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="footer__title">{t('footer.data')}</h2>
          <p>{t('footer.rules')}</p>
          <p>{t('footer.prices')}</p>
        </div>
      </div>
      <div className="container footer__bar">
        <span>{t('footer.rights', { year: new Date().getFullYear() })}</span>
        <LangSwitch />
      </div>
    </footer>
  );
}

const SCROLL_KEY = 'pf.scroll';
function loadPositions() {
  try { return new Map(JSON.parse(sessionStorage.getItem(SCROLL_KEY) || '[]')); } catch { return new Map(); }
}

/**
 * Scroll behaviour that matches what people expect from the browser:
 *  - Back / Forward (POP): return to exactly where the user was on that page;
 *  - a new page (PUSH to another path): start at the top and move focus to <main>;
 *  - moving between wizard steps (same path): do not scroll at all.
 */
function useScrollRestoration(mainRef) {
  const { key, pathname } = useLocation();
  const navType = useNavigationType();
  const positions = useRef(null);
  const lastPath = useRef(pathname);
  if (positions.current === null) positions.current = loadPositions();

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  }, []);

  // remember the scroll position of the current history entry
  useEffect(() => {
    let raf = 0;
    const save = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        positions.current.set(key, window.scrollY);
        try { sessionStorage.setItem(SCROLL_KEY, JSON.stringify([...positions.current].slice(-80))); } catch { /* ignore */ }
      });
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => { window.removeEventListener('scroll', save); cancelAnimationFrame(raf); };
  }, [key]);

  useEffect(() => {
    const samePath = lastPath.current === pathname;
    lastPath.current = pathname;

    if (navType === 'POP') {
      const y = positions.current.get(key) ?? 0;
      let tries = 0;
      const attempt = () => {
        // content may still be rendering; retry for ~1 s until the page is tall enough
        const tall = document.documentElement.scrollHeight >= y + window.innerHeight - 4;
        window.scrollTo(0, y);
        if (!tall && tries++ < 60) requestAnimationFrame(attempt);
      };
      attempt();
    } else if (!samePath) {
      window.scrollTo(0, 0);
      mainRef.current?.focus({ preventScroll: true });
    }
  }, [key, pathname, navType, mainRef]);
}

export default function Layout() {
  const { t } = useI18n();
  const { meta } = useMeta();
  const mainRef = useRef(null);
  useScrollRestoration(mainRef);

  return (
    <>
      {/* fixed, viewport-sized background: never clipped by a section edge and fine on iOS */}
      <div className="app-bg" aria-hidden="true">
        <i className="app-bg__blob app-bg__blob--a" />
        <i className="app-bg__blob app-bg__blob--b" />
        <i className="app-bg__blob app-bg__blob--c" />
      </div>
      <a className="skip-link" href="#main">{t('skip')}</a>
      <Header />
      {meta?.demo && <div className="demo-banner" role="note">{t('demo.banner')}</div>}
      <main id="main" tabIndex={-1} ref={mainRef} style={{ outline: 'none' }}>
        <Outlet />
      </main>
      <Footer />
      <CompareBar />
    </>
  );
}
