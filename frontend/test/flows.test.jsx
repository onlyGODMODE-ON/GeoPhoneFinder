// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { I18nProvider } from '../src/i18n/index.jsx';
import { MetaProvider } from '../src/state/MetaContext.jsx';
import { WizardProvider } from '../src/state/WizardContext.jsx';
import { CompareProvider } from '../src/state/CompareContext.jsx';
import Layout from '../src/components/Layout.jsx';
import HomePage from '../src/pages/HomePage.jsx';
import ResultsPage from '../src/pages/ResultsPage.jsx';
import PhoneDetailsPage from '../src/pages/PhoneDetailsPage.jsx';
import SearchPage from '../src/pages/SearchPage.jsx';
import { PRIORITY_KEYS } from '../src/lib/priorities.js';
import { cacheClear } from '../src/lib/cache.js';

const STORES = [
  { id: 'zoommer', name: 'Zoommer', baseUrl: 'https://zoommer.ge' },
  { id: 'alta', name: 'Alta', baseUrl: 'https://alta.ge' },
  { id: 'gstore', name: 'GStore', baseUrl: 'https://gstore.ge' },
];
const META = {
  brands: [{ name: 'Samsung', count: 5 }, { name: 'Xiaomi', count: 6 }],
  stores: STORES,
  priorities: PRIORITY_KEYS.map((key) => ({ key, label: key })),
  storageOptions: [128, 256, 512, 1024], ramOptions: [8, 12], processors: ['Apple', 'Qualcomm'],
  price: { min: 300, max: 4200 }, maxResults: 10, maxCompare: 3, budgetTolerance: 0.05, demo: true,
};

const scores = Object.fromEntries(PRIORITY_KEYS.map((k) => [k, 60]));
const card = (i) => ({ id: `id-${i}`, slug: `phone-${i}`, brand: 'Samsung', model: `Model ${i}`, name: `Samsung Model ${i}`, ram: 8, storage: 256, imageUrl: null, chipset: { id: 'c', name: 'Exynos 1480', vendor: 'Samsung' }, highlights: { displaySizeInch: 6.6, refreshRateHz: 120, batteryMah: 5000, mainCameraMp: 50, fiveG: true }, scores, lastUpdated: new Date().toISOString() });
const offer = (over = {}) => ({ id: 'o1', storeId: 'zoommer', storeName: 'Zoommer', price: 899, currency: 'GEL', url: 'https://shop.test/x', imageUrl: null, color: 'Navy', available: true, state: 'current', stale: false, recentlyUpdated: true, lastUpdated: new Date().toISOString(), isPrimary: true, eligible: true, ...over });
const result = (i) => ({
  rank: i, phone: card(i), primaryOffer: offer({ id: `o${i}`, url: `https://zoommer.ge/exact-phone-${i}` }),
  offers: [
    offer({ id: `o${i}`, url: `https://zoommer.ge/exact-phone-${i}` }),
    offer({ id: `s${i}`, storeId: 'alta', storeName: 'Alta', price: 949, isPrimary: false, state: 'stale', stale: true, recentlyUpdated: false, eligible: false }),
    offer({ id: `x${i}`, storeId: 'gstore', storeName: 'GStore', price: 979, isPrimary: false, recentlyUpdated: false, eligible: false }),
  ],
  finalScore: 60 - i, match: 60 - i, priorityScores: [{ key: 'gaming', score: 71 }, { key: 'camera', score: null }], missingPriorities: ['camera'], storageFit: { target: 256, actual: 256, status: 'exact' },
});

let calls;
const recCalls = () => calls.filter((c) => c.url === '/api/recommendations');

