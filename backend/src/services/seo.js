import fs from 'node:fs';
import path from 'node:path';
import { phoneName } from '../domain/cards.js';
import { applicableOffers, primaryOffer } from '../domain/offers.js';
import { formatStorage } from '../domain/identity.js';

export const SITE_NAME = 'PhoneFinder GE';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const jsonLd = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

export function variantLabel(p) {
  return [p.ram ? `${p.ram}GB` : null, p.storage ? formatStorage(p.storage).toUpperCase() : null].filter(Boolean).join('/');
}

/** Unique title + description + canonical + structured data for a product page (PRD §27). */
export function buildPhoneSeo(phone, snapshot, config, now = new Date()) {
  const label = variantLabel(phone);
  const name = `${phoneName(phone)}${label ? ` ${label}` : ''}`;
  const activeIds = new Set(snapshot.stores.filter((s) => s.active).map((s) => s.id));
  const current = applicableOffers(phone, { allowedStoreIds: activeIds, now, staleAfterHours: snapshot.staleAfterHours });
  const best = primaryOffer(current);
  const canonical = `${config.siteUrl}/phone/${phone.slug}`;

  const title = `${name} — ფასი და სპეციფიკაცია | ${SITE_NAME}`;
  const bits = [
    phone.chipset?.name,
    phone.display?.sizeInch ? `${phone.display.sizeInch}″ ეკრანი` : null,
    phone.battery?.capacityMah ? `${phone.battery.capacityMah} mAh` : null,
  ].filter(Boolean);
  const description = `${name}: ${best ? `ფასი ${best.price} ₾-დან ქართულ მაღაზიებში. ` : 'სპეციფიკაცია და ქულები. '}${bits.join(', ')}. შეადარეთ შეთავაზებები და ქულები.`.slice(0, 300);

  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    brand: { '@type': 'Brand', name: phone.brand },
    model: phone.model,
    url: canonical,
    ...(phone.imageUrl ? { image: phone.imageUrl } : {}),
    description,
    ...(current.length
      ? {
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'GEL',
            lowPrice: Math.min(...current.map((o) => o.price)),
            highPrice: Math.max(...current.map((o) => o.price)),
            offerCount: current.length,
            offers: current.map((o) => ({
              '@type': 'Offer',
              price: o.price,
              priceCurrency: 'GEL',
              availability: 'https://schema.org/InStock',
              url: o.url,
              seller: { '@type': 'Organization', name: o.storeName },
            })),
          },
        }
      : {}),
  };

  return { title, description, canonical, jsonLd: product, name, best, current };
}

/** Minimal crawlable HTML placed inside #root; React replaces it on load. */
export function staticPhoneHtml(phone, seo) {
  const rows = [
    ['Chipset', phone.chipset?.name],
    ['RAM', phone.ram ? `${phone.ram} GB` : null],
    ['Storage', phone.storage ? `${phone.storage} GB` : null],
    ['Display', phone.display ? `${phone.display.sizeInch}″ ${phone.display.panel ?? ''} ${phone.display.refreshRateHz ?? ''}Hz` : null],
    ['Battery', phone.battery?.capacityMah ? `${phone.battery.capacityMah} mAh` : null],
    ['Main camera', phone.cameras?.main?.mp ? `${phone.cameras.main.mp} MP` : null],
  ].filter(([, v]) => v);
  return `<main style="font-family:system-ui;max-width:720px;margin:2rem auto;padding:0 1rem">
<h1>${esc(seo.name)}</h1>
<p>${esc(seo.description)}</p>
<ul>${rows.map(([k, v]) => `<li>${esc(k)}: ${esc(v)}</li>`).join('')}</ul>
<h2>Prices</h2>
<ul>${seo.current.map((o) => `<li>${esc(o.storeName)}: ${esc(o.price)} GEL</li>`).join('') || '<li>No current offers</li>'}</ul>
</main>`;
}

/** Reads the built SPA shell once and injects per-page head tags / crawlable content. */
export function createHtmlShell(distDir) {
  const file = path.join(distDir, 'index.html');
  let cache = null;
  const available = () => fs.existsSync(file);
  const template = () => (cache ??= fs.readFileSync(file, 'utf8'));
  return {
    available,
    render({ title, description, canonical, jsonLd: ld, bodyHtml, noindex } = {}) {
      let html = template();
      if (title) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
      // one description only: replace the shell's default instead of adding a second tag
      if (description) html = html.replace(/<meta name="description"[^>]*>\s*/i, '');
      const head = [
        description ? `<meta name="description" content="${esc(description)}">` : '',
        canonical ? `<link rel="canonical" href="${esc(canonical)}">` : '',
        title ? `<meta property="og:title" content="${esc(title)}">` : '',
        description ? `<meta property="og:description" content="${esc(description)}">` : '',
        canonical ? `<meta property="og:url" content="${esc(canonical)}">` : '',
        '<meta property="og:type" content="website">',
        noindex ? '<meta name="robots" content="noindex,follow">' : '',
        ld ? `<script type="application/ld+json">${jsonLd(ld)}</script>` : '',
      ].join('\n');
      html = html.replace('</head>', `${head}\n</head>`);
      if (bodyHtml) html = html.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`);
      return html;
    },
  };
}
