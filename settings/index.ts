// Les noms EMAIL_SERVER_* (hérités de NextAuth) restent acceptés en repli.
const mailHost = process.env.MAIL_HOST || process.env.EMAIL_SERVER_HOST;
const mailPort = Number(process.env.MAIL_PORT || process.env.EMAIL_SERVER_PORT || 587);
const mailUser = process.env.MAIL_AUTH_USER || process.env.EMAIL_SERVER_USER;
const mailPassword = process.env.MAIL_AUTH_PASSWORD || process.env.EMAIL_SERVER_PASSWORD;

const appConfig = {
  appName: "ScanHub",
  websiteTitle: "ScanHub - Plateforme Centralisée de Scan & Vérification QR",
  websiteDescription:
    "ScanHub API & Administration - Plateforme mutualisée de contrôle QR pour événements et partenaires",
  logoUrl: "/logoo.jpg",
  sidebarClearlogoUrl: "/logoo.jpg",
  adminSidebarColor: "#1C2434",
  mailFrom: process.env.MAIL_FROM || process.env.EMAIL_FROM || mailUser,
  mailOptions: {
    host: mailHost,
    port: mailPort,
    // 465 = TLS implicite ; 587/25 = STARTTLS (secure doit rester false)
    secure: mailPort === 465,
    auth: {
      user: mailUser,
      pass: mailPassword,
    },
  },
  publicRoutes: ["/"],
  defaultLoginRedirect: "/dashboard",
  primaryColor: "#2563EB",

  // Ajout d'une option pour autoriser ou non les connexions multiples
  allowMultipleSessions: false, // ou false pour invalider les anciennes sessions

  // Rate limiting global — par IP
  rateLimit: {
    windowMs: 60 * 1000, // Fenêtre de 60 secondes (au lieu de 10s trop facilement contournable)
    max: 20, // 20 requêtes max par IP par fenêtre (routes publiques)
  },

  // Rate limiting strict pour les endpoints d'authentification sensibles
  rateLimitAuth: {
    windowMs: 15 * 60 * 1000, // Fenêtre de 15 minutes
    max: 10, // 10 tentatives max par IP (login, signup, reset)
  },

  // Rate limiting pour l'envoi d'emails (forgot-password, resend verification)
  rateLimitEmail: {
    windowMs: 60 * 60 * 1000, // Fenêtre de 1 heure
    max: 5, // 5 emails max par IP par heure (anti email-bombing)
  },

  // Configuration du Backoff progressif
  backoff: {
    maxAttempts: 5, // Nombre maximal de tentatives de connexion avant blocage
    backoffDelayFactor: 2, // Facteur de progression du backoff (multiplicateur)
  },
};

export default appConfig;
