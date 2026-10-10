/**
 * Client Redis — ioredis
 *
 * Singleton réutilisé entre les requêtes Next.js (évite les connexions multiples en dev).
 * Fonctionne uniquement en runtime Node.js (API routes, Server Actions).
 * ⚠️  Ne pas importer dans le middleware (Edge Runtime).
 *
 * Config .env :
 *   REDIS_URL=redis://localhost:6379          (VPS local)
 *   REDIS_URL=redis://:password@host:6379     (avec auth)
 *   REDIS_URL=rediss://host:6380              (TLS)
 */

import Redis from "ioredis";
import { logger } from "./logger";

// Singleton — évite les connexions multiples lors du hot-reload Next.js en dev
declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

function createRedisClient(): Redis {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";

  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: true,        // Connexion différée au premier appel
    connectTimeout: 5000,
    commandTimeout: 3000,
  });

  client.on("connect", () => logger.info({ url: url.replace(/:\/\/.*@/, "://***@") }, "Redis connecté"));
  client.on("error",   (err) => logger.error({ err }, "Redis erreur"));
  client.on("close",   () => logger.warn({}, "Redis connexion fermée"));

  return client;
}

let redis: Redis;

if (process.env.NODE_ENV === "production") {
  redis = createRedisClient();
} else {
  // En dev, réutiliser l'instance entre les hot-reloads
  if (!global.__redis) {
    global.__redis = createRedisClient();
  }
  redis = global.__redis;
}

export { redis };
export default redis;
