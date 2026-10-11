import { NextRequest } from 'next/server';
import { authenticateIntegration } from '@/lib/integrationAuth';
import {
  integrationService,
  IntegrationError,
  MAX_BATCH_SIZE,
} from '@/modules/integrations/integrationService';
import { qrItemSchema, QR_TYPES } from '@/modules/integrations/schemas';
import { PlanLimitError } from '@/modules/organizations/organizationService';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';
import { z } from 'zod';

const batchSchema = z.object({
  // Valeurs appliquées aux éléments qui ne les précisent pas
  eventId: z.string().min(1).optional(),
  type: z.enum(QR_TYPES).optional(),
  qrs: z.array(qrItemSchema).min(1).max(MAX_BATCH_SIZE),
});

/**
 * POST /api/v1/integrations/qrs/batch — crée jusqu'à 500 codes en un appel.
 * Les `externalId` déjà connus sont renvoyés tels quels (created: false) : le lot peut être rejoué.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateIntegration(req);
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => null);
    const parsed = batchSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(`Lot invalide (1 à ${MAX_BATCH_SIZE} codes)`, 400, parsed.error.format());
    }

    const result = await integrationService.registerBatch(
      parsed.data.qrs.map((item) => ({ ...item, type: item.type ?? parsed.data.type ?? 'TICKET' })),
      { eventId: parsed.data.eventId, type: parsed.data.type ?? 'TICKET' },
      auth.source
    );

    return jsonSuccess(result, result.created > 0 ? 201 : 200);
  } catch (error) {
    if (error instanceof IntegrationError) return jsonError(error.message, error.status);
    if (error instanceof PlanLimitError) return jsonError(error.message, 403);
    return jsonServerError(error, "Erreur lors de l'enregistrement du lot de QR codes");
  }
}
