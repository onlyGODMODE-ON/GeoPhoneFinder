import fs from 'node:fs';
import path from 'node:path';
import fastifyStatic from '@fastify/static';
import { findPhone } from '../domain/search.js';
import { buildPhoneSeo, createHtmlShell, staticPhoneHtml } from '../services/seo.js';

const NOINDEX_PREFIXES = ['/results', '/search', '/compare'];

/** robots.txt, sitemap.xml, SEO-friendly product pages and the SPA shell (production build only). */
export async function webRoutes(app, { catalog, config }) {
  app.get('/robots.txt', async (_req, reply) => {
    reply.type('text/plain').send(
      ['User-agent: *', 'Allow: /', 'Disallow: /results', 'Disallow: /search', 'Disallow: /compare', 'Disallow: /api/', `Sitemap: ${config.siteUrl}/sitemap.xml`, ''].join('\n'),
    );
  });

  app.get('/sitemap.xml', async (_req, reply) => {
    const snap = await catalog.getSnapshot();
    const urls = [
      `<url><loc>${config.siteUrl}/</loc></url>`,
      ...snap.phones.map((p) => `<url><loc>${config.siteUrl}/phone/${p.slug}</loc><lastmod>${p.lastUpdated.slice(0, 10)}</lastmod></url>`),
    ];
    reply.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
  });

  const dist = config.frontendDist;
  const shell = createHtmlShell(dist);
  if (!shell.available()) {
    app.log.info(`frontend build not found at ${dist} — run "npm run build" (in dev use the Vite server on :5173)`);
    app.setNotFoundHandler((req, reply) => reply.code(404).send({ error: 'not_found', message: 'Frontend not built. Use the Vite dev server or run `npm run build`.' }));
    return;
  }

  await app.register(fastifyStatic, {
    root: path.resolve(dist),
    prefix: '/',
    index: false,
    wildcard: false,
    cacheControl: false, // we set it ourselves below
    setHeaders(res, filePath) {
      // Vite fingerprints everything in /assets, so it can be cached forever; other files must revalidate.
      const immutable = filePath.replace(/\\/g, '/').includes('/assets/');
      res.setHeader('cache-control', immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate');
    },
  });

  // Crawlable product page: unique <title>, description, canonical URL, JSON-LD and static content.
  app.get('/phone/:id', async (req, reply) => {
    const snap = await catalog.getSnapshot();
    const phone = findPhone(snap, req.params.id);
    if (!phone) return reply.code(404).type('text/html').send(shell.render({ title: 'Phone not found', noindex: true }));
    const seo = buildPhoneSeo(phone, snap, config, catalog.now());
    // Only the slug URL is canonical, even when the page was opened by UUID.
    return reply.header('cache-control', 'no-cache').type('text/html').send(shell.render({ ...seo, bodyHtml: staticPhoneHtml(phone, seo) }));
  });

  app.setNotFoundHandler((req, reply) => {
    if (!['GET', 'HEAD'].includes(req.method) || req.url.startsWith('/api/')) return reply.code(404).send({ error: 'not_found' });
    const pathname = req.url.split('?')[0];
    const noindex = NOINDEX_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    return reply.header('cache-control', 'no-cache').type('text/html').send(shell.render({ noindex, canonical: pathname === '/' ? `${config.siteUrl}/` : undefined }));
  });
}
