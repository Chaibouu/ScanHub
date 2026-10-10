/**
 * Healthcheck endpoint — GET /api/health
 *
 * Vérifie l'état des services critiques.
 * Utilisé par : Nginx upstream checks, PM2, UptimeRobot, etc.
 *
 * Réponses :
 *   200 { status: "ok", ... }       → tout est opérationnel
 *   503 { status: "degraded", ... } → au moins un service en erreur
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface ServiceStatus {
  status: "ok" | "error";
  latencyMs?: number;
  error?: string;
}

async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function checkRedis(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    // Import dynamique — ioredis requiert Node.js runtime
    const { redis } = await import("@/lib/redis");
    const pong = await redis.ping();
    return {
      status: pong === "PONG" ? "ok" : "error",
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function GET() {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);

  const allOk = database.status === "ok" && redis.status === "ok";
  const httpStatus = allOk ? 200 : 503;

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "unknown",
      uptime: Math.floor(process.uptime()),
      services: { database, redis },
    },
    { status: httpStatus }
  );
}
