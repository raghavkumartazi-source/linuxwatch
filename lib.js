const crypto = require('node:crypto');
function equal(input, expected) {
  if (typeof input !== 'string' || typeof expected !== 'string' || input.length > 256) return false;
  return crypto.timingSafeEqual(crypto.createHash('sha256').update(input).digest(), crypto.createHash('sha256').update(expected).digest());
}
function configuration(env) {
  const password = env.DASHBOARD_PASSWORD;
  const agentToken = env.AGENT_TOKEN;
  if (!password || password.length < 12 || password.length > 256 || /change.me|password123/i.test(password)) throw new Error('Set a unique DASHBOARD_PASSWORD of 12–256 characters.');
  if (!agentToken || agentToken.length < 32 || agentToken.length > 256 || /change.me/i.test(agentToken) || equal(password, agentToken)) throw new Error('Set a separate random AGENT_TOKEN of 32–256 characters.');
  const host = env.HOST || '127.0.0.1';
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT.');
  const origin = new URL(env.PUBLIC_ORIGIN || `http://127.0.0.1:${port}`).origin;
  if (!['http:', 'https:'].includes(new URL(origin).protocol)) throw new Error('Invalid PUBLIC_ORIGIN.');
  const secure = origin.startsWith('https:');
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !secure) throw new Error('A network-facing host requires an HTTPS PUBLIC_ORIGIN and TLS reverse proxy.');
  return { password, agentToken, host, port, origin, secure };
}
function validateMetrics(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected metrics object.');
  if (typeof value.deviceId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(value.deviceId)) throw new Error('Invalid device ID.');
  const result = { deviceId: value.deviceId };
  for (const field of ['cpuPercent', 'memoryPercent', 'diskPercent']) {
    if (typeof value[field] !== 'number' || !Number.isFinite(value[field]) || value[field] < 0 || value[field] > 100) throw new Error('Invalid percentage.');
    result[field] = value[field];
  }
  if (typeof value.observedAt !== 'string' || !Number.isFinite(Date.parse(value.observedAt)) || Math.abs(Date.now() - Date.parse(value.observedAt)) > 600000) throw new Error('Invalid observation time.');
  result.observedAt = value.observedAt;
  return result;
}
module.exports = { equal, configuration, validateMetrics };
