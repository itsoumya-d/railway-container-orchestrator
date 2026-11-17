# Operations Runbook

## Service Architecture
The Railway Container Orchestrator provides container state scheduling, GraphQL query execution, and automated deployment failure diagnosis.

## Health and Monitoring
- Health endpoint: `GET /health` returns `{"ok": true}`
- Port: 4000 (configurable via `PORT` environment variable)
- Metrics: Prometheus / Grafana scraping endpoint on port 4000

## Incident Response
1. Alert triggers on high latency (>50ms p95) or 5xx error rate (>0.1%).
2. On-call engineer acknowledges alert within 15 minutes.
3. Check container logs via `docker logs railway-container-orchestrator`.
4. Run diagnostics doctor: `npm run cli doctor`.

## Rollback Procedure
If a deployment degrades or health checks fail in production:
1. Identify the last known stable release tag or commit SHA (`git tag -l` or release registry).
2. Stop the degraded container: `docker stop railway-container-orchestrator`.
3. Roll back by deploying the previous verified container image:
   ```bash
   docker run -d --name railway-container-orchestrator -p 4000:4000 railway-container-orchestrator:previous-tag
   ```
4. Verify the rollback immediately using the smoke test:
   ```bash
   bash scripts/smoke.sh
   ```
5. Confirm `/health` answers 200 OK with latency < 15ms.
6. Record incident details in the post-mortem tracker and initiate blameless review.
