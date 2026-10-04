"""Visible foreground Linux health reporter. No personal activity or remote commands."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import time
from urllib.parse import urlparse
from urllib.request import Request, build_opener, HTTPRedirectHandler

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def cpu_snapshot(text):
    fields = text.splitlines()[0].split()
    if fields[0] != 'cpu' or len(fields) < 6:
        raise ValueError('Invalid /proc/stat')
    values = [int(value) for value in fields[1:9]]
    return sum(values), values[3] + values[4]

def cpu_percent(previous, current):
    total = current[0] - previous[0]
    idle = current[1] - previous[1]
    return max(0.0, min(100.0, 100.0 * (total - idle) / total)) if total > 0 else 0.0

def memory_percent(text):
    values = {line.split(':', 1)[0]: int(line.split(':', 1)[1].split()[0]) for line in text.splitlines() if ':' in line}
    total = values['MemTotal']
    available = values.get('MemAvailable', values.get('MemFree', 0))
    if total <= 0:
        raise ValueError('Invalid memory total')
    return max(0.0, min(100.0, 100.0 * (total - available) / total))

def disk_percent(stats):
    if stats.f_blocks <= 0:
        raise ValueError('Invalid disk total')
    return max(0.0, min(100.0, 100.0 * (stats.f_blocks - stats.f_bavail) / stats.f_blocks))

def validate_endpoint(endpoint):
    url = urlparse(endpoint)
    if url.username or url.password or url.query or url.fragment or url.path not in ('', '/'):
        raise ValueError('Use a server origin without credentials, path or query')
    if not url.hostname or (url.scheme != 'https' and not (url.scheme == 'http' and url.hostname in ('127.0.0.1', 'localhost', '::1'))):
        raise ValueError('Use HTTPS; HTTP is allowed only on loopback')
    return endpoint.rstrip('/') + '/api/metrics'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--server', required=True, help='HTTPS server origin (loopback HTTP is allowed)')
    parser.add_argument('--device-id', required=True, help='A chosen label; avoid personal identifying information')
    parser.add_argument('--disk', default='/', help='Filesystem to measure; its path is not transmitted')
    parser.add_argument('--interval', type=int, default=15)
    parser.add_argument('--consent', action='store_true', help='Confirm you own/administer this device and consent to sharing health')
    args = parser.parse_args()
    if not args.consent:
        parser.error('Review the README and add --consent to share CPU, memory and disk percentages')
    token = os.environ.get('LINUXWATCH_AGENT_TOKEN', '')
    if len(token) < 32 or len(token) > 256 or 'change-me' in token.lower():
        parser.error('Set a new LINUXWATCH_AGENT_TOKEN of 32–256 characters')
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}', args.device_id) or not 5 <= args.interval <= 3600:
        parser.error('Use a safe device ID and an interval from 5 to 3600 seconds')
    endpoint = validate_endpoint(args.server)
    if not Path('/proc/stat').exists():
        parser.error('This agent requires Linux /proc; it will not run on this system')
    print('LinuxWatch is sharing CPU, memory and disk percentages. No app/browser data is collected. Press Ctrl+C to stop.', flush=True)
    opener = build_opener(NoRedirect())
    previous = cpu_snapshot(Path('/proc/stat').read_text())
    try:
        while True:
            time.sleep(args.interval)
            current = cpu_snapshot(Path('/proc/stat').read_text())
            payload = {'deviceId': args.device_id, 'cpuPercent': round(cpu_percent(previous, current), 2),
                       'memoryPercent': round(memory_percent(Path('/proc/meminfo').read_text()), 2),
                       'diskPercent': round(disk_percent(os.statvfs(args.disk)), 2),
                       'observedAt': datetime.now(timezone.utc).isoformat()}
            previous = current
            request = Request(endpoint, data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}, method='POST')
            try:
                with opener.open(request, timeout=10) as response:
                    if response.status != 202:
                        print('Report was not accepted.', flush=True)
            except Exception as error:
                # Never print request URLs or tokens in error traces.
                print(f'Report failed ({type(error).__name__}); retrying at the next interval.', flush=True)
    except KeyboardInterrupt:
        print('Sharing stopped.', flush=True)

if __name__ == '__main__':
    main()
