// Tests e2e des webhooks — lancés par tests/e2e/run.cjs.
// Un petit serveur local joue le rôle du serveur du client et reçoit les notifications.
import crypto from 'node:crypto';
import http from 'node:http';

const B = (process.env.E2E_BASE_URL || 'http://localhost:3000') + '/api/v1/integrations';
const KEY = { 'x-api-key': 'evthub_test_key_2026' };
const PORT = 3199;
const RECEIVER = `http://localhost:${PORT}`;

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${cond ? '' : extra}`); };
const call = async (path, { method = 'GET', body, headers = KEY } = {}) => {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { s: r.status, j, t };
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Serveur du « client »
const received = [];
const server = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    received.push({ path: req.url, headers: req.headers, raw });
    res.statusCode = req.url === '/fail' ? 500 : 200;
    res.end('ok');
  });
});
await new Promise((resolve) => server.listen(PORT, resolve));
const waitFor = async (predicate, timeoutMs = 10000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const hit = received.find(predicate);
    if (hit) return hit;
    await sleep(200);
  }
  return null;
};
// Vérification de signature telle que décrite dans la documentation publique
const signatureIsValid = (hit, secret) => {
  const parts = Object.fromEntries(String(hit.headers['scanhub-signature']).split(',').map((p) => p.split('=')));
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${hit.raw}`).digest('hex');
  return expected === parts.v1 && Math.abs(Date.now() / 1000 - Number(parts.t)) < 300;
};

try {
  // ── Création
  let r = await call('/webhooks', { method: 'POST', body: { url: 'pas une adresse' } }); ok('adresse invalide -> 422', r.s === 422, r.s);
  r = await call('/webhooks', { method: 'POST', body: { url: 'ftp://exemple.test/hook' } }); ok('protocole non http -> 422', r.s === 422, r.s);
  r = await call('/webhooks', { method: 'POST', body: { url: 'https://user:pass@exemple.test/hook' } }); ok('identifiants dans l adresse -> 422', r.s === 422, r.s);
  r = await call('/webhooks', { method: 'POST', body: { url: `${RECEIVER}/ok` } });
  ok('creation -> 201 + secret', r.s === 201 && /^whsec_[0-9a-f]{64}$/.test(r.j?.secret) && r.j?.active === true, r.s + r.t.slice(0, 150));
  const hook = r.j;
  r = await call('/webhooks'); ok('liste : le secret n est plus jamais renvoye', r.s === 200 && r.j.webhooks.length === 1 && !r.t.includes('whsec_'), r.t.slice(0, 150));

  // ── Test de connexion
  r = await call(`/webhooks/${hook.id}/test`, { method: 'POST' }); ok('test -> delivre', r.s === 200 && r.j?.delivered === true && r.j?.statusCode === 200, r.t.slice(0, 150));
  const ping = received.find((h) => h.headers['scanhub-event'] === 'ping');
  ok('ping recu et signature valide', Boolean(ping) && signatureIsValid(ping, hook.secret), JSON.stringify(ping?.headers ?? {}).slice(0, 200));
  ok('signature fausse avec un autre secret', Boolean(ping) && !signatureIsValid(ping, 'whsec_' + '0'.repeat(64)));
  ok('signature fausse si le corps est modifie', Boolean(ping) && !signatureIsValid({ ...ping, raw: ping.raw.replace('ping', 'pong') }, hook.secret));

  // ── Notification d'un vrai scan
  const eventId = (await call('/events')).j.events.find((e) => e.name === 'Tech Conference Niger 2026').id;
  const ref = 'E2E-HOOK-' + crypto.randomBytes(4).toString('hex');
  const qr = (await call('/qrs', { method: 'POST', body: { externalId: ref, type: 'BADGE', eventId, holderName: 'Hawa Webhook' } })).j;
  const before = Date.now();
  await call('/consume', { method: 'POST', body: { token: qr.token, eventId, idempotencyKey: 'hook-' + crypto.randomUUID() } });
  const hit = await waitFor((h) => h.headers['scanhub-event'] === 'scan.created' && h.raw.includes(ref));
  const payload = hit ? JSON.parse(hit.raw) : null;
  ok('scan.created recu apres un scan', Boolean(hit), `rien recu en ${Date.now() - before} ms`);
  ok('contenu : resultat, reference, titulaire', payload?.type === 'scan.created' && payload.data.scan.result === 'VALID' && payload.data.scan.qr.externalId === ref && payload.data.scan.holderName === 'Hawa Webhook' && payload.data.scan.operator.type === 'api', hit?.raw.slice(0, 250));
  ok('signature du scan valide', Boolean(hit) && signatureIsValid(hit, hook.secret));
  ok('identifiant d envoi present (dedoublonnage)', Boolean(payload?.id) && payload.id === hit.headers['scanhub-delivery']);

  r = await call('/verify', { method: 'POST', body: { token: qr.token } });
  await sleep(1500);
  ok('une simple verification n envoie rien', received.filter((h) => h.raw.includes(ref)).length === 1, received.filter((h) => h.raw.includes(ref)).length);

  // ── Adresse en panne : échec tracé, nouvelle tentative planifiée
  const bad = (await call('/webhooks', { method: 'POST', body: { url: `${RECEIVER}/fail` } })).j;
  r = await call(`/webhooks/${bad.id}/test`, { method: 'POST' }); ok('test sur adresse en panne -> non delivre', r.j?.delivered === false && r.j?.statusCode === 500, r.t.slice(0, 150));
  r = await call(`/webhooks/${bad.id}`);
  const d = r.j?.deliveries?.[0];
  ok('echec trace + nouvelle tentative planifiee', r.s === 200 && d?.status === 'PENDING' && d.attempts === 1 && d.lastStatusCode === 500 && new Date(d.nextAttemptAt) > new Date() && r.j.endpoint.consecutiveFailures === 1, r.t.slice(0, 250));
  r = await call(`/webhooks/${hook.id}`); ok('journal de l adresse saine : envois reussis', r.j?.deliveries?.length >= 2 && r.j.deliveries.every((x) => x.status === 'SUCCESS'), r.t.slice(0, 200));

  // ── Limite et suppression
  const extra = [];
  for (let i = 0; i < 3; i++) extra.push((await call('/webhooks', { method: 'POST', body: { url: `${RECEIVER}/ok?n=${i}` } })).j);
  r = await call('/webhooks', { method: 'POST', body: { url: `${RECEIVER}/ok?n=6` } }); ok('6e adresse refusee', r.s === 403, r.s);
  r = await call('/webhooks/identifiant_inconnu', { method: 'DELETE' }); ok('suppression inconnue -> 404', r.s === 404, r.s);
  for (const w of [hook, bad, ...extra]) await call(`/webhooks/${w.id}`, { method: 'DELETE' });
  r = await call('/webhooks'); ok('toutes les adresses supprimees', r.j?.webhooks?.length === 0, r.t.slice(0, 100));
  const count = received.length;
  await call('/consume', { method: 'POST', body: { token: qr.token, eventId, idempotencyKey: 'hook-' + crypto.randomUUID() } });
  await sleep(2500);
  ok('plus aucun envoi apres suppression', received.length === count, received.length - count);

  // ── Route planifiée
  r = await fetch(B.replace('/v1/integrations', '/cron/webhooks'), { headers: { Authorization: 'Bearer mauvais-secret' } });
  ok('route planifiee protegee', r.status === 401 || r.status === 503, r.status);
} finally {
  server.close();
}

console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
