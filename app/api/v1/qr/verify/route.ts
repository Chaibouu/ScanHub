import { NextRequest } from 'next/server';
import { qrService } from '@/modules/qr/qrService';
import { authorizeScanRequest } from '@/lib/scanAuth';
import { toViewer } from '@/lib/tenant';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';
import { z } from 'zod';

const verifySchema = z.object({
  token: z.string().trim().min(1, 'Token requis').max(512),
  eventId: z.string().optional(),
  source: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Session de l'agent et terminal vérifiés en parallèle
    const scanAuth = await authorizeScanRequest(req);
    if (!scanAuth.ok) return scanAuth.response;
    const { user } = scanAuth;

    const body = await req.json().catch(() => null);
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      return jsonError('Requête de vérification invalide', 400, parsed.error.format());
    }

    const result = await qrService.verify({
      ...parsed.data,
      organizationId: toViewer(user).organizationId,
    });
    return jsonSuccess(result);
  } catch (error) {
    return jsonServerError(error, 'Erreur interne lors de la vérification');
  }
}
