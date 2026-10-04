const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { equal, configuration, validateMetrics } = require('./lib');

function createServer(env = process.env) {
  const config = configuration(env);
  const devices = new Map();
  const sessions = new Map();
  const attempts = new Map();
  function authorized(req) {
    const token = req.headers.cookie?.split(';').map(item => item.trim()).find(item => item.startsWith('linuxwatch='))?.slice(11);
    const expiry = sessions.get(token);
    if (!expiry || expiry <= Date.now()) { sessions.delete(token); return false; }
    return true;
  }
  function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); }
  async function body(req) {
    if (!req.headers['content-type']?.startsWith('application/json')) throw new Error('Expected JSON.');
    let size = 0; const chunks = [];
    for await (const chunk of req) { size += chunk.length; if (size > 16000) throw new Error('Body too large.'); chunks.push(chunk); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const url = new URL(req.url, config.origin);
      if (req.method === 'POST' && req.headers.origin && req.headers.origin !== config.origin) return json(res, 403, { error: 'Origin not allowed.' });
      if (req.method === 'POST' && url.pathname === '/api/login') {
        const now = Date.now();
        for (const [id, state] of attempts) if (state.expires <= now) attempts.delete(id);
        const id = req.socket.remoteAddress || 'unknown';
        if (!attempts.has(id) && attempts.size >= 10000) return json(res, 429, { error: 'Try again later.' });
        const attempt = attempts.get(id) || { count: 0, expires: now + 300000 }; attempts.set(id, attempt);
        if (++attempt.count > 5) return json(res, 429, { error: 'Too many attempts. Wait five minutes.' });
        const input = await body(req);
        if (!equal(input?.password, config.password)) return json(res, 401, { error: 'Invalid passphrase.' });
        for (const [id, expiry] of sessions) if (expiry <= now) sessions.delete(id);
        if (sessions.size >= 1000) return json(res, 429, { error: 'Session capacity reached.' });
        const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, now + 28800000);
        res.setHeader('Set-Cookie', `linuxwatch=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${config.secure ? '; Secure' : ''}`);
        return json(res, 200, { success: true });
      }
      if (req.method === 'POST' && url.pathname === '/api/logout') {
        const token = req.headers.cookie?.split(';').map(item => item.trim()).find(item => item.startsWith('linuxwatch='))?.slice(11);
        sessions.delete(token); res.setHeader('Set-Cookie', `linuxwatch=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${config.secure ? '; Secure' : ''}`);
        return json(res, 200, { success: true });
      }
      if (req.method === 'POST' && url.pathname === '/api/metrics') {
        if (!equal(req.headers.authorization?.replace(/^Bearer /, ''), config.agentToken)) return json(res, 401, { error: 'Unauthorized.' });
        const metrics = validateMetrics(await body(req));
        const now = Date.now();
        for (const [id, value] of devices) if (now - value.receivedAt > 86400000) devices.delete(id);
        if (!devices.has(metrics.deviceId) && devices.size >= 64) return json(res, 429, { error: 'Device limit reached.' });
        devices.set(metrics.deviceId, { ...metrics, receivedAt: now });
        return json(res, 202, { accepted: true });
      }
      if (req.method === 'GET' && url.pathname === '/api/devices') {
        if (!authorized(req)) return json(res, 401, { error: 'Sign in to view device health.' });
        const now = Date.now();
        return json(res, 200, { devices: [...devices.values()].filter(device => now - device.receivedAt <= 86400000).map(device => ({ ...device, stale: now - device.receivedAt > 60000 })) });
      }
      const files = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
      if (req.method === 'GET' && Object.hasOwn(files, url.pathname)) {
        const [file, type] = files[url.pathname]; const content = await fs.readFile(path.join(__dirname, 'public', file));
        res.writeHead(200, { 'Content-Type': type }); return res.end(content);
      }
      json(res, 404, { error: 'Not found.' });
    } catch { if (!res.headersSent) json(res, 400, { error: 'Invalid request.' }); else res.end(); }
  });
  server.requestTimeout = 10000;
  return server;
}
if (require.main === module) {
  const config = configuration(process.env);
  createServer().listen(config.port, config.host, () => console.log(`LinuxWatch device health listening on ${config.origin}. No agent starts automatically.`));
}
module.exports = { createServer };
