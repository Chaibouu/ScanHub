# ScanHub - Plateforme Centralisée de Scan & Vérification QR (Next.js 15)

API REST centralisée et panneau d'administration pour la gestion des QR codes, des billets, badges et contrôles d'accès événementiels (EventHub, JNJL et partenaires).

## Technologies

- **Framework**: Next.js 15 (App Router)
- **Runtime**: React 19.2
- **Base de données**: Prisma + PostgreSQL
- **Authentification**: JWT RS256 + AES-256-GCM + Refresh tokens
- **Styling**: Tailwind CSS + Radix UI (shadcn/ui)
- **Validation**: Zod
- **Logging**: Pino (JSON structuré)
- **Cache / Rate limiting**: Redis (ioredis)
- **2FA**: TOTP (otplib + Google Authenticator)
- **Formulaires**: React Hook Form
- **Notifications**: Sonner
- **Icons**: Lucide React + Tabler Icons

## Authentification

### Flux de connexion
1. `POST /api/auth/login` — vérification email/mot de passe
   - Si 2FA activé → retourne `{ requires2FA: true, tempToken }` (challenge 5 min)
2. `POST /api/auth/2fa/login` — vérification TOTP → session complète
3. Tokens retournés : `accessToken` (JWT 1h) + `refreshToken` (7j / 30j avec rememberMe)

### Fonctionnalités
- Inscription avec vérification email obligatoire
- Double authentification TOTP (Google Authenticator, Authy, Bitwarden…)
- Refresh tokens (SHA-256 hashé en base, jamais stocké en clair)
- Sessions multiples configurables (`allowMultipleSessions` dans `settings/`)
- Réinitialisation et changement de mot de passe
- Changement d'email avec confirmation
- Backoff progressif sur les tentatives de connexion échouées
- Notification email sur nouvelle IP/appareil

## API v1 (terminaux mobiles & partenaires)

L'API `/api/v1` utilise **la même authentification que le portail web** (JWT RS256 chiffré
AES-256-GCM + session en base). Il n'existe plus de secret JWT séparé.

| Appelant | Identification |
|----------|----------------|
| Agent (app mobile) | `Authorization: Bearer <accessToken>` + `x-device-key: <clé du terminal>` |
| Partenaire (EventHub, JNJL…) | `x-api-key: <clé secrète>` sur `/api/v1/integrations/*` |
| Tableau de bord | cookie de session (ex : export CSV) |

