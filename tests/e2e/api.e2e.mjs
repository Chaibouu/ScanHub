// Tests e2e de l'API v1 — lancés par tests/e2e/run.cjs (base fraîchement seedée requise)
import crypto from 'node:crypto';
const B = (process.env.E2E_BASE_URL || 'http://localhost:3000') + '/api';
const { SEED_AGENT_PASSWORD: AGENT_PW, SEED_ADMIN_PASSWORD: ADMIN_PW } = process.env;
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${cond ? '' : extra}`); };
const call = async (path, { method = 'GET', body, headers = {} } = {}) => {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  let j = null; const t = await r.text(); try { j = JSON.parse(t); } catch {}
  return { s: r.status, j, t };
};
const uid = () => crypto.randomUUID();

let r = await call('/health'); ok('health public (pas de 401)', r.s !== 401, r.s);
r = await call('/v1/scans'); ok('scans sans token -> 401', r.s === 401, r.s);
r = await call('/v1/scans', { headers: { Authorization: 'Bearer mock_access_token_demo' } }); ok('scans faux Bearer -> 401', r.s === 401, r.s);
r = await call('/v1/sync/pull?eventId=x', { headers: { Authorization: 'Bearer x' } }); ok('pull faux Bearer -> 401', r.s === 401, r.s);
r = await call('/v1/qr/verify', { method: 'POST', body: { token: 'TICKET_VALIDE_2026' }, headers: { Authorization: 'Bearer x' } }); ok('verify faux Bearer -> 401', r.s === 401, r.s);

r = await call('/v1/devices/activate', { method: 'POST', body: { activationCode: 'ZZZZ9999' } }); ok('activation code inconnu -> 404', r.s === 404, r.s + r.t);
r = await call('/v1/devices/activate', { method: 'POST', body: { activationCode: 'test-2026', deviceName: 'Tel test' } });
ok('activation code valide -> deviceKey', r.s === 200 && r.j?.device?.deviceKey?.startsWith('dvk_') && !r.j.agent?.id, r.s + r.t);
const deviceKey = r.j?.device?.deviceKey;
r = await call('/v1/devices/activate', { method: 'POST', body: { activationCode: 'TEST2026' } }); ok('code reutilise -> 404', r.s === 404, r.s);

r = await call('/v1/auth/login', { method: 'POST', body: { email: 'agent@scanhub.ne', password: 'mauvais-mdp' } }); ok('login mauvais mdp -> 401', r.s === 401, r.s + r.t);
r = await call('/v1/auth/login', { method: 'POST', body: { email: 'agent@scanhub.ne', password: AGENT_PW }, headers: { 'x-device-key': deviceKey } });
ok('login agent OK + device', r.s === 200 && r.j?.tokens?.accessToken && r.j?.device?.id, r.s + r.t);
let { accessToken, refreshToken } = r.j.tokens;
const A = { Authorization: `Bearer ${accessToken}` };
const AD = { ...A, 'x-device-key': deviceKey };

r = await call('/v1/auth/me', { headers: A }); ok('me', r.s === 200 && r.j.user.role === 'AGENT', r.s + r.t);
r = await call('/v1/qr/verify', { method: 'POST', body: { token: 'TICKET_VALIDE_2026' }, headers: A }); ok('agent sans terminal -> 403', r.s === 403, r.s + r.t);
r = await call('/v1/events', { headers: A }); ok('events', r.s === 200 && r.j.events.length > 0, r.s + r.t);
const eventId = r.j.events.find((e) => e.name === 'Tech Conference Niger 2026')?.id;
ok('evenement du seed present', Boolean(eventId));
r = await call('/v1/devices', { headers: A }); ok('agent liste terminaux -> 403', r.s === 403, r.s);
r = await call(`/v1/events/${eventId}`, { method: 'PATCH', body: { status: 'CLOSED' }, headers: A }); ok('agent PATCH event -> 403', r.s === 403, r.s);

for (const [tok, code] of [['TICKET_VALIDE_2026', 'VALID'], ['TICKET_USED_992', 'ALREADY_USED'], ['PASS_EXPIRED_2026', 'EXPIRED'], ['PASS_REVOKED_999', 'REVOKED'], ['BADGE_VIP_AMB', 'VALID'], ['INCONNU_123', 'INVALID']]) {
  r = await call('/v1/qr/verify', { method: 'POST', body: { token: tok, eventId }, headers: AD }); ok(`verify ${tok} -> ${code}`, r.j?.code === code, r.s + r.t);
}
r = await call('/v1/qr/verify', { method: 'POST', body: { token: 'TICKET_VALIDE_2026', eventId: 'autre_evt' }, headers: AD }); ok('verify mauvais evenement -> UNAUTHORIZED', r.j?.code === 'UNAUTHORIZED', r.t);

// Double consommation simultanee : 12 terminaux scannent le meme billet en meme temps
const results = await Promise.all(Array.from({ length: 12 }, () => call('/v1/qr/consume', { method: 'POST', body: { token: 'TICKET_VALIDE_2026', eventId, clientId: uid() }, headers: AD })));
const codes = results.map(x => x.j?.code);
ok('12 consume simultanes -> 1 seul VALID', codes.filter(c => c === 'VALID').length === 1 && codes.filter(c => c === 'ALREADY_USED').length === 11, JSON.stringify(results.map(x => x.j?.code ?? x.s)));

const cid = uid();
const r1 = await call('/v1/qr/consume', { method: 'POST', body: { token: 'BADGE_VIP_AMB', eventId, clientId: cid }, headers: AD });
const r2 = await call('/v1/qr/consume', { method: 'POST', body: { token: 'BADGE_VIP_AMB', eventId, clientId: cid }, headers: AD });
ok('consume badge reutilisable VALID', r1.j?.code === 'VALID' && r1.j?.consumed === true, r1.t);
ok('rejeu meme clientId idempotent', r2.j?.code === 'VALID' && /idempotent/.test(r2.j?.message), r2.t);
const same = await Promise.all([1, 2, 3].map(() => call('/v1/qr/consume', { method: 'POST', body: { token: 'BADGE_VIP_AMB', eventId, clientId: 'same-' + cid }, headers: AD })));
ok('meme clientId en parallele -> pas de 500', same.every(x => x.s === 200 && x.j.code === 'VALID'), JSON.stringify(same.map(x => x.s)));

r = await call('/v1/sync/pull', { headers: AD }); ok('pull sans eventId -> 400', r.s === 400, r.s);
r = await call(`/v1/sync/pull?eventId=${eventId}`, { headers: AD });
const want = crypto.createHash('sha256').update('TICKET_VALIDE_2026').digest('hex');
const row = r.j?.qrs?.find(q => q.tokenHash === want);
ok('pull : tokenHash = sha256(token), statut USED, reusable present', r.s === 200 && row?.status === 'USED' && row.reusable === false, r.s + (r.t || '').slice(0, 200));

const c1 = uid(), c2 = uid(), c3 = uid();
r = await call('/v1/sync/push', { method: 'POST', headers: AD, body: { scans: [
  { clientId: c1, token: 'TICKET_VALIDE_2026', eventId, result: 'VALID', scannedAt: new Date().toISOString(), userId: 'pirate' },
  { clientId: c2, token: 'BADGE_VIP_AMB', eventId, result: 'VALID', scannedAt: new Date().toISOString() },
  { clientId: c3, token: 'FAUX_BILLET', eventId, result: 'VALID', scannedAt: new Date().toISOString() },
] } });
const st = Object.fromEntries((r.j?.results ?? []).map(x => [x.clientId, x]));
ok('push : billet deja consomme -> CONFLICT/ALREADY_USED', st[c1]?.status === 'CONFLICT' && st[c1]?.result === 'ALREADY_USED', r.t);
ok('push : badge -> ACCEPTED', st[c2]?.status === 'ACCEPTED', r.t);
ok('push : QR inconnu annonce VALID -> CONFLICT/INVALID', st[c3]?.status === 'CONFLICT' && st[c3]?.result === 'INVALID', r.t);
r = await call('/v1/sync/push', { method: 'POST', headers: AD, body: { scans: [{ clientId: c1, token: 'TICKET_VALIDE_2026', result: 'VALID', scannedAt: new Date().toISOString() }] } });
ok('push rejoue -> DUPLICATE', r.j?.results?.[0]?.status === 'DUPLICATE', r.t);

r = await call('/v1/scans?limit=5', { headers: A }); ok('scans agent OK', r.s === 200 && r.j.scans.length > 0, r.s + r.t);
r = await call('/v1/scans?format=csv', { headers: A }); ok('export CSV', r.s === 200 && r.t.includes('ID_Scan'), r.s);

// Partenaires
r = await call('/v1/integrations/qrs', { headers: { 'x-api-key': 'eventhub' } }); ok('slug comme cle API -> 401', r.s === 401, r.s);
r = await call('/v1/integrations/qrs', { method: 'POST', headers: { 'x-api-key': 'evthub_test_key_2026' }, body: { type: 'TICKET', eventId, externalId: 'ORD-1', metadata: { holderName: '=cmd|test' } } });
ok('partenaire cree un QR', r.s === 201 && /^TKT_[0-9A-F]{32}$/.test(r.j?.token), r.s + r.t);
const newTok = r.j?.token, newId = r.j?.id;
r = await call('/v1/integrations/qrs', { method: 'POST', headers: { 'x-api-key': 'evthub_test_key_2026' }, body: { type: 'TICKET', eventId: 'evt_inexistant' } }); ok('QR sur evenement etranger -> 404', r.s === 404, r.s + r.t);
r = await call(`/v1/integrations/qrs/${newId}/revoke`, { method: 'POST', headers: { 'x-api-key': 'jnjl_test_key_2026' } }); ok('revocation par un autre partenaire -> 404', r.s === 404, r.s);
r = await call('/v1/qr/consume', { method: 'POST', body: { token: newTok, eventId, clientId: uid() }, headers: AD }); ok('consume du QR partenaire VALID', r.j?.code === 'VALID', r.t);
r = await call('/v1/scans?format=csv', { headers: A }); ok('CSV : formule neutralisee', r.t.includes("'=cmd|test"), '');

// Admin + blocage terminal
r = await call('/v1/auth/login', { method: 'POST', body: { email: 'admin@gmail.com', password: ADMIN_PW } }); ok('login admin', r.s === 200, r.s + r.t);
const AA = { Authorization: `Bearer ${r.j.tokens.accessToken}` };
r = await call('/v1/devices', { headers: AA }); ok('admin liste terminaux', r.s === 200, r.s);
const dev = r.j.devices.find(d => d.name === 'Tel test');
r = await call('/v1/devices', { method: 'POST', headers: AA, body: { name: 'Porte Sud', userId: dev.user.id } }); ok('admin cree terminal + code', r.s === 201 && r.j.activationCode?.length === 8, r.s + r.t);
r = await call('/v1/devices', { method: 'PATCH', headers: AA, body: { deviceId: dev.id, active: false } }); ok('admin bloque terminal', r.s === 200, r.s + r.t);
r = await call('/v1/qr/verify', { method: 'POST', body: { token: 'BADGE_VIP_AMB' }, headers: AD }); ok('terminal bloque -> 403', r.s === 403, r.s + r.t);
await call('/v1/devices', { method: 'PATCH', headers: AA, body: { deviceId: dev.id, active: true } });
r = await call(`/v1/events/${eventId}`, { method: 'PATCH', headers: AA, body: { status: 'CLOSED' } });
r = await call('/v1/qr/verify', { method: 'POST', body: { token: 'BADGE_VIP_AMB' }, headers: AD }); ok('evenement cloture -> EVENT_CLOSED', r.j?.code === 'EVENT_CLOSED', r.t);
await call(`/v1/events/${eventId}`, { method: 'PATCH', headers: AA, body: { status: 'ACTIVE' } });

// Refresh / logout
r = await call('/v1/auth/refresh', { method: 'POST', body: { refreshToken } }); ok('refresh', r.s === 200 && r.j.accessToken, r.s + r.t);
const newAccess = r.j.accessToken;
r = await call('/v1/auth/me', { headers: A }); ok('ancien access token apres refresh -> 401', r.s === 401, r.s);
r = await call('/v1/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${newAccess}` } }); ok('logout', r.s === 200, r.s);
r = await call('/v1/auth/me', { headers: { Authorization: `Bearer ${newAccess}` } }); ok('token apres logout -> 401', r.s === 401, r.s);
r = await call('/v1/auth/refresh', { method: 'POST', body: { refreshToken } }); ok('refresh apres logout -> 401', r.s === 401, r.s);
r = await call('/v1/auth/refresh', { method: 'POST', body: { refreshToken: 'x'.repeat(40) } }); ok('refresh bidon -> 401', r.s === 401, r.s);

console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
