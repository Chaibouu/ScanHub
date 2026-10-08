/**
 * Rate Limiting — deux couches :
 *
 * 1. Middleware (Edge Runtime) → in-memory, utilisé dans middleware.ts
 *    Rapide, stateless, première ligne de défense.
 *
 * 2. API Routes (Node.js Runtime) → Redis sliding window, multi-instance
 *    `rateLimitRedis()` dans lib/rateLimitRedis.ts — à appeler en tête des routes sensibles.
 *
 * ⚠️  Ce fichier est importé par le middleware (Edge Runtime) : il ne doit rien importer
 *     de Node.js (ioredis, pino…), même dynamiquement. La couche Redis vit dans un
 *     fichier séparé pour rester hors du bundle Edge.
 */

import { NextRequest, NextResponse } from "next/server";
import appConfig from "@/settings";
import { getClientIP } from "./geo";

// ─── Couche 1 : In-memory (Middleware / Edge) ─────────────────────────────────

interface RequestRecord {
  count: number;
  windowStart: number;
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

const stores = new Map<string, Map<string, RequestRecord>>();

function getStore(storeKey: string): Map<string, RequestRecord> {
  if (!stores.has(storeKey)) stores.set(storeKey, new Map());
  return stores.get(storeKey)!;
}

function cleanStore(store: Map<string, RequestRecord>, windowMs: number) {
  const now = Date.now();
  for (const [ip, r] of store.entries()) {
    if (now - r.windowStart > windowMs * 2) store.delete(ip);
  }
}

export async function applyRateLimit(
  req: NextRequest,
  config?: RateLimitConfig,
  storeKey = "global"
): Promise<NextResponse | null> {
  const { windowMs, max } = config ?? appConfig.rateLimit;
  const ip = getClientIP(req);
  const store = getStore(storeKey);

  if (Math.random() < 0.02) cleanStore(store, windowMs);

  const now = Date.now();
  const existing = store.get(ip);

  if (!existing || now - existing.windowStart >= windowMs) {
    store.set(ip, { count: 1, windowStart: now });
    return null;
  }

  existing.count += 1;

  if (existing.count > max) {
    const retryAfterSec = Math.ceil((windowMs - (now - existing.windowStart)) / 1000);
    return NextResponse.json(
      { error: "Trop de requêtes, veuillez réessayer plus tard.", retryAfter: retryAfterSec },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSec),
          "X-RateLimit-Limit": String(max),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil((existing.windowStart + windowMs) / 1000)),
        },
      }
    );
  }

  return null;
}

export const rateLimitAuth  = (req: NextRequest) => applyRateLimit(req, appConfig.rateLimitAuth, "auth");
export const rateLimitEmail = (req: NextRequest) => applyRateLimit(req, appConfig.rateLimitEmail, "email");
