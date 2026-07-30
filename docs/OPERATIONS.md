# Operations Guide

## Local Development

The API reads its runtime configuration from `apps/api/.env`. Start from
`apps/api/.env.example`, but keep the local `.env` ignored and never place real provider
credentials in the example file.

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
OPENAI_TIMEOUT_MS=15000
CORS_ALLOWED_ORIGINS=http://localhost:5173
RATE_LIMIT_MAX_REQUESTS=120
RATE_LIMIT_WINDOW_MS=60000
REQUEST_LOGGING_ENABLED=true
TRUST_PROXY=false
```

Run the local services from the repository root:

```powershell
npm run dev
```

Health endpoints:

- `GET /api/v1/health/live` confirms the process is running.
- `GET /api/v1/health/ready` confirms the private upload storage directory is writable.

Request logs contain method, path, status, duration, and request ID only. They never record raw
uploads, event evidence, tokens, API keys, or request bodies.

## Windows Desktop Application

Build the Windows installer from the repository root:

```powershell
npm run desktop:package
```

The installer is written to `release/`. It installs a single-user desktop application that starts
its API on an ephemeral `127.0.0.1` port and opens the packaged React interface. The API is never
exposed to the local network. Original uploads, metadata, triage state, and analysis results live
under `%APPDATA%\Security Log Analyzer\uploads`.

On first launch, the desktop application creates
`%APPDATA%\Security Log Analyzer\config\.env`. AI analysis is optional. To enable it, set the
provider key there and restart the desktop application:

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

Do not distribute an unsigned installer to end users. Configure a Windows code-signing certificate
for the packaging environment before production release so Windows can verify the publisher.

## Container Deployment

Create a local `apps/api/.env` with the required production values, then run:

```powershell
docker compose -f infra/compose/compose.yaml up --build
```

The web application is available at `http://localhost:8080`. Nginx serves the React build and
proxies `/api` to the private API container, avoiding browser-to-API cross-origin traffic.

The `security_log_uploads` named volume stores original uploads, metadata, triage state, and
validated analysis results. Back it up according to your evidence-retention policy. Do not expose
the volume or the API container directly to the public internet.

## Security Controls

- The API applies Helmet headers, disables `X-Powered-By`, limits JSON payloads, caps multipart
  fields/parts, and rate-limits requests.
- CORS permits only exact comma-separated origins in `CORS_ALLOWED_ORIGINS`. Leave it empty for
  same-origin reverse-proxy deployments.
- The API and web containers run read-only with dropped Linux capabilities. Only the persistent
  upload volume and temporary directory are writable.
- OpenAI requests use server-only credentials, a bounded redacted event, a timeout, `store: false`,
  and strict structured output validation.
- EVTX records are parsed with `@ts-evtx/core`; the processing path caps events at 10,000 per
  upload. Larger files must be split or handled by a future asynchronous processing worker.

## Incident Response

If a provider credential is exposed, revoke it in the provider console, create a replacement,
update only `apps/api/.env`, and restart the API. Do not put a key in source files, CI variables
printed by logs, browser environment variables, or `.env.example`.
