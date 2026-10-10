/**
 * Rate limiting Redis (Node.js runtime uniquement — API routes, Server Actions).
 * Ne jamais importer ce fichier depuis le middleware (Edge Runtime).
 */

import { NextResponse } from "next/server";
import appConfig from "@/settings";
import { redis } from "./redis";

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

// ─── Couche 2 : Redis sliding window (API Routes / Node.js) ──────────────────

/**
 * Rate limiting Redis — sliding window avec sorted sets.
 * Persistant et partagé entre toutes les instances PM2.
 *
 * @param key       Clé unique (ex: `"login:${ip}"`, `"signup:${email}"`)
 * @param config    Fenêtre et max requêtes
 * @returns         NextResponse 429 si limite atteinte, null sinon
 */
export async function rateLimitRedis(
  key: string,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  try {
    const { windowMs, max } = config;

    const now = Date.now();
    const windowStart = now - windowMs;
    const redisKey = `rl:${key}`;

    // Pipeline atomique : supprimer les entrées expirées + ajouter la courante + compter
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(redisKey, "-inf", windowStart);  // Nettoyage
    pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);   // Ajout
    pipeline.zcard(redisKey);                                   // Comptage
    pipeline.pexpire(redisKey, windowMs);                      // TTL auto-nettoyage

    const results = await pipeline.exec();
    const count = (results?.[2]?.[1] as number) ?? 0;

    if (count > max) {
      const retryAfterSec = Math.ceil(windowMs / 1000);
      return NextResponse.json(
        { error: "Trop de requêtes, veuillez réessayer plus tard.", retryAfter: retryAfterSec },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSec),
            "X-RateLimit-Limit": String(max),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    return null;
  } catch {
    // Si Redis est indisponible, fail open (ne pas bloquer les utilisateurs)
    return null;
  }
}

// Raccourcis Redis pour les endpoints critiques
export const rateLimitRedisAuth = (ip: string) =>
  rateLimitRedis(`auth:${ip}`, appConfig.rateLimitAuth);

export const rateLimitRedisEmail = (ip: string) =>
  rateLimitRedis(`email:${ip}`, appConfig.rateLimitEmail);
