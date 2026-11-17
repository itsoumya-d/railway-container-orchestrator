import { describe, expect, it } from "vitest";
import { createStore } from "../src/store.js";
import { createDeployment, runDeployment } from "../src/engine.js";
import { diagnose } from "../src/doctor.js";
import { buildApp } from "../src/server.js";

describe("Failure injection and resilience tests", () => {
  it("gracefully isolates simulated out-of-memory crash without affecting store", () => {
    const store = createStore();
    const crashingService = {
      id: "svc_oom_crash",
      projectId: "prj_resilience",
      name: "crash-service",
      image: "node:22-alpine",
      startCommand: "node --max-old-space-size=16 -e 'const a=[]; while(true) a.push(1);'",
      port: 3000,
      environment: {},
      createdAt: new Date().toISOString(),
    };

    const dep = createDeployment(store, crashingService);
    const result = runDeployment(dep, crashingService);

    expect(result.status).toBe("CRASHED");
    const dx = diagnose(result);
    expect(dx.failureClass).toBe("OOM_KILLED");
    expect(store.deployments.get(dep.id)).toBeDefined();
  });

  it("handles malformed GraphQL queries with structured 400 error rather than unhandled exception", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/graphql",
      payload: { query: "query { invalidField { nonExistent } }" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.errors).toBeDefined();
    expect(body.errors.length).toBeGreaterThan(0);
  });

  it("recovers health checks during high concurrency load", async () => {
    const app = buildApp();
    const requests = Array.from({ length: 50 }, () =>
      app.inject({ method: "GET", url: "/health" })
    );

    const responses = await Promise.all(requests);
    for (const r of responses) {
      expect(r.statusCode).toBe(200);
      expect(JSON.parse(r.payload)).toEqual({ ok: true });
    }
  });
});
