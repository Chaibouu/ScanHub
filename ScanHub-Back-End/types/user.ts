import { UserRole } from "@prisma/client";

export type User = {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  isActive: boolean;
  image?: string;
  /** Espace client de l'utilisateur — null pour le propriétaire de la plateforme */
  organizationId?: string | null;
  organization?: { name: string; isActive: boolean; plan: string } | null;
};

/** Métadonnées d'une session d'impersonation admin */
export type ImpersonationMeta = {
  isImpersonation: true;
  impersonatedBy: string; // adminId
};
