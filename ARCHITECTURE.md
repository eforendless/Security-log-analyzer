# AI Security Log Analyzer Architecture

## Scope of This Stage

This document defines the initial architecture only. The implementation will proceed in vertical slices so each feature is usable, testable, and reviewable before the next begins.

## System Overview

The application is a TypeScript monorepo with a browser client, an HTTP API, and shared packages. The API owns file handling, log parsing, persistence, and LLM orchestration. The client only consumes stable API contracts and renders the analyst workflow.

```text
Browser (React + Vite + Tailwind)
        |
        | HTTPS / JSON + multipart upload
        v
Express API (controllers, auth, validation)
        |
        v
Application use cases
        |
        +--> Domain (events, alerts, severity, MITRE mapping)
        |
        +--> Infrastructure adapters
                 |- EVTX/text parsers
                 |- LLM provider
                 |- Database/repositories
                 |- File storage
```

## Repository Layout

```text
.
|- apps/
|  |- web/                         # React, Vite, Tailwind application
|  |  |- src/
|  |  |  |- app/                   # Router, providers, application shell
|  |  |  |- features/              # Feature-owned screens, hooks, API bindings
|  |  |  |- components/            # Reusable presentational components
|  |  |  |- lib/                   # HTTP client, formatters, utilities
|  |  |  `- styles/                # Tailwind entry point and design tokens
|  |  `- public/
|  `- api/                         # Express HTTP adapter
|     `- src/
|        |- config/                # Environment parsing and application config
|        |- modules/               # Controller and route composition by feature
|        |- middleware/            # Errors, upload limits, request logging
|        `- server.ts              # HTTP bootstrap only
|- packages/
|  |- domain/                      # Entities, value objects, repository ports
|  |- application/                 # Use cases and DTOs; depends on domain ports
|  |- infrastructure/              # Parser, LLM, storage, database implementations
|  `- contracts/                   # Versioned API schemas shared by API and web
|- tests/
|  |- integration/                 # API and adapter integration tests
|  `- fixtures/                    # Sanitized sample exported logs
|- infra/
|  |- docker/                      # Container configuration and entrypoints
|  `- compose/                     # Local development compose configuration
|- .github/workflows/              # CI checks and container build workflow
|- docs/                           # Operational and security documentation
`- package.json                    # Workspace scripts and toolchain configuration
```

## Clean Architecture Rules

- `domain` has no dependencies on Express, React, databases, filesystems, or LLM SDKs.
- `application` coordinates use cases through interfaces defined in `domain`.
- `infrastructure` implements ports for EVTX/text parsing, persistence, file storage, and LLM providers.
- `api` translates HTTP requests into application DTOs and maps typed errors to HTTP responses.
- `web` imports only shared request/response contracts, never application or infrastructure code.
- Dependency direction always points inward: adapters depend on application/domain, never the reverse.

## Core Domain Model

| Concept            | Responsibility                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| `LogUpload`        | Immutable record of upload metadata, checksum, source, and processing status.                         |
| `SecurityEvent`    | Normalized Windows event with timestamp, provider, event ID, host, user, and raw context.             |
| `Detection`        | Deterministic rule match produced during parsing and enrichment.                                      |
| `Analysis`         | Structured LLM result: severity, explanation, confidence, MITRE techniques, and recommendations.      |
| `Alert`            | Analyst-facing aggregate combining event, detections, analysis, lifecycle status, and audit metadata. |
| `DashboardMetrics` | Read model containing alert counts, severity distribution, processing state, and recent alerts.       |

Severity is represented as a closed value set: `informational`, `low`, `medium`, `high`, and `critical`. MITRE data is stored as technique IDs plus names, not free-form model text alone.

## Processing Pipeline

1. Validate the file extension, MIME type, configured size limit, and malware-scanning policy hook.
2. Store the original file outside the public web root and calculate a SHA-256 checksum.
3. Parse `.evtx` through an EVTX adapter or text exports through a format-specific parser.
4. Normalize parser output into `SecurityEvent` entities and retain source references for traceability.
5. Run deterministic enrichment and prioritization to select only relevant events for LLM analysis.
6. Submit a redacted, bounded event batch to the configured LLM provider using a strict JSON schema.
7. Validate the response, map MITRE technique IDs against the local catalog, and persist alerts and analysis.
8. Expose dashboard and alert read models through the API.

The initial implementation uses synchronous processing for small uploads with a `processing` status. The port design permits a later queue worker without changing API contracts or domain logic.

## API Surface

All routes are prefixed with `/api/v1` and return typed JSON errors using a stable envelope.

| Method  | Endpoint             | Responsibility                                                       |
| ------- | -------------------- | -------------------------------------------------------------------- |
| `POST`  | `/uploads`           | Accept a Windows log upload and start processing.                    |
| `GET`   | `/uploads/:uploadId` | Return upload and processing status.                                 |
| `GET`   | `/alerts`            | List alerts with severity, time, host, and status filters.           |
| `GET`   | `/alerts/:alertId`   | Return event evidence, analysis, MITRE mapping, and recommendations. |
| `PATCH` | `/alerts/:alertId`   | Update analyst triage state and optional notes.                      |
| `GET`   | `/dashboard`         | Return summary statistics and recent alerts.                         |
| `GET`   | `/health`            | Return readiness and liveness-safe health data.                      |

Request and response bodies are defined with runtime schemas in `packages/contracts`; TypeScript types are inferred from those schemas.

## Web Application Structure

The web client is feature-oriented:

```text
features/
|- dashboard/                      # Summary statistics and recent alerts
|- uploads/                        # Drag-and-drop upload and processing state
|- alerts/                         # Filterable list, alert detail, analyst triage
`- analysis/                       # Structured severity, MITRE, recommendations views
```

