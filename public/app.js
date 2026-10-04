const notice = document.getElementById('notice');
let interval;
let generation = 0;
function signedOut(message) {
  generation++; clearInterval(interval); document.getElementById('dashboard').hidden = true;
  document.getElementById('login').hidden = false; document.getElementById('devices').replaceChildren(); notice.textContent = message;
}
async function refresh() {
  const current = generation;
  try {
    const response = await fetch('/api/devices', { cache: 'no-store' });
    if (current !== generation) return;
    if (response.status === 401) { signedOut('Sign in to view device health.'); return; }
    if (!response.ok) throw new Error('Unable to load health reports.');
    const { devices } = await response.json();
    if (current !== generation) return;
    document.getElementById('login').hidden = true; document.getElementById('dashboard').hidden = false;
    const cards = devices.map(device => {
      const card = document.createElement('article'); const title = document.createElement('h2'); title.textContent = device.deviceId; card.append(title);
      const state = document.createElement('p'); state.textContent = device.stale ? 'No recent report. The device may have stopped sharing.' : 'Recent report'; card.append(state);
      const list = document.createElement('dl');
      for (const [label, value] of [['CPU', device.cpuPercent], ['Memory', device.memoryPercent], ['Disk', device.diskPercent]]) { const dt = document.createElement('dt'); dt.textContent = label; const dd = document.createElement('dd'); dd.textContent = `${value}%`; list.append(dt, dd); }
      card.append(list); const time = document.createElement('small'); time.textContent = `Last received: ${new Date(device.receivedAt).toLocaleString()}`; card.append(time); return card;
    });
    document.getElementById('devices').replaceChildren(...cards); notice.textContent = devices.length ? '' : 'No health reports yet. Start the foreground agent on a device you administer.';
  } catch (error) { if (current === generation) notice.textContent = error.message; }
}
document.getElementById('login').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.currentTarget.querySelector('button'); button.disabled = true;
  try {
    const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: document.getElementById('password').value }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Sign-in failed.');
    document.getElementById('password').value = ''; generation++; await refresh(); clearInterval(interval); interval = setInterval(refresh, 15000);
  } catch (error) { notice.textContent = error.message; } finally { button.disabled = false; }
});
document.getElementById('logout').addEventListener('click', async () => {
  try { const response = await fetch('/api/logout', { method: 'POST' }); if (!response.ok) throw new Error('Unable to sign out.'); signedOut('Signed out.'); }
  catch (error) { notice.textContent = error.message; }
});
refresh();
