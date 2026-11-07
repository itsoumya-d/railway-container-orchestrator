import { describe, expect, it } from "vitest";
import { createStore } from "../src/store.js";
import { createDeployment, runDeployment } from "../src/engine.js";
import { diagnose } from "../src/doctor.js";

function failingDeployment(env: Record<string, string>, startCommand = "node dist/server.js") {
  const store = createStore();
  const service = {
    id: "svc_0001",
    projectId: "prj_0001",
    name: "web",
    image: "node:22-alpine",
    startCommand,
    port: 3000,
    environment: env,
    createdAt: new Date().toISOString(),
  };
  return runDeployment(createDeployment(store, service), service);
}

describe("doctor classifications", () => {
  it("classifies missing start commands with a repair", () => {
    const dx = diagnose(failingDeployment({}, "  "));
    expect(dx.failureClass).toBe("MISSING_START_CMD");
    expect(dx.fix).toContain("start command");
    expect(dx.evidence.length).toBeGreaterThan(0);
  });

  it("classifies port failures", () => {
    const dx = diagnose(failingDeployment({}, "sleep 100 # noport"));
    expect(dx.failureClass).toBe("PORT_NOT_LISTENING");
  });

  it("classifies OOM kills", () => {
    const dx = diagnose(failingDeployment({ FORCE_OOM: "1" }));
    expect(dx.failureClass).toBe("OOMKilled");
    expect(dx.fix).toContain("memory limit");
  });

  it("classifies missing env vars", () => {
    const dx = diagnose(
      failingDeployment({ DATABASE_URL: "" }, "node dist/server.js # require-env"),
    );
    expect(dx.failureClass).toBe("MISSING_ENV");
    expect(dx.evidence.join("\n")).toContain("DATABASE_URL");
  });

  it("classifies healthcheck failures", () => {
    const dx = diagnose(failingDeployment({ HEALTHCHECK_FAILS: "1" }));
    expect(dx.failureClass).toBe("HEALTH_CHECK_FAILED");
  });

  it("classifies generic build errors as BUILD_FAIL", () => {
    const store = createStore();
    const service = {
      id: "svc_0001",
      projectId: "prj_0001",
      name: "web",
      image: "node:22-alpine",
      startCommand: "node dist/server.js",
      port: 3000,
      environment: {},
      createdAt: new Date().toISOString(),
    };
    const dep = runDeployment(createDeployment(store, service), service);
    dep.logs = ["ERROR: build failed at step 3: exit code 1"];
    dep.errorCode = null;
    const dx = diagnose(dep);
    expect(dx.failureClass).toBe("BUILD_FAIL");
  });

  it("reports UNKNOWN for unmatched logs", () => {
    const store = createStore();
    const service = {
      id: "svc_0001",
      projectId: "prj_0001",
      name: "web",
      image: "node:22-alpine",
      startCommand: "node dist/server.js",
      port: 3000,
      environment: {},
      createdAt: new Date().toISOString(),
    };
    const dep = runDeployment(createDeployment(store, service), service);
    dep.logs = ["something weird happened"];
    dep.errorCode = null;
    dep.status = "FAILED";
    const dx = diagnose(dep);
    expect(dx.failureClass).toBe("UNKNOWN");
    expect(dx.summary).toContain("cause class");
    expect(dx.fix).toContain("No known pattern");
  });

  it("says nothing to fix for running deployments", () => {
    const store = createStore();
    const service = {
      id: "svc_0001",
      projectId: "prj_0001",
      name: "web",
      image: "node:22-alpine",
      startCommand: "node dist/server.js",
      port: 3000,
      environment: {},
      createdAt: new Date().toISOString(),
    };
    const dep = runDeployment(createDeployment(store, service), service);
    const dx = diagnose(dep);
    expect(dx.failureClass).toBe("UNKNOWN");
    expect(dx.fix).toContain("Nothing to fix");
  });
});
