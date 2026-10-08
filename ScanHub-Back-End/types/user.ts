import { UserRole } from "@prisma/client";

export type User = {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  isActive: boolean;
  image?: string;
};

/** Métadonnées d'une session d'impersonation admin */
export type ImpersonationMeta = {
  isImpersonation: true;
  impersonatedBy: string; // adminId
};
