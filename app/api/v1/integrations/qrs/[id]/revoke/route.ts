import { NextRequest } from 'next/server';
import { authenticateIntegration } from '@/lib/integrationAuth';
import { integrationService, IntegrationError } from '@/modules/integrations/integrationService';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** POST /api/v1/integrations/qrs/:id/revoke — le code est refusé dès le scan suivant. */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await authenticateIntegration(req);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!id) {
      return jsonError('Identifiant du QR Code manquant', 400);
    }

    return jsonSuccess(
      await integrationService.setRevoked(decodeURIComponent(id), auth.source, true)
    );
  } catch (error) {
    if (error instanceof IntegrationError) return jsonError(error.message, error.status);
    return jsonServerError(error, 'Erreur lors de la révocation du QR code');
  }
}
