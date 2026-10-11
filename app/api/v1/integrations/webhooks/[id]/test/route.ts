import { NextRequest } from 'next/server';
import { authenticateIntegration } from '@/lib/integrationAuth';
import { webhookService, WebhookError } from '@/modules/webhooks/webhookService';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';

/**
 * POST /api/v1/integrations/webhooks/:id/test — envoie un événement `ping`
 * et répond avec le résultat de l'envoi (utile pour valider une intégration).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateIntegration(req);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const result = await webhookService.sendTest(auth.source.organizationId, id);
    return jsonSuccess({
      delivered: result.ok,
      statusCode: 'statusCode' in result ? result.statusCode : null,
      error: 'error' in result ? result.error : null,
    });
  } catch (error) {
    if (error instanceof WebhookError) return jsonError(error.message, error.status);
    return jsonServerError(error, "Erreur lors de l'envoi du test");
  }
}