beforeEach(() => {
  calls = [];
  cacheClear();
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem('pf.lang', 'en');
  window.scrollTo = vi.fn();
  globalThis.fetch = vi.fn(async (url, opts = {}) => {
    calls.push({ url, body: opts.body ? JSON.parse(opts.body) : null });
    const json = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
    if (url === '/api/meta') return json(META);
    if (url === '/api/recommendations') return json({ criteria: { allowedMax: 1050 }, candidateCount: 4, results: [1, 2, 3, 4].map(result), storageSummary: { target: 256, exact: 4, nearby: 0, other: 0, unknown: 0 } });
    if (url.startsWith('/api/phones/suggest')) return json({ suggestions: ['Samsung Galaxy S24'] });
    if (url.startsWith('/api/phones?')) return json({ items: [{ phone: card(1), primaryOffer: offer(), offerCount: 3 }], total: 1, page: 1, pages: 1, pageSize: 12, sort: 'relevance' });
    if (url.startsWith('/api/phones/phone-1')) {
      const offers = [
        offer({ url: 'https://zoommer.ge/exact-phone-1', color: 'Navy' }),
        offer({ id: 'o2', storeId: 'alta', storeName: 'Alta', price: 949, isPrimary: false, color: 'Lilac', imageUrl: 'https://cdn.alta.ge/a.jpg', url: 'https://alta.ge/exact-phone-1' }),
        offer({ id: 'o3', storeId: 'gstore', storeName: 'GStore', price: 979, isPrimary: false, color: 'Mint', url: 'https://gstore.ge/exact-phone-1' }),
      ];
      return json({ phone: { ...card(1), specs: { chipset: { name: 'Exynos 1480', cores: '8-core (4+4)', cpuScore: 55, gpu: 'Mali-G68 MP5', gpuScore: 60, performanceTier: 'mid' }, display: { sizeInch: 6.6, refreshRateHz: 120 }, battery: { capacityMah: 5000 } }, scoreDetails: { gaming: { coverage: 0.8, missing: [] } }, source: 'zoommer', sourceUrl: 'https://shop.test/x' }, offers, primaryOffer: offers[0] });
    }
    if (url.startsWith('/api/phones/nope')) return json({ error: 'not_found', message: 'Phone not found' }, 404);
    return json({}, 404);
  });
});
afterEach(cleanup);

function Where() {
  const l = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="where">{l.pathname}{l.search}</output>
      <button type="button" onClick={() => navigate(-1)}>__browser-back</button>
      <button type="button" onClick={() => navigate(1)}>__browser-forward</button>
    </>
  );
}
function App({ start = '/' }) {
  return (
    <MemoryRouter initialEntries={[start]}>
      <I18nProvider><MetaProvider><WizardProvider><CompareProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="results" element={<ResultsPage />} />
            <Route path="phone/:id" element={<PhoneDetailsPage />} />
            <Route path="search" element={<SearchPage />} />
          </Route>
        </Routes>
        <Where />
      </CompareProvider></WizardProvider></MetaProvider></I18nProvider>
    </MemoryRouter>
  );
}
const next = (user) => user.click(screen.getByRole('button', { name: /^Next$/ }));
const where = () => screen.getByTestId('where').textContent;

