const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');
const { configuration, validateMetrics } = require('../lib');
const env = { DASHBOARD_PASSWORD: 'synthetic-dashboard-passphrase', AGENT_TOKEN: 'synthetic-agent-key-01234567890123456789', PORT: '3000' };
const sample = () => ({ deviceId: 'test-device', cpuPercent: 42, memoryPercent: 55, diskPercent: 10, observedAt: new Date().toISOString() });
test('configuration refuses absent credentials and cleartext network exposure', () => { assert.throws(() => configuration({})); assert.throws(() => configuration({ ...env, HOST: '0.0.0.0' })); assert.equal(configuration({ ...env, HOST: '0.0.0.0', PUBLIC_ORIGIN: 'https://health.example.test' }).secure, true); });
test('metrics validation rejects malformed/unbounded data and discards personal fields', () => {
  for (const value of [null, [], { ...sample(), cpuPercent: '50' }, { ...sample(), memoryPercent: NaN }, { ...sample(), diskPercent: 101 }, { ...sample(), deviceId: '../x' }, { ...sample(), observedAt: '1990-01-01' }]) assert.throws(() => validateMetrics(value));
  assert.equal(Object.hasOwn(validateMetrics({ ...sample(), browserHistory: 'discarded' }), 'browserHistory'), false);
});
test('HTTP flow protects reads, authenticates reports, sets safe cookies and revokes sessions', async () => {
  const server = createServer(env); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  try {
    assert.equal((await fetch(base + '/api/devices')).status, 401);
    assert.equal((await post('/api/metrics', sample())).status, 401);
    assert.equal((await post('/api/metrics', sample(), { Authorization: `Bearer ${env.AGENT_TOKEN}` })).status, 202);
    assert.equal((await post('/api/login', { password: env.DASHBOARD_PASSWORD }, { Origin: 'https://attacker.example.test' })).status, 403);
    const login = await post('/api/login', { password: env.DASHBOARD_PASSWORD }); assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie'); assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/);
    const auth = { Cookie: cookie.split(';')[0] }; const response = await fetch(base + '/api/devices', { headers: auth });
    assert.equal((await response.json()).devices[0].cpuPercent, 42);
    assert.equal((await post('/api/logout', {}, auth)).status, 200);
    assert.equal((await fetch(base + '/api/devices', { headers: auth })).status, 401);
    assert.equal((await fetch(base + '/server.js')).status, 404);
    for (let i = 0; i < 5; i++) await post('/api/login', { password: 'bad' });
    assert.equal((await post('/api/login', { password: env.DASHBOARD_PASSWORD })).status, 429);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
