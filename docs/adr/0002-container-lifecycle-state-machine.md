# ADR 0002: Deterministic Container Lifecycle State Machine

## Status
Accepted

## Context
Deployments transition through multiple volatile phases (INITIALIZING, BUILDING, DEPLOYING, RUNNING, CRASHED, REMOVED). Race conditions between build completion and health check probing could leave containers in indeterminate states.

## Decision
We implemented a strict unidirectional state machine in `src/engine.ts`. Invalid state transitions trigger explicit diagnostic log events and rejection.

## Consequences
- Positive: Predictable recovery and zero orphaned containers.
- Negative: Explicit transition handling required for edge-case cancellations.
