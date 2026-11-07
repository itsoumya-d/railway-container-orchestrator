// Container lifecycle engine.
//
// A deployment moves QUEUED -> BUILDING -> DEPLOYING -> RUNNING, or ends in
// FAILED. `down` moves RUNNING -> STOPPED -> TERMINATED. The build is
// simulated deterministically from the service definition so tests can
// reproduce every outcome without a real container runtime.

import { Deployment, DeploymentStatus, Store, Service, now } from "./store.js";

export const NEXT_STATUS: Record<DeploymentStatus, DeploymentStatus[]> = {
  QUEUED: ["BUILDING", "TERMINATED"],
  BUILDING: ["DEPLOYING", "FAILED"],
  DEPLOYING: ["RUNNING", "FAILED"],
  RUNNING: ["STOPPED", "FAILED"],
  FAILED: ["TERMINATED"],
  STOPPED: ["TERMINATED"],
  TERMINATED: [],
};

export function canTransition(from: DeploymentStatus, to: DeploymentStatus): boolean {
  return NEXT_STATUS[from].includes(to);
}

export function transition(deployment: Deployment, to: DeploymentStatus): Deployment {
  if (!canTransition(deployment.status, to)) {
    throw new Error(
      `illegal transition ${deployment.status} -> ${to} for deployment ${deployment.id}`,
    );
  }
  deployment.status = to;
  if (to === "RUNNING" || to === "FAILED" || to === "TERMINATED") {
    deployment.finishedAt = now();
  }
  return deployment;
}

export interface BuildOutcome {
  ok: boolean;
  errorCode: string | null;
  logs: string[];
}

/**
 * Totally deterministic simulation of the builder, driven by the service
 * definition — this is the seam a real builder (nixpacks-style) would fill.
 */
export function simulateBuild(service: Service): BuildOutcome {
  const logs: string[] = [];
  logs.push(`$ build ${service.image}`);
  logs.push(`resolved base image ${service.image}`);

  if (!service.startCommand.trim()) {
    logs.push("ERROR: no start command configured for service");
    return { ok: false, errorCode: "MISSING_START_CMD", logs };
  }

  if (service.startCommand.includes("noport")) {
    logs.push("WARN: process does not bind a TCP port");
    return { ok: false, errorCode: "PORT_NOT_LISTENING", logs };
  }

  if (service.environment["FORCE_OOM"] === "1") {
    logs.push("kernel: oom-kill: memory limit exceeded");
    return { ok: false, errorCode: "OOMKilled", logs };
  }

  const missing = Object.entries(service.environment)
    .filter(([, v]) => v === "")
    .map(([k]) => k);
  if (missing.length > 0 && service.startCommand.includes("require-env")) {
    logs.push(`ERROR: validation failed, empty env: ${missing.join(", ")}`);
    return { ok: false, errorCode: "MISSING_ENV", logs };
  }

  logs.push(`starting: ${service.startCommand}`);
  logs.push(`listening on 0.0.0.0:${service.port}`);
  logs.push("healthcheck ok (200)");
  return { ok: true, errorCode: null, logs };
}

export function createDeployment(store: Store, service: Service): Deployment {
  const id = `${service.id}_d${store.deployments.size + 1}`;
  const deployment: Deployment = {
    id,
    serviceId: service.id,
    projectId: service.projectId,
    status: "QUEUED",
    replica: 1,
    logs: [],
    errorCode: null,
    startedAt: now(),
    finishedAt: null,
  };
  store.deployments.set(id, deployment);
  return deployment;
}

/** Advance a deployment synchronously through the happy path. */
export function runDeployment(deployment: Deployment, service: Service): Deployment {
  transition(deployment, "BUILDING");
  const build = simulateBuild(service);
  deployment.logs.push(...build.logs);
  if (!build.ok) {
    deployment.errorCode = build.errorCode;
    transition(deployment, "FAILED");
    return deployment;
  }
  transition(deployment, "DEPLOYING");
  if (service.environment["HEALTHCHECK_FAILS"] === "1") {
    deployment.logs.push("healthcheck failed after 30s: 500 responded");
    deployment.errorCode = "HEALTH_CHECK_FAILED";
    transition(deployment, "FAILED");
    return deployment;
  }
  transition(deployment, "RUNNING");
  return deployment;
}

/** Spin a deployment down: RUNNING -> STOPPED -> TERMINATED. */
export function downDeployment(deployment: Deployment): Deployment {
  if (deployment.status === "RUNNING") {
    transition(deployment, "STOPPED");
  }
  transition(deployment, "TERMINATED");
  deployment.logs.push("container stopped; resources released");
  return deployment;
}

/** Most recent deployment for a service, if any. */
export function latestForService(store: Store, serviceId: string): Deployment | null {
  let latest: Deployment | null = null;
  for (const d of store.deployments.values()) {
    if (d.serviceId === serviceId && (!latest || d.startedAt >= latest.startedAt)) {
      latest = d;
    }
  }
  return latest;
}
