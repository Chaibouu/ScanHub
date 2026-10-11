import { NextRequest } from 'next/server';
import { authenticateIntegration } from '@/lib/integrationAuth';
import { integrationService, IntegrationError } from '@/modules/integrations/integrationService';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';

/**
 * GET /api/v1/integrations/qrs/:id — détail d'un code.
 * `:id` est l'identifiant ScanHub ou votre propre référence (`externalId`).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateIntegration(req);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    return jsonSuccess(await integrationService.getQRCode(decodeURIComponent(id), auth.source));
  } catch (error) {
    if (error instanceof IntegrationError) return jsonError(error.message, error.status);
    return jsonServerError(error, 'Erreur lors de la récupération du QR code');
  }
}
