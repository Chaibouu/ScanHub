import { NextRequest } from 'next/server';
import { authenticateIntegration } from '@/lib/integrationAuth';
import { webhookService, WebhookError } from '@/modules/webhooks/webhookService';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';
import { z } from 'zod';

/** GET /api/v1/integrations/webhooks — adresses de notification de votre espace. */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateIntegration(req);
    if (!auth.ok) return auth.response;

    return jsonSuccess({ webhooks: await webhookService.list(auth.source.organizationId) });
  } catch (error) {
    return jsonServerError(error, 'Erreur lors de la récupération des webhooks');
  }
}

const createSchema = z.object({ url: z.string().trim().min(1).max(2000) });

/**
 * POST /api/v1/integrations/webhooks — ajoute une adresse de notification.
 * La réponse contient `secret` (signature des envois) : il n'est donné qu'une seule fois.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateIntegration(req);
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError('url requise', 400, parsed.error.format());

    const { endpoint, secret } = await webhookService.create(
      auth.source.organizationId,
      parsed.data.url
    );
    return jsonSuccess({ ...endpoint, secret }, 201);
  } catch (error) {
    if (error instanceof WebhookError) return jsonError(error.message, error.status);
    return jsonServerError(error, 'Erreur lors de la création du webhook');
  }
}