describe('recommendation wizard', () => {
  test('is general: budget, brands, stores, priorities — no memory question', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'What is your budget?' })).toBeInTheDocument();
    const steps = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('button').map((b) => b.textContent.replace(/^[✓\d]+/, ''));
    expect(steps).toEqual(['Budget', 'Brands', 'Stores', 'Priorities', 'Extras', 'Review']);
    expect(screen.queryByText(/How much storage/)).not.toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/Demo data/);
    expect(screen.getByText(/up to 1,575/)).toBeInTheDocument(); // 5% tolerance shown as information, not an input
    expect(screen.getAllByRole('slider')).toHaveLength(2);
  });

  test('full flow incl. the OPTIONAL expert step -> /results with the right request', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'What is your budget?' });
    await next(user);
    await user.click(screen.getByRole('button', { name: /Samsung/ }));
    await next(user);
    await user.click(screen.getByRole('button', { name: /Alta/ })); // stores: restrict
    await next(user);

    await user.click(screen.getByRole('button', { name: /\+ Camera/ }));
    await user.click(screen.getByRole('button', { name: /\+ Gaming/ }));
    await user.click(screen.getByRole('button', { name: /\+ Battery/ }));
    await user.click(screen.getByRole('button', { name: 'Move up: Battery' }));
    const list = screen.getByRole('list', { name: /Selected priorities/ });
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual([expect.stringContaining('Camera'), expect.stringContaining('Battery'), expect.stringContaining('Gaming')]);
    await next(user);

    // optional extras — everything here is a choice, nothing is required
    expect(screen.getByRole('heading', { name: /Extra requirements/ })).toBeInTheDocument();
    expect(screen.getByText('optional')).toBeInTheDocument();
    expect(screen.getByText('Nothing set')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '8 GB' }));
    await user.click(screen.getByRole('button', { name: 'Qualcomm' }));
    await user.click(screen.getByRole('button', { name: 'Very good' }));
    await user.click(screen.getByRole('checkbox', { name: '5G' }));
    expect(screen.getByText('Set: 4')).toBeInTheDocument();
    await next(user);

    expect(screen.getByText('1. Camera · 2. Battery · 3. Gaming')).toBeInTheDocument();
    expect(screen.getByText(/RAM: min\. 8 GB/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Show recommendations/ }));

    await waitFor(() => expect(where()).toMatch(/^\/results\?/));
    const rec = await waitFor(() => { expect(recCalls()).toHaveLength(1); return recCalls()[0]; });
    expect(rec.body).toEqual({
      minPrice: 500, maxPrice: 1500, brands: ['Samsung'], storage: null, stores: ['zoommer', 'gstore'],
      priorities: ['camera', 'battery', 'gaming'],
      requirements: { minRam: 8, vendors: ['Qualcomm'], minCameraScore: 60, fiveG: true },
    });
    expect(Object.keys(rec.body)).not.toContain('tolerance');
  });

  test('skipping the expert step is fine: "Show results now" sends NO requirements', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /Show results now/ }));
    await waitFor(() => expect(recCalls()).toHaveLength(1));
    expect(recCalls()[0].body).toMatchObject({ stores: [], brands: [], storage: null, priorities: [], requirements: {} });
  });

  test('the current step is in the URL, and browser Back/Forward walk through the steps', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'What is your budget?' });
    await next(user);
    expect(where()).toBe('/?step=brands');
    await next(user);
    expect(where()).toBe('/?step=stores');
    await user.click(screen.getByRole('button', { name: '__browser-back' }));
    expect(await screen.findByRole('heading', { name: 'Which brands are you interested in?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '__browser-forward' }));
    expect(await screen.findByRole('heading', { name: 'Which stores?' })).toBeInTheDocument();
    // the wizard's own Back button behaves like the browser's
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(where()).toBe('/?step=brands');
  });

  test('going Back from the results keeps ALL selections; they are cleared only by "Clear everything"', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'What is your budget?' });
    await next(user);
    await user.click(screen.getByRole('button', { name: /Xiaomi/ }));
    await next(user); await next(user);
    await user.click(screen.getByRole('button', { name: /\+ Display/ }));
    await next(user);
    await user.click(screen.getByRole('button', { name: '120 Hz' }));
    await next(user);
    await user.click(screen.getByRole('button', { name: /Show recommendations/ }));
    await screen.findByRole('article', { name: 'Samsung Model 1' });

    await user.click(screen.getByRole('button', { name: '__browser-back' })); // browser Back to the wizard
    expect(await screen.findByRole('heading', { name: 'Check your choices' })).toBeInTheDocument();
    expect(screen.getByText('Xiaomi')).toBeInTheDocument();
    expect(screen.getByText('1. Display')).toBeInTheDocument();
    expect(screen.getByText(/Display: min\. 120 Hz/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('pf.wizard.v2')).brands).toEqual(['Xiaomi']); // persisted beyond the tab session

    await user.click(screen.getByRole('button', { name: 'Clear everything' }));
    expect(await screen.findByText('All brands included')).toBeInTheDocument();
    expect(screen.getByText('Nothing set')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('pf.wizard.v2')).brands).toEqual([]);
  });
});

