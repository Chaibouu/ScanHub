import { NextRequest } from 'next/server';
import { authenticateIntegration } from '@/lib/integrationAuth';
import { qrService } from '@/modules/qr/qrService';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';
import { z } from 'zod';

const verifySchema = z.object({
  token: z.string().trim().min(1, 'Token requis').max(512),
  eventId: z.string().min(1).optional(),
});

/**
 * POST /api/v1/integrations/verify — indique si un code est valide, sans rien modifier.
 * Pour scanner depuis votre propre application. Porte sur tous les codes de votre espace.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateIntegration(req);
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => null);
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Requête de vérification invalide', 400, parsed.error.format());
    }

    const result = await qrService.verify({
      organizationId: auth.source.organizationId,
      token: parsed.data.token,
      eventId: parsed.data.eventId,
    });
    return jsonSuccess(result);
  } catch (error) {
    return jsonServerError(error, 'Erreur interne lors de la vérification');
  }
}
