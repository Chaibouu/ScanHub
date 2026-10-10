import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export function jsonSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      error: message,
      status,
      ...(details ? { details } : {}),
    },
    { status }
  );
}

/**
 * Erreur serveur inattendue : journalisée côté serveur, message générique côté client
 * (ne jamais renvoyer error.message — fuite de détails Prisma / internes).
 */
export function jsonServerError(error: unknown, message: string) {
  logger.error({ err: error }, message);
  return jsonError(message, 500);
}
