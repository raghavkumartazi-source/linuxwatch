# LinuxWatch device health MVP

A small, visible device-health dashboard and a foreground Linux agent. It measures CPU, memory and disk percentages. It does not collect app usage, URLs, browser history, screenshots, webcam media or keystrokes, and exposes no remote commands or device controls.

## Server

Requires Node 22 or newer; there are no third-party runtime packages. Copy `.env.example` to `.env`, set a unique dashboard passphrase (12–256 characters) and a separate random agent token (32–256 characters), then run `npm start`. `openssl rand -hex 32` can generate a token. Defaults bind to `127.0.0.1:3000`.

For remote access, configure a TLS reverse proxy, set `HOST=0.0.0.0` and `PUBLIC_ORIGIN=https://your-host`. Network-facing cleartext configuration is rejected. HTTP must remain private behind the proxy. Add trusted-edge request limits for an exposed deployment. The dashboard uses an HttpOnly, SameSite=Strict cookie with an eight-hour session; HTTPS origins add Secure. Login has a five-attempt/IP/five-minute limit. Restarting the server revokes sessions.

## Foreground agent

Requires Python 3 on Linux with `/proc`; no third-party packages. Review what is sent with the device owner. Set `LINUXWATCH_AGENT_TOKEN` to the server token in your shell, then run:

```sh
python3 agent.py --server https://your-host --device-id study-laptop --consent
```

Choose a non-personal device label. The agent prints a disclosure, runs in the foreground and stops with Ctrl+C. No installer, background service or boot task is created. It sends only the device label, three percentages and observation time, every 15 seconds. `--disk` chooses the filesystem measured without transmitting its path. It rejects cleartext remote servers and redirects, so credentials cannot be forwarded to another host. HTTP loopback is available for local testing.

CPU uses deltas of `/proc/stat`; memory uses MemAvailable; disk shows the fraction unavailable to an ordinary user, including reserved blocks. Reports received more than 60 seconds ago are marked stale. Keep device clocks accurate: observations more than ten minutes from server time are rejected.

## Storage and limits

This MVP keeps only the latest report for up to 64 devices in memory. It does not provide history, durable storage, alert delivery or per-device enrollment. Reports older than 24 hours are hidden and removed during ingestion. A restart clears reports. A shared agent credential is appropriate only for a small trusted group of your devices; rotate it and restart the server to revoke access. Per-device tokens and durable metric history can be added after the health MVP is validated.

## Validation

Run `npm run check`. Node tests exercise the real local HTTP flow, authorization, report ingestion, safe cookies, logout, rate limits and payload validation. Python fixture tests exercise Linux counters and endpoint restrictions. Tests use synthetic metrics: no real device agent is started. CI runs these checks on Linux. Live reverse proxy/TLS and a consenting Linux device still need an end-to-end smoke test before deployment.
