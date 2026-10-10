/**
 * Formules ScanHub.
 *
 * Stratégie actuelle : tout est gratuit. Les limites de la formule FREE servent de
 * garde-fou contre les abus, pas de frein commercial. Le propriétaire de la plateforme
 * peut passer un espace en UNLIMITED depuis la console (/admin/organizations).
 * Le jour où des formules payantes existent, il suffit d'ajouter des entrées ici.
 */

export interface PlanLimits {
  label: string;
  /** Événements non clôturés en même temps */
  maxActiveEvents: number;
  /** Billets / badges par événement */
  maxTicketsPerEvent: number;
  /** Terminaux mobiles (activés ou en attente) */
  maxDevices: number;
  /** Comptes membres de l'espace */
  maxMembers: number;
}

export const PLANS: Record<string, PlanLimits> = {
  FREE: {
    label: "Gratuit",
    maxActiveEvents: 5,
    maxTicketsPerEvent: 2000,
    maxDevices: 10,
    maxMembers: 20,
  },
  UNLIMITED: {
    label: "Illimité",
    maxActiveEvents: Infinity,
    maxTicketsPerEvent: Infinity,
    maxDevices: Infinity,
    maxMembers: Infinity,
  },
};

export const DEFAULT_PLAN = "FREE";

export function getPlan(plan: string | null | undefined): PlanLimits {
  return PLANS[plan ?? DEFAULT_PLAN] ?? PLANS[DEFAULT_PLAN];
}

export function formatLimit(value: number): string {
  return Number.isFinite(value) ? String(value) : "illimité";
}
