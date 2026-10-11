import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { webhookService } from '@/modules/webhooks/webhookService';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';

export const dynamic = 'force-dynamic';

/**
 * Rejoue les webhooks en attente de nouvelle tentative.
 *
 * À appeler toutes les minutes par un planificateur (cron de l'hébergeur, UptimeRobot…) avec
 * l'en-tête `Authorization: Bearer <CRON_SECRET>`. Sans cet appel, les nouvelles tentatives
 * ne partent qu'à l'occasion des scans suivants du même espace.
 */
async function handle(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      return jsonError('CRON_SECRET non configuré', 503);
    }

    const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    const expected = Buffer.from(secret);
    const received = Buffer.from(provided);
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
      return jsonError('Non autorisé', 401);
    }

    return jsonSuccess(await webhookService.processDue(100));
  } catch (error) {
    return jsonServerError(error, 'Erreur lors du traitement des webhooks');
  }
}

export const GET = handle;
export const POST = handle;
