import { NextRequest } from 'next/server';
import { authenticateIntegration } from '@/lib/integrationAuth';
import { integrationService, IntegrationError } from '@/modules/integrations/integrationService';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';

/**
 * POST /api/v1/integrations/qrs/:id/restore — annule une révocation.
 * Un billet à usage unique déjà validé redevient « utilisé », pas « valide ».
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateIntegration(req);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    return jsonSuccess(
      await integrationService.setRevoked(decodeURIComponent(id), auth.source, false)
    );
  } catch (error) {
    if (error instanceof IntegrationError) return jsonError(error.message, error.status);
    return jsonServerError(error, 'Erreur lors du rétablissement du QR code');
  }
}
