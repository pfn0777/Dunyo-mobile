// Fastify bootstrap: wires env/db, registers the four route groups under
// their own prefixes, and sets up the process-level concerns (CORS,
// multipart, static media in dev, health check, error/404 shape, graceful
// shutdown).

import path from 'node:path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { loadEnv, type Env } from './lib/env.js';
import { createDb, createPool, type Db } from './lib/db.js';
import { resolveAllowedOrigin } from './lib/http.js';
import { WEBP_MAX_BYTES } from './lib/validators.js';
import publicRoutes from './routes/public.js';
import customerRoutes from './routes/customer.js';
import adminRoutes from './routes/admin.js';
import webhookRoutes from './routes/webhook.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    env: Env;
  }
}

async function main(): Promise<void> {
  const env = loadEnv();
  const pool = createPool(env);
  const db = createDb(pool);

  const app = Fastify({ logger: true });
  app.decorate('db', db);
  app.decorate('env', env);

  await app.register(cors, {
    origin: (origin, callback) => {
      // No Origin header (server-to-server calls, curl, the Telegram
      // webhook) is not a browser request, so there's nothing for CORS to
      // enforce — let it through.
      if (origin === undefined) {
        callback(null, true);
        return;
      }
      callback(null, resolveAllowedOrigin(origin, env.ALLOWED_ORIGINS) !== null);
    },
  });

  await app.register(multipart, {
    limits: { fileSize: WEBP_MAX_BYTES },
  });

  if (process.env['NODE_ENV'] !== 'production') {
    // In production Caddy serves /media/* directly from the shared volume
    // (see docs/specs "Arxitektura"); this is dev/test-only so the API can
    // be exercised standalone without Caddy in front of it.
    await app.register(fastifyStatic, {
      root: path.resolve(env.MEDIA_DIR),
      prefix: '/media/',
    });
  }

  // Fastify takes a snapshot of the current error/not-found handler when a
  // plugin is registered: a handler set on the root instance AFTER a plugin
  // is registered does NOT apply to routes already registered inside that
  // plugin's encapsulated context (they keep using Fastify's own default
  // handler instead, which would leak the real error message to the
  // client). So these MUST be set before registering any route plugin.
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    reply.code(500).send({ error: { code: 'internal', message: 'Internal server error' } });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: { code: 'not_found', message: `No route: ${request.method} ${request.url}` } });
  });

  // Registered as distinct prefixes (not one hand-rolled catch-all router),
  // so /api/public/* and /api/admin/* are matched by Fastify's radix router
  // before the generic /api/* customer routes ever see them — admin is
  // registered ahead of customer for readability, though Fastify's router
  // does not actually depend on this order for disjoint concrete paths.
  await app.register(publicRoutes, { prefix: '/api/public' });
  await app.register(adminRoutes, { prefix: '/api/admin' });
  await app.register(customerRoutes, { prefix: '/api' });
  await app.register(webhookRoutes, { prefix: '/tg' });

  app.get('/health', async () => ({ ok: true }));

  await app.listen({ port: env.PORT, host: '0.0.0.0' });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info(`received ${signal}, shutting down`);
    try {
      await app.close();
    } catch (error) {
      app.log.error(error, 'error while closing fastify');
    }
    try {
      await pool.end();
    } catch (error) {
      app.log.error(error, 'error while closing the pg pool');
    }
    process.exit(0);
  };
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
}

main().catch((error: unknown) => {
  console.error('fatal: failed to start server', error);
  process.exit(1);
});
