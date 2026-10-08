import { NextRequest } from 'next/server';
import { integrationService, IntegrationError } from '@/modules/integrations/integrationService';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const apiKey = req.headers.get('x-api-key');
    const source = await integrationService.authenticateApiKey(apiKey);

    if (!source) {
      return jsonError('Clé API partenaire invalide ou non autorisée', 401);
    }

    const { id } = await params;

    if (!id) {
      return jsonError('Identifiant du QR Code manquant', 400);
    }

    const result = await integrationService.revokeQRCode(id, source.id);
    return jsonSuccess(result);
  } catch (error) {
    if (error instanceof IntegrationError) {
      return jsonError(error.message, error.status);
    }
    return jsonServerError(error, 'Erreur lors de la révocation du QR code');
  }
}
