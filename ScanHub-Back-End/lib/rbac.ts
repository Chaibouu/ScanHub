import { User, UserRole } from '@prisma/client';
import { authService } from '@/modules/auth/authService';

/** Rôles opérationnels autorisés à contrôler des accès (scan, sync). */
export const STAFF_ROLES: UserRole[] = [UserRole.AGENT, UserRole.ADMIN, UserRole.SUPER_ADMIN];
export const ADMIN_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN];

type AuthorizeResult =
  | { authorized: true; error: null; status: 200; user: User }
  | { authorized: false; error: string; status: 401 | 403; user: User | null };

export async function authorizeUser(
  request: Request,
  allowedRoles: UserRole[] = STAFF_ROLES
): Promise<AuthorizeResult> {
  const user = await authService.authenticateRequest(request);
  if (!user) {
    return { authorized: false, error: 'Authentification requise', status: 401, user: null };
  }

  if (!allowedRoles.includes(user.role)) {
    return {
      authorized: false,
      error: 'Droits insuffisants pour effectuer cette opération (RBAC)',
      status: 403,
      user,
    };
  }

  return { authorized: true, error: null, status: 200, user };
}
