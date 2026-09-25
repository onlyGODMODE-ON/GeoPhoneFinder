import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { createCatalogService } from './services/catalog-service.js';
import { apiRoutes } from './routes/api.js';
import { webRoutes } from './routes/web.js';
import { runIngestion } from './ingestion/pipeline.js';
import { CriteriaError } from './domain/errors.js';

/**
 * Builds the HTTP app. Kept separate from server.js so tests can use app.inject()
 * against an in-memory database.
 */
export async function buildApp({ config, db, logger = false, clock, ingestOptions = {}, isReady = () => true }) {
  const app = Fastify({ logger, trustProxy: true, bodyLimit: 64 * 1024 });

  await app.register(helmet, { contentSecurityPolicy: false, crossOriginEmbedderPolicy: false });
  await app.register(cors, { origin: config.corsOrigin ?? !config.isProd });

  const catalog = createCatalogService({ db, config, clock });

  const runIngest = async () => {
    const result = await runIngestion({ db, config, logger: app.log, ...ingestOptions });
    catalog.invalidate();
    return result;
  };

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof CriteriaError) {
      return reply.code(400).send({ error: 'invalid_criteria', message: err.message, details: err.details });
    }
    if (err.validation) {
      return reply.code(400).send({ error: 'validation', message: err.message, details: err.validation.map((v) => `${v.instancePath || '(root)'} ${v.message}`) });
    }
    if (err.statusCode && err.statusCode < 500) {
      return reply.code(err.statusCode).send({ error: err.code ?? 'error', message: err.message });
    }
    req.log.error(err);
    return reply.code(500).send({ error: 'internal', message: 'Something went wrong' });
  });

  // While the very first ingestion is still filling an EMPTY catalog the API answers 503 + Retry-After instead of
  // pretending there are no phones. The frontend retries automatically, so nobody has to reload the page.
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/') || req.url.startsWith('/api/health') || isReady()) return undefined;
    reply.code(503).header('retry-after', '2').send({ error: 'starting', message: 'The catalog is loading, please wait a moment.' });
    return reply;
  });

  // Public API: rate limited (PRD §29).
  await app.register(
    async (api) => {
      await api.register(rateLimit, { max: config.rateLimitMax, timeWindow: '1 minute' });
      await api.register(apiRoutes, { catalog, config, runIngest, isReady });
    },
    { prefix: '/api' },
  );

  await app.register(webRoutes, { catalog, config });

  return { app, catalog, runIngest };
}
