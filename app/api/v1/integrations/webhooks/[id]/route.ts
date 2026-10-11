import { NextRequest } from 'next/server';
import { authenticateIntegration } from '@/lib/integrationAuth';
import { webhookService, WebhookError } from '@/modules/webhooks/webhookService';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';

type Params = { params: Promise<{ id: string }> };

/** GET /api/v1/integrations/webhooks/:id — état de l'adresse et ses 20 derniers envois. */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await authenticateIntegration(req);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    return jsonSuccess(await webhookService.recentDeliveries(auth.source.organizationId, id));
  } catch (error) {
    if (error instanceof WebhookError) return jsonError(error.message, error.status);
    return jsonServerError(error, 'Erreur lors de la récupération du webhook');
  }
}

/** DELETE /api/v1/integrations/webhooks/:id — supprime l'adresse et son journal d'envois. */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await authenticateIntegration(req);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    await webhookService.remove(auth.source.organizationId, id);
    return jsonSuccess({ deleted: true });
  } catch (error) {
    if (error instanceof WebhookError) return jsonError(error.message, error.status);
    return jsonServerError(error, 'Erreur lors de la suppression du webhook');
  }
}
