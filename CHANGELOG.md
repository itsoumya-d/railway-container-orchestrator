# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-11-17
### Added
- Automated failure-injection resilience tests covering container OOM and crash states.
- Smoke testing script `scripts/smoke.sh` and CI smoke step.
- Rollback runbook in `docs/runbook.md`.
- Architecture design document and ADRs for architectural decisions.

## [1.1.0] - 2026-11-07
### Added
- Deployment doctor heuristic analyzer for OOM, port binding, and syntax errors.
- Vitest unit test suite with 100% core domain coverage.
- Docker multi-stage build containerization.

## [1.0.0] - 2026-10-25
### Added
- Initial GraphQL container state engine and Fastify HTTP server.
