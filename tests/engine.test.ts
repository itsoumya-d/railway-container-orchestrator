import { describe, expect, it } from "vitest";
import { createStore, mintId, now } from "../src/store.js";
import {
  canTransition,
  createDeployment,
  downDeployment,
  latestForService,
  runDeployment,
  simulateBuild,
  transition,
} from "../src/engine.js";

function service(over: Partial<ReturnType<typeof makeService>> = {}) {
  return makeService(over);
}
function makeService(over: object = {}) {
  return {
    id: "svc_0001",
    projectId: "prj_0001",
    name: "web",
    image: "node:22-alpine",
    startCommand: "node dist/server.js",
    port: 3000,
    environment: {},
    createdAt: now(),
    ...over,
  };
}

describe("state machine", () => {
  it("allows the happy path and blocks illegal jumps", () => {
    expect(canTransition("QUEUED", "BUILDING")).toBe(true);
    expect(canTransition("QUEUED", "RUNNING")).toBe(false);
    expect(canTransition("TERMINATED", "BUILDING")).toBe(false);
  });

  it("throws on an illegal transition", () => {
    const store = createStore();
    const dep = createDeployment(store, service());
    expect(() => transition(dep, "RUNNING")).toThrow(/illegal transition/);
  });
});

describe("simulateBuild", () => {
  it("succeeds for a healthy service", () => {
    const out = simulateBuild(service());
    expect(out.ok).toBe(true);
    expect(out.errorCode).toBeNull();
    expect(out.logs.join("\n")).toContain("healthcheck ok");
  });

  it("flags a missing start command", () => {
    const out = simulateBuild(service({ startCommand: "  " }));
    expect(out.ok).toBe(false);
    expect(out.errorCode).toBe("MISSING_START_CMD");
  });

  it("flags a process that does not bind a port", () => {
    const out = simulateBuild(service({ startCommand: "sleep 100 # noport" }));
    expect(out.ok).toBe(false);
    expect(out.errorCode).toBe("PORT_NOT_LISTENING");
  });

  it("flags OOM kills", () => {
    const out = simulateBuild(service({ environment: { FORCE_OOM: "1" } }));
    expect(out.ok).toBe(false);
    expect(out.errorCode).toBe("OOMKilled");
  });

  it("flags empty required env vars", () => {
    const out = simulateBuild(
      service({ startCommand: "node dist/server.js # require-env", environment: { DATABASE_URL: "" } }),
    );
    expect(out.ok).toBe(false);
    expect(out.errorCode).toBe("MISSING_ENV");
  });
});

describe("runDeployment / downDeployment", () => {
  it("runs a healthy deployment to RUNNING", () => {
    const store = createStore();
    const dep = runDeployment(createDeployment(store, service()), service());
    expect(dep.status).toBe("RUNNING");
    expect(dep.errorCode).toBeNull();
  });

  it("marks a build failure as FAILED with the error code", () => {
    const store = createStore();
    const dep = runDeployment(createDeployment(store, service({ startCommand: "" })), service({ startCommand: "" }));
    expect(dep.status).toBe("FAILED");
    expect(dep.errorCode).toBe("MISSING_START_CMD");
  });

  it("marks a failing healthcheck as FAILED", () => {
    const store = createStore();
    const svc = service({ environment: { HEALTHCHECK_FAILS: "1" } });
    const dep = runDeployment(createDeployment(store, svc), svc);
    expect(dep.status).toBe("FAILED");
    expect(dep.errorCode).toBe("HEALTH_CHECK_FAILED");
  });

  it("spins a running deployment down to TERMINATED", () => {
    const store = createStore();
    const dep = runDeployment(createDeployment(store, service()), service());
    downDeployment(dep);
    expect(dep.status).toBe("TERMINATED");
    expect(dep.logs.join("\n")).toContain("resources released");
  });

  it("latestForService returns the newest deployment", () => {
    const store = createStore();
    const svc = service();
    const first = runDeployment(createDeployment(store, svc), svc);
    const second = runDeployment(createDeployment(store, svc), svc);
    expect(first.id).not.toBe(second.id);
    expect(latestForService(store, svc.id)?.id).toBe(second.id);
  });

  it("mintId produces unique ids", () => {
    const store = createStore();
    expect(mintId(store, "x")).not.toBe(mintId(store, "x"));
  });
});
