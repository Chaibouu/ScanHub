// Tests e2e du tableau de bord (pages et gardes de rôle) — lancés par tests/e2e/run.cjs
const B = process.env.E2E_BASE_URL || 'http://localhost:3000';
const { SEED_AGENT_PASSWORD: AGENT_PW, SEED_ADMIN_PASSWORD: ADMIN_PW } = process.env;
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
    return `accessToken=${encodeURIComponent(j.accessToken)}; refreshToken=${j.refreshToken}`;
  }
}
const page = async (path, cookie) => {
  const r = await fetch(B + path, { headers: cookie ? { cookie } : {}, redirect: 'manual' });
  return { s: r.status, loc: r.headers.get('location') || '', t: await r.text() };
};

const admin = await webLogin('admin@gmail.com', ADMIN_PW);
let r = await page('/devices', admin); ok('admin /devices 200 + formulaire', r.s === 200 && r.t.includes('Terminaux Mobiles') && r.t.includes('CreateDeviceForm'), r.s + ' ' + r.loc);
r = await page('/integrations', admin); ok('admin /integrations 200, plus de cle en clair', r.s === 200 && !r.t.includes('evthub_test_key_2026') && r.t.includes('RotateApiKeyButton'), r.s + ' ' + r.loc);
r = await page('/admin/users', admin); ok('admin /admin/users accessible (plus de redirection)', r.s === 200, r.s + ' ' + r.loc);
r = await page('/scans', admin); ok('admin /scans 200', r.s === 200, r.s + ' ' + r.loc);
r = await page('/events', admin); ok('admin /events 200', r.s === 200, r.s + ' ' + r.loc);
r = await page('/dashboard', admin); ok('admin /dashboard 200', r.s === 200, r.s + ' ' + r.loc);
r = await page('/api/v1/scans?format=csv', admin); ok('export CSV via cookie de session 200', r.s === 200 && r.t.includes('ID_Scan'), r.s + ' ' + r.t.slice(0, 100));
r = await page('/api/v1/scans?format=csv'); ok('export CSV sans session 401', r.s === 401, r.s);

const agent = await webLogin('agent@scanhub.ne', AGENT_PW);
r = await page('/devices', agent); ok('agent /devices -> /unauthorized', r.s >= 300 && r.s < 400 && r.loc.includes('/unauthorized'), r.s + ' ' + r.loc);
r = await page('/admin/users', agent); ok('agent /admin/users -> /unauthorized', r.s >= 300 && r.s < 400 && r.loc.includes('/unauthorized'), r.s + ' ' + r.loc);
r = await page('/unauthorized', agent); ok('page /unauthorized existe', r.s === 200 && r.t.includes('Accès refusé'), r.s + ' ' + r.loc);
r = await page('/scans', agent); ok('agent /scans 200', r.s === 200, r.s + ' ' + r.loc);
r = await page('/devices'); ok('anonyme /devices -> login', r.s >= 300 && r.s < 400 && r.loc.includes('/auth/login'), r.s + ' ' + r.loc);
r = await page('/logoo.jpg'); ok('logo servi', r.s === 200, r.s);

console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
