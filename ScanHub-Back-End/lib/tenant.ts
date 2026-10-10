/**
 * Cloisonnement multi-client (SaaS).
 *
 * Chaque organisation est un espace fermé : ses membres ne voient et ne modifient que
 * ses événements, billets, scans, terminaux et clés API. Le SUPER_ADMIN (propriétaire
 * de la plateforme) n'appartient à aucune organisation et voit tout.
 *
 * Règle d'or : toute requête Prisma sur une donnée métier passe par un des filtres
 * `scope.*` ci-dessous. Ne jamais filtrer « à la main » dans une route.
 */

import type { Prisma, UserRole } from "@prisma/client";
import { getUser } from "@/actions/getUser";

export interface Viewer {
  id: string;
  role: UserRole;
  /** null uniquement pour le propriétaire de la plateforme */
  organizationId: string | null;
  isSuperAdmin: boolean;
  /** Administrateur de son espace (ou de la plateforme) */
  isAdmin: boolean;
}

// Un compte sans organisation qui n'est pas SUPER_ADMIN ne doit rien voir du tout
const NO_ORGANIZATION = "__no_organization__";

export function toViewer(user: {
  id: string;
  role: UserRole;
  organizationId?: string | null;
}): Viewer {
  const isSuperAdmin = user.role === "SUPER_ADMIN";
  return {
    id: user.id,
    role: user.role,
    organizationId: isSuperAdmin ? null : (user.organizationId ?? NO_ORGANIZATION),
    isSuperAdmin,
    isAdmin: isSuperAdmin || user.role === "ADMIN",
  };
}

/**
 * Utilisateur courant du tableau de bord (Server Components / Server Actions).
 * Une session d'audit (impersonation) est en lecture seule : jamais administrateur.
 */
export async function getViewer(): Promise<Viewer | null> {
  const session = await getUser();
  const currentUser = session?.user?.user;
  if (!currentUser) return null;

  const viewer = toViewer(currentUser);
  if (session.isImpersonation) {
    return { ...viewer, isAdmin: false, isSuperAdmin: false };
  }
  return viewer;
}

/** true si la ressource (portant un organizationId) est accessible à cet utilisateur */
export function canAccessOrganization(viewer: Viewer, organizationId: string | null | undefined) {
  return viewer.organizationId === null || viewer.organizationId === organizationId;
}

/** Filtres Prisma par modèle. Pour le SUPER_ADMIN, le filtre est vide (tout est visible). */
export const scope = {
  organizations: (viewer: Viewer): Prisma.OrganizationWhereInput =>
    viewer.organizationId === null ? {} : { id: viewer.organizationId },

  users: (viewer: Viewer): Prisma.UserWhereInput =>
    viewer.organizationId === null ? {} : { organizationId: viewer.organizationId },

  events: (viewer: Viewer): Prisma.EventWhereInput =>
    viewer.organizationId === null ? {} : { organizationId: viewer.organizationId },

  sources: (viewer: Viewer): Prisma.SourceWhereInput =>
    viewer.organizationId === null ? {} : { organizationId: viewer.organizationId },

  // Un billet appartient à l'organisation de sa source
  qrCodes: (viewer: Viewer): Prisma.QRCodeWhereInput =>
    viewer.organizationId === null ? {} : { source: { organizationId: viewer.organizationId } },

  // Un terminal et un scan appartiennent à l'organisation de leur opérateur
  devices: (viewer: Viewer): Prisma.DeviceWhereInput =>
    viewer.organizationId === null ? {} : { user: { organizationId: viewer.organizationId } },

  scans: (viewer: Viewer): Prisma.ScanWhereInput =>
    viewer.organizationId === null ? {} : { user: { organizationId: viewer.organizationId } },
};
