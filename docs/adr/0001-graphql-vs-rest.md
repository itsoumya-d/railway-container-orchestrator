# ADR 0001: GraphQL API for Orchestrator Interface

## Status
Accepted

## Context
We needed an interface for developers to manage services, trigger deployments, and query live logs and diagnostic results. Railway's public developer API is GraphQL-first.

## Decision
We implemented a GraphQL engine over Fastify rather than a conventional REST API.

## Consequences
- Positive: Seamless compatibility with Railway tooling and typed queries.
- Negative: Requires GraphQL query parsing overhead, mitigated by caching schema queries.
