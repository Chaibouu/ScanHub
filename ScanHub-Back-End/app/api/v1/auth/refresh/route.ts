import { NextRequest } from 'next/server';
import { authService, AuthError } from '@/modules/auth/authService';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';
import { z } from 'zod';

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token requis'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = refreshSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError('Format de token invalide', 400, parsed.error.format());
    }

    const tokens = await authService.refresh(parsed.data.refreshToken);
    return jsonSuccess(tokens);
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.status);
    }
    return jsonServerError(error, 'Erreur lors du renouvellement de la session');
  }
}
