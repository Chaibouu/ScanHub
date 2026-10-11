import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { authenticateIntegration } from '@/lib/integrationAuth';
import { qrService } from '@/modules/qr/qrService';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';
import { z } from 'zod';

const consumeSchema = z.object({
  token: z.string().trim().min(1, 'Token requis').max(512),
  eventId: z.string().min(1).optional(),
  idempotencyKey: z.string().trim().min(8).max(100).optional(),
});

/**
 * POST /api/v1/integrations/consume — enregistre un passage.
 * Un billet à usage unique passe à « utilisé » : un second appel répond ALREADY_USED.
 *
 * `idempotencyKey` (ou l'en-tête `Idempotency-Key`) : rejouer la même requête après une
 * coupure réseau rend le résultat d'origine au lieu de compter un second passage.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateIntegration(req);
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => null);
    const parsed = consumeSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Requête de consommation invalide', 400, parsed.error.format());
    }

    const idempotencyKey =
      parsed.data.idempotencyKey ?? req.headers.get('idempotency-key')?.trim() ?? crypto.randomUUID();
    if (idempotencyKey.length < 8 || idempotencyKey.length > 100) {
      return jsonError('Idempotency-Key : 8 à 100 caractères.', 400);
    }

    const result = await qrService.consume({
      organizationId: auth.source.organizationId,
      token: parsed.data.token,
      eventId: parsed.data.eventId,
      // Préfixée par la clé API : deux clients ne peuvent pas se télescoper
      clientId: `api:${auth.source.id}:${idempotencyKey}`,
      sourceId: auth.source.id,
    });

    return jsonSuccess(result);
  } catch (error) {
    return jsonServerError(error, 'Erreur interne lors de la consommation');
  }
}