describe('results page', () => {
  const start = '/results?min=500&max=1000&priority=gaming&priority=camera&storage=256';

  test('rank, match, price, storage fit, and unknown score shown as an em dash (never 0)', async () => {
    render(<App start={start} />);
    const first = await screen.findByRole('article', { name: 'Samsung Model 1' });
    expect(within(first).getByLabelText('Rank 1')).toBeInTheDocument();
    expect(first.querySelector('.phone-card__media .rank')).not.toBeNull(); // the number sits in the corner of the photo box
    expect(within(first).getByRole('img', { name: 'Match 59%' })).toBeInTheDocument();
    expect(within(first).getByText(/899/)).toBeInTheDocument();
    expect(within(first).getByText('Colour: Navy')).toBeInTheDocument();
    expect(within(first).getByText('✓ Exactly 256 GB')).toBeInTheDocument();
    expect(within(first).getByText('Camera').querySelector('b').textContent).toBe('—');
    expect(screen.getByText(/limit with 5% margin: 1,050/)).toBeInTheDocument();
  });

  test('the store button opens THAT store\'s page for THAT exact phone', async () => {
    render(<App start={start} />);
    for (const i of [1, 2, 3]) {
      const article = await screen.findByRole('article', { name: `Samsung Model ${i}` });
      const link = within(article).getByRole('link', { name: 'View at Zoommer' });
      expect(link).toHaveAttribute('href', `https://zoommer.ge/exact-phone-${i}`);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel')).toMatch(/noopener/);
    }
  });

  test('summary shows the optional requirements that were applied', async () => {
    render(<App start="/results?max=1000&r.minRam=12&r.flag=nfc" />);
    expect(await screen.findByText('RAM: min. 12 GB')).toBeInTheDocument();
    expect(screen.getByText('NFC')).toBeInTheDocument();
  });

  test('expanding a card loads specs and lists every offer with its freshness state', async () => {
    const user = userEvent.setup();
    render(<App start={start} />);
    const first = await screen.findByRole('article', { name: 'Samsung Model 1' });
    const btn = within(first).getByRole('button', { name: 'Details' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    await user.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(await within(first).findByText('Exynos 1480', { selector: 'dd' })).toBeInTheDocument();
    expect(within(first).getByText('Alta')).toBeInTheDocument();
    expect(within(first).getByText(/Outdated data/)).toBeInTheDocument();
    expect(within(first).getByText('Not in your selected stores')).toBeInTheDocument();
    expect(within(first).getByText('Some data is unavailable and not counted in the score.')).toBeInTheDocument();
  });

  test('Back from a product page: results appear instantly (no new request) and the expanded card stays open', async () => {
    const user = userEvent.setup();
    render(<App start={start} />);
    const first = await screen.findByRole('article', { name: 'Samsung Model 1' });
    await user.click(within(first).getByRole('button', { name: 'Details' }));
    await within(first).findByText('Exynos 1480', { selector: 'dd' });
    expect(recCalls()).toHaveLength(1);

    await user.click(within(first).getByRole('link', { name: 'Samsung Model 1' })); // open the product page
    expect(await screen.findByRole('heading', { level: 1, name: 'Samsung Model 1' })).toBeInTheDocument();
    expect(where()).toBe('/phone/phone-1');

    await user.click(screen.getByRole('button', { name: '__browser-back' }));
    const again = await screen.findByRole('article', { name: 'Samsung Model 1' });
    expect(within(again).getByRole('button', { name: 'Collapse' })).toHaveAttribute('aria-expanded', 'true');
    expect(recCalls()).toHaveLength(1); // served from the in-memory cache
  });

  test('comparison holds at most 3 phones and explains why', async () => {
    const user = userEvent.setup();
    render(<App start={start} />);
    await screen.findByRole('article', { name: 'Samsung Model 1' });
    const buttons = () => screen.getAllByRole('button', { name: 'Add to compare' });
    for (let i = 0; i < 3; i++) await user.click(buttons()[0]);
    expect(screen.getByRole('region', { name: 'Compare' })).toHaveTextContent('3 / 3');
    await user.click(buttons()[0]);
    expect(await screen.findByText('You can compare up to 3 phones.')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('pf.compare'))).toHaveLength(3);
  });

  test('language switch flips the UI to Georgian', async () => {
    const user = userEvent.setup();
    render(<App start={start} />);
    await screen.findByRole('heading', { name: 'Your recommendations' });
    await user.click(screen.getAllByRole('button', { name: 'KA' })[0]);
    expect(await screen.findByRole('heading', { name: 'თქვენი რეკომენდაციები' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('ka');
  });
});

describe('footer', () => {
  test('lists every compared store with a link to its site', async () => {
    render(<App start="/results?max=1000" />);
    const footer = await screen.findByRole('contentinfo');
    const stores = await within(footer).findByRole('list', { name: 'Stores we compare' });
    expect(within(stores).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Zoommer', 'https://zoommer.ge'], ['Alta', 'https://alta.ge'], ['GStore', 'https://gstore.ge'],
    ]);
  });
});

describe('product page', () => {
  test('gallery: one photo/illustration per store offer; the store\'s own photo is used when it has one', async () => {
    const user = userEvent.setup();
    render(<App start="/phone/phone-1" />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Samsung Model 1' })).toBeInTheDocument();
    const thumbs = within(screen.getByRole('list', { name: 'Photos' })).getAllByRole('button');
    expect(thumbs.map((b) => b.getAttribute('aria-label'))).toEqual(['Zoommer: Navy', 'Photo from Alta', 'GStore: Mint', 'Front view']);
    await user.click(thumbs[1]);
    expect(document.querySelector('img.phone-photo').getAttribute('src')).toBe('https://cdn.alta.ge/a.jpg');
    expect(screen.getByRole('heading', { name: 'Prices & Stores' })).toBeInTheDocument();
    expect(screen.getByText(/Specifications provided by: Zoommer/)).toBeInTheDocument();
    expect(document.title).toMatch(/Samsung Model 1/);
  });

  test('the processor section shows its name, cores, CPU/GPU score and the graphics chip name', async () => {
    render(<App start="/phone/phone-1" />);
    await screen.findByRole('heading', { level: 1, name: 'Samsung Model 1' });
    const specs = screen.getByRole('heading', { name: 'Specifications' }).closest('section');
    expect(within(specs).getByText('Exynos 1480')).toBeInTheDocument();
    expect(within(specs).getByText('8-core (4+4)')).toBeInTheDocument();
    expect(within(specs).getByText('55/100')).toBeInTheDocument();
    expect(within(specs).getByText('Mali-G68 MP5')).toBeInTheDocument();
    expect(within(specs).getByText('60/100')).toBeInTheDocument();
    expect(within(specs).getByText('Mid-range')).toBeInTheDocument();
  });

  test('every offer button opens its own store at the exact phone', async () => {
    render(<App start="/phone/phone-1" />);
    await screen.findByRole('heading', { level: 1, name: 'Samsung Model 1' });
    const offers = within(screen.getByRole('heading', { name: 'Prices & Stores' }).closest('section')).getAllByRole('link');
    expect(offers.map((a) => a.getAttribute('href'))).toEqual(['https://zoommer.ge/exact-phone-1', 'https://alta.ge/exact-phone-1', 'https://gstore.ge/exact-phone-1']);
  });

  test('unknown phone => not-found state and noindex', async () => {
    render(<App start="/phone/nope" />);
    expect(await screen.findByText('This phone could not be found.')).toBeInTheDocument();
    expect(document.head.querySelector('meta[name="robots"]')?.content).toBe('noindex,follow');
  });
});

describe('search page', () => {
  const searchCalls = () => calls.filter((c) => c.url.startsWith('/api/phones?')).map((c) => new URL(`http://x${c.url}`).searchParams);

  test('searches WHILE TYPING (no Enter) and keeps the space the user typed', async () => {
    const user = userEvent.setup();
    render(<App start="/search" />);
    const box = await screen.findByRole('combobox', { name: 'Brand, model or name' });
    await user.type(box, 'sam ');
    await waitFor(() => expect(searchCalls().some((p) => p.get('q') === 'sam')).toBe(true));
    expect(box).toHaveValue('sam '); // not overwritten by the URL round trip
    expect(where()).toBe('/search?q=sam');
  });

  test('typing does not fill the browser history: one Back leaves the search page', async () => {
    const user = userEvent.setup();
    render(<App start="/" />);
    await screen.findByRole('heading', { name: 'What is your budget?' });
    await user.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: 'Search' }));
    const box = await screen.findByRole('combobox', { name: 'Brand, model or name' });
    await user.type(box, 'galaxy');
    await waitFor(() => expect(where()).toBe('/search?q=galaxy'));
    await user.click(screen.getByRole('button', { name: '__browser-back' }));
    await waitFor(() => expect(where()).toBe('/'));
  });

  test('a phone is listed with its rank-less card and the store link', async () => {
    render(<App start="/search?q=sam" />);
    const card1 = await screen.findByRole('article', { name: 'Samsung Model 1' });
    expect(within(card1).queryByLabelText(/^Rank/)).toBeNull(); // no numbering in search
    expect(within(card1).getByRole('link', { name: 'View at Zoommer' })).toHaveAttribute('href', 'https://shop.test/x');
  });
});

describe('startup resilience (cold backend)', () => {
  test('while /api/meta is still pending, the home page shows a real loading screen (spinner + message), not a blank page', async () => {
    let resolveMeta;
    globalThis.fetch = vi.fn(async (url, opts = {}) => {
      calls.push({ url, body: opts.body ? JSON.parse(opts.body) : null });
      if (url === '/api/meta') return new Promise((resolve) => { resolveMeta = () => resolve({ ok: true, status: 200, json: async () => META }); });
      return { ok: true, status: 200, json: async () => ({}) };
    });

    render(<App />);
    expect(await screen.findByText('Loading…')).toBeInTheDocument();
    expect(screen.getByText('Connecting to the server…')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'What is your budget?' })).not.toBeInTheDocument();

    resolveMeta();
    expect(await screen.findByRole('heading', { name: 'What is your budget?' })).toBeInTheDocument();
  });

  test('on the search page, the search box and button are usable IMMEDIATELY, even before /api/meta resolves', async () => {
    let resolveMeta;
    globalThis.fetch = vi.fn(async (url, opts = {}) => {
      calls.push({ url, body: opts.body ? JSON.parse(opts.body) : null });
      if (url === '/api/meta') return new Promise((resolve) => { resolveMeta = () => resolve({ ok: true, status: 200, json: async () => META }); });
      if (url.startsWith('/api/phones?')) return { ok: true, status: 200, json: async () => ({ items: [{ phone: card(1), primaryOffer: offer(), offerCount: 1 }], total: 1, page: 1, pages: 1, pageSize: 12, sort: 'relevance' }) };
      return { ok: true, status: 200, json: async () => ({}) };
    });

    const user = userEvent.setup();
    render(<App start="/search" />);
    const box = await screen.findByRole('combobox', { name: 'Brand, model or name' });
    const button = screen.getByRole('button', { name: 'Search' });
    expect(button).toBeEnabled();

    await user.type(box, 'sam');
    await user.click(button);
    expect(where()).toBe('/search?q=sam'); // the click works right away, meta or no meta

    resolveMeta?.();
    await screen.findByRole('article', { name: 'Samsung Model 1' });
  });

  test('a few transient failures (503 while loading, or the server not listening yet) are retried automatically — no error is ever shown, no reload needed', async () => {
    let attempts = 0;
    globalThis.fetch = vi.fn(async (url, opts = {}) => {
      calls.push({ url, body: opts.body ? JSON.parse(opts.body) : null });
      if (url === '/api/meta') {
        attempts += 1;
        if (attempts === 1) return { ok: false, status: 503, json: async () => ({ error: 'starting', message: 'loading' }) };
        if (attempts === 2) throw new TypeError('Failed to fetch'); // dev backend not listening yet
        return { ok: true, status: 200, json: async () => META };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    render(<App />);
    expect(screen.queryByText('Could not load the data.')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'What is your budget?' }, { timeout: 6000 })).toBeInTheDocument();
    expect(attempts).toBe(3); // 503, then a network error, then success — all handled without user action
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  }, 8000);

  test('once retries are exhausted a real error is shown, with a manual retry button', async () => {
    globalThis.fetch = vi.fn(async (url) => {
      calls.push({ url });
      if (url === '/api/meta') return { ok: false, status: 500, json: async () => ({ error: 'internal', message: 'db is down' }) };
      return { ok: true, status: 200, json: async () => ({}) };
    });
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('overall-score ranking (no priorities chosen)', () => {
  test('results are ranked by an overall score, the UI says so, and the ring is labelled "Overall score"', async () => {
    globalThis.fetch = vi.fn(async (url, opts = {}) => {
      calls.push({ url, body: opts.body ? JSON.parse(opts.body) : null });
      const json = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
      if (url === '/api/meta') return json(META);
      if (url === '/api/recommendations') {
        return json({
          criteria: { allowedMax: 1050 },
          candidateCount: 2,
          rankedBy: 'overall',
          results: [1, 2].map((i) => ({ ...result(i), priorityScores: [], missingPriorities: [] })),
          storageSummary: null,
        });
      }
      return json({}, 404);
    });

    render(<App start="/results?max=1000" />);
    const first = await screen.findByRole('article', { name: 'Samsung Model 1' });
    expect(screen.getByText(/ranked by an overall score/i)).toBeInTheDocument();
    expect(screen.queryByText(/sorted by price/i)).not.toBeInTheDocument();
    expect(within(first).getByRole('img', { name: 'Overall score 59%' })).toBeInTheDocument();

    await userEvent.setup().click(within(first).getByRole('button', { name: 'Details' }));
    expect(within(first).getByText(/Overall score \(average across all categories\)/)).toBeInTheDocument();
  });

  test('with priorities chosen, the ring goes back to a plain "Match" percentage', async () => {
    render(<App start="/results?min=500&max=1000&priority=gaming&priority=camera&storage=256" />);
    const first = await screen.findByRole('article', { name: 'Samsung Model 1' });
    expect(within(first).getByRole('img', { name: 'Match 59%' })).toBeInTheDocument();
    expect(screen.queryByText(/ranked by an overall score/i)).not.toBeInTheDocument();
  });
});
