/**
 * Tests de bout en bout de l'API et du tableau de bord.
 *
 *   npm run test:e2e
 *
 * Prérequis :
 *   - le serveur tourne (npm run dev, ou npm run build && npm start) sur E2E_BASE_URL
 *     (défaut : http://localhost:3000) ;
 *   - SEED_ADMIN_PASSWORD et SEED_AGENT_PASSWORD sont définis (.env ou environnement) ;
 *   - les compteurs de rate limiting Redis (clés rl:*) sont remis à zéro ;
 *   - DATABASE_URL pointe sur une base locale : ces tests VIDENT les scans, terminaux et
 *     QR partenaires, puis rejouent le seed. Ils refusent toute base non locale.
 */
const { spawnSync } = require("child_process");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const root = path.resolve(__dirname, "..", "..");

// Charge .env comme le fait Next.js (sans écraser les variables déjà définies)
require("@next/env").loadEnvConfig(root, true, { info: () => {}, error: console.error });

function requireEnv(name) {
  if (!process.env[name]) {
    console.error(`✖ ${name} doit être défini pour lancer les tests e2e.`);
    process.exit(1);
  }
}

async function resetDatabase() {
  if (!/localhost|127\.0\.0\.1|@db:|@postgres:/.test(process.env.DATABASE_URL || "")) {
    throw new Error("Refus : DATABASE_URL ne pointe pas sur une base locale.");
  }
  const prisma = new PrismaClient();
  try {
    await prisma.scan.deleteMany({});
    await prisma.device.deleteMany({});
    await prisma.qRCode.deleteMany({
      where: { metadata: { path: ["registeredVia"], equals: "API_INTEGRATION" } },
    });
    await prisma.user.deleteMany({ where: { email: { endsWith: "@e2e.scanhub.test" } } });
    // Espaces jetables créés par les tests de cloisonnement (événements et sources en cascade)
    await prisma.organization.deleteMany({ where: { slug: { startsWith: "e2e-" } } });
    // Événements créés par les tests de l'API développeur (sinon la limite de la formule est atteinte)
    await prisma.event.deleteMany({ where: { name: { startsWith: "E2E " } } });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Les limites de débit (Redis, 10 connexions / 15 min par IP) sont plus basses que le nombre
 * de connexions d'un cycle de tests répété : on repart de compteurs vides.
 */
async function resetRateLimits() {
  const Redis = require("ioredis");
  const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    retryStrategy: () => null,
  });
  redis.on("error", () => {});
  try {
    await redis.connect();
    const keys = await redis.keys("rl:*");
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // Redis absent : le rate limiting est alors inactif côté serveur
  } finally {
    redis.disconnect();
  }
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: true });
  return result.status ?? 1;
}

(async () => {
  requireEnv("DATABASE_URL");
  requireEnv("SEED_ADMIN_PASSWORD");
  requireEnv("SEED_AGENT_PASSWORD");

  await resetDatabase();
  if (run("npx", ["prisma", "db", "seed"]) !== 0) process.exit(1);

  let failed = 0;
  await resetRateLimits();
  for (const file of [
    "api.e2e.mjs",
    "web.e2e.mjs",
    "security.e2e.cjs",
    "tenant.e2e.cjs",
    "developer-api.e2e.mjs",
  ]) {
    console.log(`\n━━ ${file} ━━`);
    if (run("node", [path.join("tests", "e2e", file)]) !== 0) failed++;
    await resetRateLimits();
  }

  // Laisse une base propre (billets de test de nouveau valides)
  await resetDatabase();
  run("npx", ["prisma", "db", "seed"]);

  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
