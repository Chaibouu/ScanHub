# Dockerfile pour Next.js 15 (sortie "standalone" — voir next.config.mjs)
FROM node:20-alpine AS base
# openssl : requis par le moteur de requêtes Prisma
RUN apk add --no-cache libc6-compat openssl

# ─── Dépendances ──────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

# .npmrc (legacy-peer-deps) et le schéma Prisma sont nécessaires dès l'installation :
# le script postinstall exécute `prisma generate`.
COPY package.json package-lock.json* .npmrc ./
COPY prisma ./prisma
RUN npm ci

# ─── Build ────────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate
RUN npm run build

# ─── Image de production ──────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

# Les migrations ne sont pas jouées au démarrage : exécuter `npx prisma migrate deploy`
# depuis la CI / un job de déploiement avant de lancer cette image.
CMD ["node", "server.js"]
