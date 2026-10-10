// Tests e2e du cloisonnement multi-client : un espace ne voit ni ne modifie rien d'un autre.
// Lancés par tests/e2e/run.cjs. L'espace A est celui du seed ; l'espace B est créé ici.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const B = process.env.E2E_BASE_URL || 'http://localhost:3000';
const { SEED_AGENT_PASSWORD: AGENT_PW, SEED_ADMIN_PASSWORD: ADMIN_PW } = process.env;
const B_PASSWORD = 'E2e-tenant-password-1';
const B_API_KEY = 'e2e_partner_key_org_b';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${cond ? '' : extra}`); };

// Même formule que lib/crypto.ts (hashApiKey)
const hashApiKey = (key) =>
  crypto.createHash('sha256').update(`${key.trim()}${process.env.API_KEY_PEPPER || 'scanhub_api_default_pepper'}`).digest('hex');

const call = async (path, { method = 'GET', body, headers = {} } = {}) => {
  const r = await fetch(B + '/api' + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { s: r.status, j, t };
};
const apiLogin = async (email, password) => {
  const r = await call('/v1/auth/login', { method: 'POST', body: { email, password } });
  if (r.s !== 200) throw new Error(`login ${email}: ${r.s} ${r.t}`);
  return { Authorization: `Bearer ${r.j.tokens.accessToken}` };
};

(async () => {
  // ── Espace A (seed)
  const eventA = await prisma.event.findFirst({ where: { name: 'Tech Conference Niger 2026' } });
  const agentA = await prisma.user.findUnique({ where: { email: 'agent@scanhub.ne' } });
  const deviceA = await prisma.device.create({ data: { name: 'E2E terminal A (cible)', userId: agentA.id } });

  // ── Espace B (jetable)
  const orgB = await prisma.organization.create({ data: { name: 'E2E Org B', slug: 'e2e-org-b' } });
  const password = await bcrypt.hash(B_PASSWORD, 10);
  const adminB = await prisma.user.create({ data: { name: 'Admin B', email: 'admin-b@e2e.scanhub.test', role: 'ADMIN', organizationId: orgB.id, emailVerified: new Date(), password } });
  const agentB = await prisma.user.create({ data: { name: 'Agent B', email: 'agent-b@e2e.scanhub.test', role: 'AGENT', organizationId: orgB.id, emailVerified: new Date(), password } });
  const eventB = await prisma.event.create({ data: { name: 'E2E Event B', organizationId: orgB.id, startsAt: new Date(), endsAt: new Date(Date.now() + 86400000) } });
  await prisma.source.create({ data: { name: 'E2E Source B', slug: 'e2e-source-b', organizationId: orgB.id, apiKeyHash: hashApiKey(B_API_KEY) } });

  const A = await apiLogin('admin@gmail.com', ADMIN_PW);
  const AB = await apiLogin(adminB.email, B_PASSWORD);

  // ── Lecture
  let r = await call('/v1/events', { headers: AB });
  const names = (r.j?.events ?? []).map((e) => e.name);
  ok('B ne voit que ses evenements', r.s === 200 && names.includes('E2E Event B') && !names.includes('Tech Conference Niger 2026'), JSON.stringify(names));
  r = await call('/v1/events', { headers: A });
  ok('A ne voit pas l evenement de B', r.s === 200 && !(r.j.events.map((e) => e.name)).includes('E2E Event B'));
  r = await call(`/v1/events/${eventA.id}`, { headers: AB }); ok('B : detail evenement de A -> 404', r.s === 404, r.s);
  r = await call(`/v1/events/${eventA.id}/tickets`, { headers: AB }); ok('B : billets de A -> 404', r.s === 404, r.s);
  r = await call(`/v1/sync/pull?eventId=${eventA.id}`, { headers: AB }); ok('B : annuaire hors-ligne de A -> 404', r.s === 404, r.s);
  r = await call('/v1/devices', { headers: AB });
  ok('B ne voit aucun terminal de A', r.s === 200 && !r.j.devices.some((d) => d.id === deviceA.id), r.t.slice(0, 150));

  // ── Écriture
  r = await call(`/v1/events/${eventA.id}`, { method: 'PATCH', headers: AB, body: { status: 'CLOSED' } }); ok('B ne peut pas cloturer l evenement de A', r.s === 404, r.s);
  r = await call('/v1/devices', { method: 'PATCH', headers: AB, body: { deviceId: deviceA.id, active: false } }); ok('B ne peut pas bloquer un terminal de A', r.s === 404, r.s);
  r = await call('/v1/devices', { method: 'POST', headers: AB, body: { name: 'Intrus', userId: agentA.id } }); ok('B ne peut pas creer un terminal pour un agent de A', r.s === 404, r.s);
  r = await call('/v1/integrations/qrs', { method: 'POST', headers: { 'x-api-key': B_API_KEY }, body: { type: 'TICKET', eventId: eventA.id } }); ok('billetterie de B : billet sur evenement de A -> 404', r.s === 404, r.s);
  r = await call('/v1/integrations/qrs', { method: 'POST', headers: { 'x-api-key': B_API_KEY }, body: { type: 'TICKET', eventId: eventB.id } });
  ok('billetterie de B : billet sur son evenement -> 201', r.s === 201, r.s + r.t);
  const tokenB = r.j?.token;

  // ── Billets : un QR d'un autre espace est « inconnu », et n'est jamais consommé
  r = await call('/v1/qr/verify', { method: 'POST', headers: AB, body: { token: 'BADGE_VIP_AMB' } }); ok('B verifie un billet de A -> INVALID', r.j?.code === 'INVALID', r.t.slice(0, 150));
  r = await call('/v1/qr/consume', { method: 'POST', headers: AB, body: { token: 'BADGE_VIP_AMB', clientId: crypto.randomUUID() } }); ok('B consomme un billet de A -> INVALID', r.j?.code === 'INVALID' && r.j?.consumed === false, r.t.slice(0, 150));
  r = await call('/v1/qr/verify', { method: 'POST', headers: A, body: { token: 'BADGE_VIP_AMB' } }); ok('le billet de A est toujours valide', r.j?.code === 'VALID', r.t.slice(0, 150));
  r = await call('/v1/qr/verify', { method: 'POST', headers: A, body: { token: tokenB } }); ok('A verifie un billet de B -> INVALID', r.j?.code === 'INVALID', r.t.slice(0, 150));
  r = await call('/v1/qr/consume', { method: 'POST', headers: AB, body: { token: tokenB, eventId: eventB.id, clientId: crypto.randomUUID() } }); ok('B consomme son propre billet -> VALID', r.j?.code === 'VALID', r.t.slice(0, 150));
  r = await call('/v1/scans', { headers: A }); ok('A ne voit pas les scans de B', r.s === 200 && !r.j.scans.some((s) => s.event === 'E2E Event B'), '');
  r = await call('/v1/scans', { headers: AB }); ok('B voit ses scans', r.s === 200 && r.j.scans.length >= 1 && r.j.scans.every((s) => s.event !== 'Tech Conference Niger 2026'), r.t.slice(0, 150));

  // ── Terminal d'un espace inutilisable par un agent d'un autre espace
  const deviceKeyA = 'dvk_e2e_device_of_org_a';
  await prisma.device.create({ data: { name: 'E2E terminal A', userId: agentA.id, deviceKeyHash: hashApiKey(deviceKeyA), activatedAt: new Date() } });
  r = await call('/v1/qr/verify', { method: 'POST', headers: { ...(await apiLogin('agent@scanhub.ne', AGENT_PW)), 'x-device-key': deviceKeyA }, body: { token: 'BADGE_VIP_AMB' } });
  ok('agent de A avec son terminal -> VALID', r.j?.code === 'VALID', r.s + r.t.slice(0, 100));
  const agentBAuth = await apiLogin(agentB.email, B_PASSWORD);
  r = await call('/v1/qr/verify', { method: 'POST', headers: { ...agentBAuth, 'x-device-key': deviceKeyA }, body: { token: tokenB } });
  ok('agent de B avec un terminal de A -> 403', r.s === 403, r.s + r.t.slice(0, 100));

  // ── Tableau de bord et audit
  const web = await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: adminB.email, password: B_PASSWORD }) }).then((x) => x.json());
  const cookie = `accessToken=${encodeURIComponent(web.accessToken)}; refreshToken=${web.refreshToken}`;
  const page = (p) => fetch(B + p, { headers: { cookie }, redirect: 'manual' });
  // Le rendu en flux de Next répond 200 avec la page « introuvable » : on vérifie le contenu
  const leaks = (t) => t.includes('Tech Conference Niger 2026') || t.includes('Ibrahim Moussa') || t.includes('data:image/png');
  let pr = await page(`/events/${eventA.id}`); let body = await pr.text();
  ok('B : page evenement de A -> rien de A', !leaks(body), pr.status);
  pr = await page(`/events/${eventA.id}/print`); body = await pr.text();
  ok('B : planche QR de A -> aucun QR', !leaks(body), pr.status);
  pr = await page(`/events/${eventB.id}`); body = await pr.text();
  ok('B : page de son evenement', pr.status === 200 && body.includes('E2E Event B'), pr.status);
  ok('une connexion web ne ferme pas la session mobile', (await call('/v1/auth/me', { headers: AB })).s === 200);
  pr = await page('/admin/organizations'); ok('B : console proprietaire interdite', pr.status >= 300 && pr.status < 400 && (pr.headers.get('location') || '').includes('/unauthorized'), pr.status);
  const html = await (await page('/admin/users')).text();
  ok('B : la page Equipe ne montre pas les membres de A', !html.includes('agent@scanhub.ne') && html.includes('agent-b@e2e.scanhub.test'));
  const imp = await fetch(B + '/api/admin/impersonate', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${web.accessToken}` }, body: JSON.stringify({ targetUserId: agentA.id }) });
  ok('B ne peut pas auditer un membre de A', imp.status === 404, imp.status);

  // ── Limite de formule (gratuit : 10 terminaux par espace)
  await prisma.device.createMany({ data: Array.from({ length: 10 }, (_, i) => ({ name: `Limite ${i}`, userId: agentB.id })) });
  r = await call('/v1/devices', { method: 'POST', headers: AB, body: { name: 'Onzieme', userId: agentB.id } });
  ok('11e terminal refuse par la formule gratuite', r.s === 403 && /formule/i.test(r.j?.error || ''), r.s + r.t.slice(0, 120));

  // ── Suspension d'un espace
  await prisma.organization.update({ where: { id: orgB.id }, data: { isActive: false } });
  r = await call('/v1/events', { headers: AB }); ok('espace suspendu : session refusee', r.s === 401, r.s);
  r = await call('/v1/auth/login', { method: 'POST', body: { email: adminB.email, password: B_PASSWORD } }); ok('espace suspendu : connexion refusee', r.s === 403, r.s);
  r = await call('/v1/events', { headers: A }); ok('l espace A n est pas affecte', r.s === 200, r.s);

  console.log(`\n${pass} PASS / ${fail} FAIL`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
