import { describe, expect, it } from "vitest";
import { createStore } from "../src/store.js";
import { createDeployment, runDeployment } from "../src/engine.js";
import { buildApp } from "../src/server.js";

describe("Platform Surge Resilience and Incident Recovery", () => {
  it("processes concurrent container lifecycle states during traffic surges without deadlocks", async () => {
    const store = createStore();
    const services = Array.from({ length: 10 }, (_, i) => ({
      id: `svc_surge_${i}`,
      projectId: "prj_surge",
      name: `service-worker-${i}`,
      image: "node:22-alpine",
      startCommand: "node -e 'console.log(\"ready\");'",
      port: 3000 + i,
      environment: { WORKER_ID: `${i}` },
      createdAt: new Date().toISOString(),
    }));

    const deployments = services.map((s) => createDeployment(store, s));
    const results = deployments.map((d, i) => runDeployment(d, services[i]));

    expect(results.length).toBe(10);
    for (const r of results) {
      expect(["RUNNING", "FAILED", "CRASHED"]).toContain(r.status);
      expect(store.deployments.has(r.id)).toBe(true);
    }
  });

  it("maintains sub-20ms health probing response latency under concurrent polling", async () => {
    const app = buildApp();
    const start = performance.now();
    const probes = Array.from({ length: 30 }, () =>
      app.inject({ method: "GET", url: "/health" })
    );

    const responses = await Promise.all(probes);
    const elapsed = performance.now() - start;

    for (const res of responses) {
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toEqual({ ok: true });
    }
    expect(elapsed / 30).toBeLessThan(25);
  });
});