### Connexion d'un agent
1. `POST /api/v1/auth/login` `{ email, password }` → `{ user, tokens: { accessToken, refreshToken, expiresIn } }`
2. `POST /api/v1/auth/refresh` `{ refreshToken }` → nouveau `accessToken` (l'ancien est aussitôt invalide)
3. `POST /api/v1/auth/logout` → ferme la session courante uniquement

### Activation d'un terminal
1. Un administrateur crée le terminal dans **Terminaux Mobiles** (ou `POST /api/v1/devices`) :
   un code d'activation à usage unique, valable 48 h, est affiché **une seule fois**.
2. L'agent saisit ce code dans l'app : `POST /api/v1/devices/activate` renvoie la clé du terminal
   (`deviceKey`), à envoyer ensuite dans l'en-tête `x-device-key`.
3. Un terminal bloqué depuis le tableau de bord est refusé immédiatement (`403`, `DEVICE_BLOCKED`).

Un compte `AGENT` ne peut scanner que depuis un terminal activé.

### Contrôle des QR codes
- `POST /api/v1/qr/verify` — lecture seule.
- `POST /api/v1/qr/consume` — enregistre le passage. Pour un billet à usage unique, la transition
  `ACTIVE → USED` est atomique : deux scans simultanés ne peuvent pas être validés tous les deux.
  `clientId` (UUID) rend l'appel idempotent.
- `GET /api/v1/sync/pull?eventId=…` — annuaire d'un événement pour le cache hors-ligne
  (`tokenHash` = SHA-256 du token, recalculable par le terminal).
- `POST /api/v1/sync/push` — remontée des scans hors-ligne. Le serveur **revalide** chaque scan ;
  un billet déjà consommé ailleurs est renvoyé en `CONFLICT`.

### Clés API partenaires
Générées depuis **Partenaires (API)** (bouton « Générer / Régénérer la clé API »). Seul le hash est
stocké : la clé n'est visible qu'au moment de sa génération.

## Sécurité

### Tokens
- JWT signés **RS256** (clé privée RSA) puis chiffrés **AES-256-GCM**
- Refresh tokens haute entropie (64 octets aléatoires), stockés hashés (SHA-256)
- `tempToken` 2FA limité à 5 minutes avec `purpose: "2fa_challenge"` dans le payload

### Rate limiting (deux couches)
| Couche | Scope | Limite |
|--------|-------|--------|
| In-memory (middleware/Edge) | Global par IP | 20 req / 60s |
| Redis sliding window (API routes) | Auth par IP | 10 tentatives / 15 min |
| Redis sliding window (API routes) | Signup/Email par IP | 5 req / 1h |

### Content Security Policy
- Nonce par requête généré dans le middleware (Edge Runtime)
- `'strict-dynamic'` + `'nonce-{nonce}'` — aucun inline script autorisé sans nonce
- En-têtes supplémentaires : `X-Frame-Options`, `X-Content-Type-Options`, `HSTS`, `Permissions-Policy`

### Détection de mots de passe compromis (HIBP)
- K-anonymity : seuls les 5 premiers caractères du hash SHA-1 sont envoyés
- L'API HIBP ne reçoit jamais le mot de passe complet
- Header `Add-Padding: true` pour masquer la taille de la réponse
- Fail-open : une erreur réseau ne bloque pas l'inscription

### Uploads
- Validation du magic number binaire (JPEG, PNG, GIF, WebP, PDF)
- Extension sanitisée, nom de fichier remplacé par un UUID aléatoire
- Vérification du type MIME déclaré vs signature réelle

### Audit log
Chaque action sensible est tracée dans `AuditLog` (Prisma) :
`LOGIN_SUCCESS`, `LOGIN_FAILURE`, `LOGOUT`, `SIGNUP`, `2FA_ENABLED`, `2FA_DISABLED`, `2FA_FAILURE`, `2FA_SUCCESS`, `PASSWORD_RESET`, `PASSWORD_CHANGED`, `IMPERSONATION_START`, `IMPERSONATION_END`, `EMAIL_CHANGED`, `ACCOUNT_DISABLED`, `ACCOUNT_DELETED`

## Impersonation admin

Permet à un ADMIN d'auditer un compte utilisateur sans connaître son mot de passe.

```
POST /api/admin/impersonate   { targetUserId }   Authorization: Bearer <adminToken>
DELETE /api/admin/impersonate/end                Authorization: Bearer <impersonationToken>
```

- La session admin n'est jamais touchée — un cookie `impersonationToken` séparé (httpOnly) est créé
- Session d'impersonation limitée à **15 minutes**, non renouvelable
- Impossible d'impersonner un autre ADMIN
- Bannière orange affichée dans l'UI tant que la session d'impersonation est active
- Server Actions : `startImpersonation(targetUserId)` / `endImpersonation()` (cookies gérés côté serveur uniquement)

## Logging structuré (Pino)

```ts
import { logger } from "@/lib/logger";

logger.logAuth("LOGIN_SUCCESS", userId, email);
logger.logRequest("GET", "/api/health", 200, 12);
logger.logDatabase("query", "user.findUnique", 8);
logger.logSecurity("RATE_LIMIT", ip, "Trop de tentatives");
```

- Pino-pretty en développement, JSON brut en production
- Niveau contrôlé par `LOG_LEVEL` (env)

## Health check

```
GET /api/health
```

Retourne `200 { status: "ok" }` si DB + Redis répondent, `503 { status: "degraded" }` sinon. Utile pour les probes Kubernetes / load balancers.

## Structure du projet

```
ScanHub-Back-End/
├── app/
│   ├── (dashboard)/
│   │   ├── admin/
│   │   │   └── users/          # Interface d'impersonation
│   │   └── …
│   ├── api/
│   │   ├── admin/impersonate/  # POST + DELETE /end
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   ├── 2fa/
│   │   │   │   ├── setup/      # GET — génère QR code TOTP
│   │   │   │   ├── verify-setup/ # POST — confirme enrollment
│   │   │   │   └── login/      # POST — étape 2 connexion
│   │   │   ├── refresh/
│   │   │   ├── logout/
│   │   │   ├── forgot-password/
│   │   │   ├── reset-password/
│   │   │   ├── change-password/
│   │   │   ├── change-email/
│   │   │   └── verify/
│   │   ├── health/             # GET — healthcheck DB + Redis
│   │   ├── profile/
│   │   ├── upload/
│   │   └── v1/                 # Endpoints REST ScanHub (QR, Sync, Scans, Events, Devices)
│   └── layout.tsx              # Lit x-nonce pour CSP
├── actions/
│   ├── impersonate.ts          # Server Actions (cookies httpOnly)
│   └── getUser.ts              # Vérifie impersonationToken en priorité
├── components/
│   ├── ImpersonationBanner.tsx # Bannière admin session
│   ├── admin/ImpersonateButton.tsx
│   └── …
├── lib/
│   ├── tokens.ts               # JWT RS256 + AES-256-GCM
│   ├── rateLimit.ts            # In-memory + Redis sliding window
│   ├── redis.ts                # Singleton ioredis
│   ├── audit.ts                # AuditLog helper
│   ├── hibp.ts                 # HIBP k-anonymity
│   ├── logger.ts               # Pino wrapper
│   ├── mail.ts                 # Nodemailer (login notif, vérif, reset)
│   ├── upload.ts               # Magic number + UUID filename
│   └── geo.ts                  # IP → géolocalisation
├── context/SessionContext.tsx
├── middleware.ts               # CSP nonce + rate limiting Edge
├── settings/index.ts           # Config centralisée
└── prisma/schema.prisma
```

## Installation

### Prérequis
- Node.js 18+
- PostgreSQL
- Redis (local ou Redis Cloud)

### Démarrage

```bash
git clone <repository-url>
cd ScanHub-Back-End

npm install

cp .env.example .env.local
# Remplir les variables (voir section ci-dessous)

docker compose up -d       # PostgreSQL + Redis locaux (optionnel)
npx prisma migrate deploy  # Applique les migrations versionnées
npm run seed               # Données de test (dev uniquement, voir ci-dessous)
npm run dev
```

Le seed crée trois comptes (super admin, admin, agent). Leurs mots de passe viennent de
`SEED_SUPER_ADMIN_PASSWORD`, `SEED_ADMIN_PASSWORD` et `SEED_AGENT_PASSWORD` ; s'ils sont absents,
un mot de passe aléatoire est généré et affiché une seule fois dans la console. Le seed refuse de
s'exécuter avec `NODE_ENV=production`.

```bash
SEED_ADMIN_PASSWORD='…' SEED_AGENT_PASSWORD='…' npm run seed
```

### Variables d'environnement

```env
# Base de données PostgreSQL
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/scanhub?schema=public"

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# JWT (RS256) — générer avec openssl
RSA_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n…"
RSA_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n…"

# AES-256-GCM — 32 octets aléatoires en hexadécimal (64 caractères)
AES_SECRET_KEY="hex-encoded-32-bytes"

# Redis
REDIS_URL="redis://localhost:6379"

# Peppers de hachage — OBLIGATOIRES en production (32 octets aléatoires en hex)
# QR_PEPPER : hash des tokens QR. API_KEY_PEPPER : clés partenaires, clés de terminaux,
# codes d'activation. Les changer invalide les valeurs déjà enregistrées.
QR_PEPPER="…"
API_KEY_PEPPER="…"

# Email (Nodemailer)
MAIL_AUTH_USER="your-email@gmail.com"
MAIL_AUTH_PASSWORD="your-app-password"
MAIL_HOST="smtp.gmail.com"
MAIL_PORT="587"

# Optionnel
LOG_LEVEL="debug"          # trace | debug | info | warn | error
```

#### Génération des clés RSA

```bash
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

#### Génération de la clé AES

```bash
node scripts/generate-aes-key.js
```

## Scripts

```bash
npm run dev              # Développement
npm run build            # Build production
npm run start            # Serveur production
npm run lint             # ESLint
npm run type-check       # TypeScript
npm run db:migrate       # Crée + applique une migration (dev)
npx prisma migrate deploy  # Applique les migrations (production / CI)
npm run db:studio        # Prisma Studio
npm run seed             # Seed base de données
npm test                 # Tests Jest
npm run test:coverage    # Couverture
```

## Déploiement

### Docker

```bash
docker build -t scanhub-backend .
docker run -p 3000:3000 \
  -e DATABASE_URL="…" \
  -e NEXT_PUBLIC_APP_URL="…" \
  -e RSA_PRIVATE_KEY="…" \
  -e RSA_PUBLIC_KEY="…" \
  -e AES_SECRET_KEY="…" \
  -e QR_PEPPER="…" \
  -e API_KEY_PEPPER="…" \
  -e REDIS_URL="…" \
  scanhub-backend
```

L'image n'applique pas les migrations au démarrage : lancer `npx prisma migrate deploy` depuis
le job de déploiement avant de démarrer le conteneur.

## Licence

MIT — voir `LICENSE`.

---

Développé pour ScanHub

