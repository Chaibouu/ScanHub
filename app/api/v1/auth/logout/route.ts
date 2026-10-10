import { NextRequest } from 'next/server';
import { authService } from '@/modules/auth/authService';
import { jsonSuccess, jsonServerError } from '@/lib/response';
import { getClientIP } from '@/lib/geo';

export async function POST(req: NextRequest) {
  try {
    const ctx = await authService.authenticate(req);

    if (ctx) {
      await authService.logout(ctx, {
        ipAddress: getClientIP(req),
        userAgent: req.headers.get('user-agent') ?? undefined,
      });
    }

    // Réponse identique que la session existe ou non : la déconnexion est idempotente
    return jsonSuccess({ success: true, message: 'Déconnexion effectuée.' });
  } catch (error) {
    return jsonServerError(error, 'Erreur lors de la déconnexion');
  }
}
