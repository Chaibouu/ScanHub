// Tests e2e de l'API développeur (/api/v1/integrations/*) — lancés par tests/e2e/run.cjs.
// Une plateforme cliente crée ses codes, les vérifie et lit ses scans avec sa seule clé API.
import crypto from 'node:crypto';

const B = (process.env.E2E_BASE_URL || 'http://localhost:3000') + '/api/v1/integrations';
const KEY = { 'x-api-key': 'evthub_test_key_2026' };
const OTHER_KEY = { 'x-api-key': 'jnjl_test_key_2026' };

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${cond ? '' : extra}`); };
const call = async (path, { method = 'GET', body, headers = KEY } = {}) => {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  const buf = Buffer.from(await r.arrayBuffer());
  const t = buf.toString('utf8'); let j = null; try { j = JSON.parse(t); } catch {}
  return { s: r.status, j, t, buf, type: r.headers.get('content-type') || '' };
};
const run = crypto.randomBytes(4).toString('hex');
const ref = (n) => `E2E-${run}-${n}`;

// ── Authentification
let r = await call('/events', { headers: {} }); ok('sans cle -> 401', r.s === 401, r.s);
r = await call('/events', { headers: { 'x-api-key': 'shk_fausse_cle' } }); ok('fausse cle -> 401', r.s === 401, r.s);

// ── Événements
r = await call('/events');
const eventId = r.j?.events?.find((e) => e.name === 'Tech Conference Niger 2026')?.id;
ok('liste des evenements de l espace', r.s === 200 && Boolean(eventId), r.s + r.t.slice(0, 120));
r = await call('/events', { method: 'POST', body: { name: `E2E API ${run}`, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 86400000).toISOString() } });
ok('creation d un evenement par API', r.s === 201 && r.j?.id, r.s + r.t.slice(0, 120));
r = await call('/events', { method: 'POST', body: { name: 'Dates inversees', startsAt: new Date(Date.now() + 86400000).toISOString(), endsAt: new Date().toISOString() } });
ok('evenement aux dates inversees -> 400', r.s === 400, r.s);

// ── Création + anti-doublon
r = await call('/qrs', { method: 'POST', body: { externalId: ref(1), type: 'BADGE', eventId, holderName: 'Awa Diallo', holderRole: 'Ambassadrice' } });
ok('creation -> 201 + token', r.s === 201 && r.j?.created === true && /^SCN_[0-9A-F]{32}$/.test(r.j?.token), r.s + r.t.slice(0, 150));
const first = r.j;
r = await call('/qrs', { method: 'POST', body: { externalId: ref(1), type: 'BADGE', eventId, holderName: 'Autre nom' } });
ok('meme reference rejouee -> 200, meme code', r.s === 200 && r.j?.created === false && r.j?.id === first.id && r.j?.token === first.token, r.s + r.t.slice(0, 150));
const parallel = await Promise.all(Array.from({ length: 6 }, () => call('/qrs', { method: 'POST', body: { externalId: ref('par'), type: 'TICKET', eventId } })));
ok('6 creations simultanees de la meme reference -> 1 seul code', new Set(parallel.map((x) => x.j?.id)).size === 1 && parallel.filter((x) => x.s === 201).length === 1, JSON.stringify(parallel.map((x) => x.s)));
const single = parallel[0].j;
r = await call('/qrs', { method: 'POST', body: { type: 'TICKET', eventId: 'evenement_inconnu' } }); ok('evenement inconnu -> 404', r.s === 404, r.s);

// ── Code fourni par le client
r = await call('/qrs', { method: 'POST', body: { externalId: ref('faible'), token: 'JNJL-2026-PART-0001' } }); ok('token court refuse -> 422', r.s === 422, r.s + r.t.slice(0, 100));
r = await call('/qrs', { method: 'POST', body: { externalId: ref('faible2'), token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } }); ok('token repetitif refuse -> 422', r.s === 422, r.s);
const ownToken = 'own_' + crypto.randomBytes(24).toString('hex');
r = await call('/qrs', { method: 'POST', body: { externalId: ref('own'), type: 'BADGE', eventId, token: ownToken } }); ok('token aleatoire du client accepte', r.s === 201 && r.j?.token === ownToken, r.s + r.t.slice(0, 120));
r = await call('/qrs', { method: 'POST', body: { externalId: ref('own-bis'), type: 'BADGE', eventId, token: ownToken } }); ok('meme token, autre reference -> 409', r.s === 409, r.s);

// ── Lot
r = await call('/qrs/batch', { method: 'POST', body: { eventId, type: 'BADGE', qrs: [{ externalId: ref(1) }, { externalId: ref('b2'), holderName: 'Lot Deux' }, { externalId: ref('b3'), type: 'TICKET' }] } });
ok('lot : 2 crees, 1 deja connu', r.s === 201 && r.j?.created === 2 && r.j?.existing === 1 && r.j.qrs[0].token === first.token && r.j.qrs[2].type === 'TICKET', r.s + r.t.slice(0, 200));
const batchTokens = r.j?.qrs?.map((q) => q.token);
r = await call('/qrs/batch', { method: 'POST', body: { eventId, type: 'BADGE', qrs: [{ externalId: ref(1) }, { externalId: ref('b2') }, { externalId: ref('b3') }] } });
ok('lot rejoue -> rien de nouveau, memes codes', r.s === 200 && r.j?.created === 0 && JSON.stringify(r.j.qrs.map((q) => q.token)) === JSON.stringify(batchTokens), r.s + r.t.slice(0, 150));
r = await call('/qrs/batch', { method: 'POST', body: { qrs: [{ externalId: ref('dup') }, { externalId: ref('dup') }] } }); ok('lot avec reference en double -> 422', r.s === 422, r.s);
r = await call('/qrs/batch', { method: 'POST', body: { qrs: [] } }); ok('lot vide -> 400', r.s === 400, r.s);

// ── Lecture et image
r = await call(`/qrs/${encodeURIComponent(ref(1))}`); ok('detail par reference client', r.s === 200 && r.j?.id === first.id && r.j?.holderName === 'Awa Diallo', r.s + r.t.slice(0, 120));
r = await call(`/qrs/${first.id}/image`); ok('image PNG du QR', r.s === 200 && r.type.includes('image/png') && r.buf.subarray(1, 4).toString() === 'PNG', r.s + ' ' + r.type);
r = await call(`/qrs/${first.id}/image?format=svg&size=200`); ok('image SVG du QR', r.s === 200 && r.type.includes('svg') && r.t.includes('<svg'), r.s + ' ' + r.type);
r = await call(`/qrs/${first.id}`, { headers: OTHER_KEY }); ok('une autre cle ne lit pas ce code', r.s === 404, r.s);
r = await call(`/qrs/${first.id}/image`, { headers: OTHER_KEY }); ok('une autre cle n obtient pas l image', r.s === 404, r.s);

// ── Vérifier et valider depuis sa propre application
r = await call('/verify', { method: 'POST', body: { token: first.token, eventId } }); ok('verify badge -> VALID + reference', r.j?.code === 'VALID' && r.j?.qr?.externalId === ref(1), r.t.slice(0, 200));
r = await call('/verify', { method: 'POST', body: { token: 'code_inconnu_' + run } }); ok('verify inconnu -> INVALID', r.j?.code === 'INVALID', r.t.slice(0, 100));
const key1 = 'req-' + crypto.randomUUID();
r = await call('/consume', { method: 'POST', body: { token: single.token, eventId, idempotencyKey: key1 } }); ok('consume billet -> VALID', r.j?.code === 'VALID' && r.j?.consumed === true, r.t.slice(0, 150));
r = await call('/consume', { method: 'POST', body: { token: single.token, eventId, idempotencyKey: key1 } }); ok('meme requete rejouee -> meme resultat', r.j?.code === 'VALID', r.t.slice(0, 150));
r = await call('/consume', { method: 'POST', body: { token: single.token, eventId }, headers: { ...KEY, 'Idempotency-Key': 'req-' + crypto.randomUUID() } }); ok('second passage -> ALREADY_USED', r.j?.code === 'ALREADY_USED', r.t.slice(0, 150));

// ── Révoquer / rétablir
r = await call(`/qrs/${encodeURIComponent(ref('par'))}/revoke`, { method: 'POST' }); ok('revocation par reference', r.s === 200 && r.j?.status === 'REVOKED', r.s + r.t.slice(0, 100));
r = await call('/verify', { method: 'POST', body: { token: single.token } }); ok('code revoque -> REVOKED', r.j?.code === 'REVOKED', r.t.slice(0, 100));
r = await call(`/qrs/${single.id}/restore`, { method: 'POST' }); ok('retabli : billet deja valide redevient USED', r.s === 200 && r.j?.status === 'USED', r.s + r.t.slice(0, 100));
r = await call(`/qrs/${single.id}/restore`, { method: 'POST' }); ok('retablir un code non revoque -> 409', r.s === 409, r.s);
r = await call(`/qrs/${first.id}/revoke`, { method: 'POST', headers: OTHER_KEY }); ok('une autre cle ne revoque pas ce code', r.s === 404, r.s);

// ── Lecture incrémentale des scans (présences)
r = await call(`/scans?eventId=${eventId}&limit=500`);
const mine = r.j?.scans?.filter((s) => s.qr?.externalId === ref('par')) ?? [];
ok('scans : passages du billet, operateur api', r.s === 200 && mine.length === 2 && mine.every((s) => s.operator.type === 'api') && mine[0].result === 'VALID' && mine[1].result === 'ALREADY_USED', r.s + JSON.stringify(mine).slice(0, 200));
let cursor = r.j?.nextCursor;
while (r.j?.hasMore) { r = await call(`/scans?eventId=${eventId}&limit=500&after=${cursor}`); cursor = r.j.nextCursor; }
r = await call(`/scans?eventId=${eventId}&after=${cursor}`); ok('rien de nouveau apres le curseur', r.s === 200 && r.j.scans.length === 0 && r.j.nextCursor === cursor, r.t.slice(0, 120));
await call('/consume', { method: 'POST', body: { token: first.token, eventId, idempotencyKey: 'req-' + crypto.randomUUID() } });
r = await call(`/scans?eventId=${eventId}&after=${cursor}`); ok('le nouveau scan seulement', r.s === 200 && r.j.scans.length === 1 && r.j.scans[0].qr.externalId === ref(1) && r.j.scans[0].holderName === 'Awa Diallo', r.t.slice(0, 200));
r = await call('/scans?after=curseur_invalide'); ok('curseur invalide -> 400', r.s === 400, r.s);
r = await call('/scans?result=N_IMPORTE'); ok('filtre result invalide -> 400', r.s === 400, r.s);

console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
