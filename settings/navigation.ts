export interface ChildrenItem {
  title: string;
  path: string;
  allowedRoles: string[];
}

export interface NavigationItem {
  title: string;
  icon: string;
  path: string;
  children?: ChildrenItem[];
  allowedRoles: string[];
}

export const adminNavigation: NavigationItem[] = [
  {
    title: "Tableau de Bord",
    icon: "material-symbols:dashboard",
    path: "/dashboard",
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "USER", "AGENT"],
  },
  {
    title: "Événements & Billets",
    icon: "material-symbols:calendar-today",
    path: "/events",
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "USER"],
  },
  {
    title: "Scans & Contrôles",
    icon: "material-symbols:qr-code-scanner",
    path: "/scans",
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "USER", "AGENT"],
  },
  {
    title: "Terminaux Mobiles",
    icon: "material-symbols:devices",
    path: "/devices",
    allowedRoles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    title: "Équipe",
    icon: "material-symbols:group",
    path: "/admin/users",
    allowedRoles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    title: "Billetteries (API)",
    icon: "material-symbols:integration-instructions",
    path: "/integrations",
    allowedRoles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    // Console du propriétaire de la plateforme : tous les espaces clients
    title: "Espaces clients",
    icon: "eos-icons:admin",
    path: "/admin/organizations",
    allowedRoles: ["SUPER_ADMIN"],
  },
];