Reusable UI components include layout/navigation, data tables, severity badges, statistic tiles, empty/error/loading states, file drop zones, filters, and accessible dialogs. Tailwind design tokens define the dark cybersecurity interface: charcoal surfaces, high-contrast text, restrained cyan status accents, and severity-specific semantic colors. All displays must support keyboard navigation, screen readers, reduced motion, and narrow viewports.

## Security and Privacy Baseline

- Treat uploaded logs as sensitive evidence; do not expose them through static file serving.
- Enforce file size/type validation, upload rate limits, checksums, and audit logs.
- Redact configured personal identifiers, tokens, IP addresses, and secrets before sending content to an LLM.
- Use provider credentials only on the server via environment variables; never bundle them into the client.
- Enforce structured LLM output with schema validation, token/event limits, retries, timeouts, and explicit failure states.
- Keep an evidence trail from each alert to source event references, deterministic detections, model name, and prompt version.
- Use parameterized data access, a restrictive CORS policy, secure headers, and production request logging without raw sensitive payloads.

## Persistence and Integrations

The initial local environment uses PostgreSQL for uploads, normalized events, alerts, analyses, and analyst actions; original files use a configurable local volume. Infrastructure ports allow replacement with object storage, a managed database, an asynchronous job queue, or alternate LLM providers. The LLM provider is selected by configuration and must implement a common `SecurityAnalysisProvider` interface.

## Tooling and Delivery

- npm workspaces with one root lockfile and shared TypeScript configuration.
- ESLint with TypeScript, React hooks, and import-boundary rules.
- Prettier applied through a root formatting script and editor configuration.
- Unit tests for domain/application code, parser fixtures, and API integration tests.
- Dockerfiles for the web and API applications plus a Compose configuration for the API, web, PostgreSQL, and persistent upload volume.
- GitHub Actions pipeline: install, format check, lint, typecheck, test, build, Docker build, and dependency/security scanning.

## Incremental Delivery Plan

1. Bootstrap the workspace, shared toolchain, API health endpoint, and dark application shell.
2. Implement text log upload, validation, safe storage, and upload status.
3. Add normalized text-event parsing with fixtures and deterministic summaries.
4. Add dashboard statistics and recent-alert read model.
5. Add alert list/detail views with severity and analyst triage.
6. Add the LLM provider port, redaction, schema validation, and analysis display.
7. Add EVTX parsing adapter and broaden Windows event mapping coverage.
8. Add Docker, CI, observability, hardening, and production deployment documentation.

## First Implementation Slice

The first implementation slice will bootstrap the monorepo and quality tooling, then deliver only two visible capabilities: an API `/health` endpoint and a responsive dark web application shell. It deliberately excludes upload and LLM behavior so the project foundation can be verified independently.
