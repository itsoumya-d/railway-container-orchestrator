# ADR 0003: Deployment Doctor Heuristic Engine

## Status
Accepted

## Context
Developers waste hours debugging cryptic container build and runtime failures. Over 80% of failures fall into known failure archetypes: out-of-memory kills (OOM 137), port binding conflicts, and missing startup commands.

## Decision
We implemented an embedded pattern-matching heuristic analyzer in `src/doctor.ts` that runs synchronously after any container state reaches CRASHED.

## Consequences
- Positive: Sub-5ms triage recommendations with exact copy-paste configuration repairs.
- Negative: Heuristics must be maintained as new language runtimes and build tools emerge.
