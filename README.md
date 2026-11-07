# railway-container-orchestrator

A TypeScript GraphQL container orchestrator: spin containers up and down
through a Railway-shaped GraphQL API, then diagnose failures with the
deployment doctor.

This is the exact shape of Railway's own hiring task — *build an application
to spin up and spin down a container using the GraphQL API, with a UI* — plus
the fix for the most common complaint in their open-source builder issues:
**opaque "Deployment failed" errors**.

## Why this exists

The top open issues on Railway's `nixpacks` builder are build failures with
no actionable diagnosis (`Deployment failed`, `Failed to solve process`,
wrong default versions). Users see a red badge and a log dump, not the repair.
This project keeps the failure signature structured end to end — logs, error
code, classification, and the exact fix — so the diagnosis is available over
the API, the CLI and the UI.

## Stack

- TypeScript / Node.js 20+, Fastify
- GraphQL-shaped API (`POST /graphql`, operation + variables)
- Deterministic in-memory container engine: `QUEUED → BUILDING → DEPLOYING → RUNNING`, plus `FAILED`, `STOPPED`, `TERMINATED`
- Deployment doctor: classifies build/deploy failures and returns the repair
- Typed client + CLI (`up`, `down`, `doctor`, `project:create`, ...)
- Single-page dashboard UI (Inter Tight / Inter / JetBrains Mono)
- Vitest suite, Docker image, GitHub Actions CI

## Honest scope

This is a *protocol replica*, not the real Railway backend: the builder is a
deterministic simulator driven by the service definition, and no Railway
account or token is used. Live deployment against `backboard.railway.app/v2`
is one `baseUrl` change away, by design.

## Run

```bash
npm ci
npm run build
PORT=4000 npm start          # server on :4000, UI at /
npm test
```

CLI:

```bash
RAILWAY_API_URL=http://127.0.0.1:4000 npm run cli -- project:create demo
RAILWAY_API_URL=http://127.0.0.1:4000 npm run cli -- service:create <projectId> node:22-alpine web
RAILWAY_API_URL=http://127.0.0.1:4000 npm run cli -- up <serviceId>
RAILWAY_API_URL=http://127.0.0.1:4000 npm run cli -- down <serviceId>
RAILWAY_API_URL=http://127.0.0.1:4000 npm run cli -- doctor <serviceId>
```

## GraphQL API

`POST /graphql` with `{ "operation": "...", "variables": {...} }`.

| Operation | Variables | Returns |
| --- | --- | --- |
| `projects` | — | `{ projects: [...] }` |
| `projectCreate` | `name` | `{ projectCreate: {...} }` |
| `projectDelete` | `id` | `{ projectDelete: { id, deleted } }` |
| `serviceCreate` | `projectId`, `input` | `{ serviceCreate: {...} }` |
| `services` | `projectId` | `{ services: [...] }` |
| `deploymentCreate` | `serviceId` | `{ deploymentCreate: {...} }` |
| `deploymentDown` | `serviceId` | `{ deploymentDown: {...} }` |
| `deploymentCancel` | `id` | `{ deploymentCancel: {...} }` |
| `deploymentDoctor` | `serviceId` | `{ deploymentDoctor: { failureClass, summary, evidence, fix } }` |

## Failure classes (the doctor)

`MISSING_START_CMD` · `PORT_NOT_LISTENING` · `OOMKilled` · `MISSING_ENV` ·
`HEALTH_CHECK_FAILED` · `BUILD_FAIL` · `UNKNOWN` — each with evidence lines
from the deployment log and the exact repair to apply. New classes are one
row in `src/doctor.ts`.

## Tests

```bash
npm test   # state machine, builder simulation, GraphQL operations,
           # doctor classifications, server routes, client round-trip
```
