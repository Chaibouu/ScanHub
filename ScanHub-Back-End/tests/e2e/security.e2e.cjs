// Vérifie les correctifs de sécurité web : impersonation et révocation des sessions
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const B = process.env.E2E_BASE_URL || 'http://localhost:3000';
const { SEED_AGENT_PASSWORD: AGENT_PW, SEED_ADMIN_PASSWORD: ADMIN_PW } = process.env;
const AGENT2_EMAIL = 'agent2@e2e.scanhub.test';
const AGENT2_PW = 'E2e-temp-password-1';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${cond ? '' : extra}`); };

async function webLogin(email, password) {
  // Le middleware limite /api/auth à 20 requêtes/min par IP : on patiente au lieu d'échouer
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const j = await r.json();
    if (r.status === 429 && attempt < 5 && (j.retryAfter ?? 5) <= 60) {
      await new Promise((resolve) => setTimeout(resolve, ((j.retryAfter ?? 5) + 1) * 1000));
      continue;
    }
    if (!r.ok) throw new Error(`login ${email}: ${r.status} ${JSON.stringify(j)}`);
    return { ...j, cookie: `accessToken=${encodeURIComponent(j.accessToken)}; refreshToken=${j.refreshToken}` };
  }
}
const page = async (p, cookie) => {
  const r = await fetch(B + p, { headers: cookie ? { cookie } : {}, redirect: 'manual' });
  return { s: r.status, loc: r.headers.get('location') || '' };
};
const impersonate = (token, targetUserId) =>
  fetch(B + '/api/admin/impersonate', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ targetUserId }) })
    .then(async (r) => ({ s: r.status, j: await r.json().catch(() => null) }));
const profile = (token) => fetch(B + '/api/profile', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.status);

(async () => {
  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true } });
  const superAdmin = users.find((u) => u.role === 'SUPER_ADMIN');
  const agent = users.find((u) => u.email === 'agent@scanhub.ne');
  // Compte jetable (supprimé par run.cjs) pour tester la désactivation
  const agent2 = await prisma.user.create({
    data: {
      name: 'Agent E2E',
      email: AGENT2_EMAIL,
      role: 'AGENT',
      emailVerified: new Date(),
      password: await bcrypt.hash(AGENT2_PW, 10),
    },
  });

  // ── Impersonation
  const admin = await webLogin('admin@gmail.com', ADMIN_PW);
  let r = await impersonate(admin.accessToken, superAdmin.id);
  ok('ADMIN ne peut pas impersonner un SUPER_ADMIN', r.s === 403, r.s);
  r = await impersonate(admin.accessToken, agent.id);
  ok('ADMIN peut auditer un AGENT', r.s === 200 && r.j.impersonationToken, r.s);
  const impToken = r.j?.impersonationToken;
  ok('le token d audit donne acces au profil de la cible', (await profile(impToken)) === 200);
  r = await impersonate(impToken, agent2.id);
  ok('une session d audit ne peut pas en ouvrir une autre', r.s === 401 || r.s === 403, r.s);
  const agentSession = await webLogin('agent@scanhub.ne', AGENT_PW);
  r = await impersonate(agentSession.accessToken, agent2.id);
  ok('un AGENT ne peut pas impersonner', r.s === 403, r.s);

  // ── Révocation à la déconnexion web
  ok('profil OK avant deconnexion', (await profile(agentSession.accessToken)) === 200);
  r = await page('/dashboard', agentSession.cookie);
  ok('page OK avant deconnexion', r.s === 200, r.s + ' ' + r.loc);
  await fetch(B + '/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: agentSession.accessToken }) });
  ok('token refuse juste apres deconnexion', (await profile(agentSession.accessToken)) === 403);
  r = await page('/dashboard', agentSession.cookie);
  ok('anciens cookies -> retour a la connexion', r.s >= 300 && r.s < 400 && r.loc.includes('/auth/login'), r.s + ' ' + r.loc);

  // ── Cookie d'accès désynchronisé : la session se répare par refresh (pas de déconnexion intempestive)
  const s2 = await webLogin('agent@scanhub.ne', AGENT_PW);
  const stale = `accessToken=${encodeURIComponent(agentSession.accessToken)}; refreshToken=${s2.refreshToken}`;
  r = await page('/dashboard', stale);
  ok('access token perime + refresh valide -> page servie', r.s === 200, r.s + ' ' + r.loc);

  // ── Compte désactivé
  {
    const a2 = await webLogin(AGENT2_EMAIL, AGENT2_PW);
    ok('compte actif : profil accessible', (await profile(a2.accessToken)) === 200);
    await prisma.user.update({ where: { id: agent2.id }, data: { isActive: false } });
    ok('compte desactive -> token refuse', (await profile(a2.accessToken)) === 403);
    r = await fetch(B + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: AGENT2_EMAIL, password: AGENT2_PW }) });
    ok('compte desactive -> login mobile refuse', r.status === 403, r.status);
  }

  console.log(`\n${pass} PASS / ${fail} FAIL`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
