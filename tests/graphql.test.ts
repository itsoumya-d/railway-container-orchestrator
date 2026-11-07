import { describe, expect, it } from "vitest";
import { createStore } from "../src/store.js";
import { execute } from "../src/graphql.js";

function ctx() {
  return createStore();
}

describe("graphql operations", () => {
  it("rejects missing and unknown operations", () => {
    const store = ctx();
    expect(execute(store, null).errors?.[0].code).toBe("BAD_REQUEST");
    expect(execute(store, { operation: "nope" }).errors?.[0].code).toBe("UNKNOWN_OPERATION");
  });

  it("creates and lists projects", () => {
    const store = ctx();
    const created = execute(store, { operation: "projectCreate", variables: { name: "demo" } });
    expect(created.errors).toBeUndefined();
    const projects = execute(store, { operation: "projects" }).data?.projects as unknown[];
    expect(projects).toHaveLength(1);
  });

  it("requires a project name", () => {
    const store = ctx();
    expect(
      execute(store, { operation: "projectCreate", variables: { name: "  " } }).errors?.[0].code,
    ).toBe("BAD_REQUEST");
  });

  it("returns NOT_FOUND for unknown projects", () => {
    const store = ctx();
    expect(execute(store, { operation: "project", variables: { id: "prj_x" } }).errors?.[0].code).toBe(
      "NOT_FOUND",
    );
  });

  it("creates services and validates the project", () => {
    const store = ctx();
    const p = execute(store, { operation: "projectCreate", variables: { name: "demo" } }).data
      ?.projectCreate as { id: string };
    expect(
      execute(store, {
        operation: "serviceCreate",
        variables: { projectId: "prj_missing", input: { name: "web", image: "node:22" } },
      }).errors?.[0].code,
    ).toBe("NOT_FOUND");
    const bad = execute(store, {
      operation: "serviceCreate",
      variables: { projectId: p.id, input: { name: "web" } },
    });
    expect(bad.errors?.[0].code).toBe("BAD_REQUEST");
    const svc = execute(store, {
      operation: "serviceCreate",
      variables: { projectId: p.id, input: { name: "web", image: "node:22-alpine" } },
    }).data?.serviceCreate as { id: string; port: number };
    expect(svc.port).toBe(3000);
  });

  it("deploys a healthy service to RUNNING through the API", () => {
    const store = ctx();
    const p = execute(store, { operation: "projectCreate", variables: { name: "demo" } }).data
      ?.projectCreate as { id: string };
    const svc = execute(store, {
      operation: "serviceCreate",
      variables: { projectId: p.id, input: { name: "web", image: "node:22-alpine" } },
    }).data?.serviceCreate as { id: string };
    const dep = execute(store, { operation: "deploymentCreate", variables: { serviceId: svc.id } })
      .data?.deploymentCreate as { status: string };
    expect(dep.status).toBe("RUNNING");
  });

  it("deletes a project with its services and deployments", () => {
    const store = ctx();
    const p = execute(store, { operation: "projectCreate", variables: { name: "demo" } }).data
      ?.projectCreate as { id: string };
    const svc = execute(store, {
      operation: "serviceCreate",
      variables: { projectId: p.id, input: { name: "web", image: "node:22-alpine" } },
    }).data?.serviceCreate as { id: string };
    execute(store, { operation: "deploymentCreate", variables: { serviceId: svc.id } });
    const del = execute(store, { operation: "projectDelete", variables: { id: p.id } });
    expect(del.data?.projectDelete).toEqual({ id: p.id, deleted: true });
    expect(store.projects.size).toBe(0);
    expect(store.services.size).toBe(0);
    expect(store.deployments.size).toBe(0);
  });

  it("diagnoses failed deployments through the API", () => {
    const store = ctx();
    const p = execute(store, { operation: "projectCreate", variables: { name: "demo" } }).data
      ?.projectCreate as { id: string };
    const svc = execute(store, {
      operation: "serviceCreate",
      variables: {
        projectId: p.id,
        input: { name: "web", image: "node:22-alpine", startCommand: "" },
      },
    }).data?.serviceCreate as { id: string };
    execute(store, { operation: "deploymentCreate", variables: { serviceId: svc.id } });
    const dx = execute(store, { operation: "deploymentDoctor", variables: { serviceId: svc.id } })
      .data?.deploymentDoctor as { failureClass: string };
    expect(dx.failureClass).toBe("MISSING_START_CMD");
  });

  it("returns NOT_FOUND when diagnosing a service without deployments", () => {
    const store = ctx();
    const p = execute(store, { operation: "projectCreate", variables: { name: "demo" } }).data
      ?.projectCreate as { id: string };
    const svc = execute(store, {
      operation: "serviceCreate",
      variables: { projectId: p.id, input: { name: "web", image: "node:22-alpine" } },
    }).data?.serviceCreate as { id: string };
    expect(
      execute(store, { operation: "deploymentDoctor", variables: { serviceId: svc.id } }).errors?.[0]
        .code,
    ).toBe("NOT_FOUND");
  });

  it("cancels deployments, including running ones", () => {
    const store = ctx();
    const p = execute(store, { operation: "projectCreate", variables: { name: "demo" } }).data
      ?.projectCreate as { id: string };
    const svc = execute(store, {
      operation: "serviceCreate",
      variables: { projectId: p.id, input: { name: "web", image: "node:22-alpine" } },
    }).data?.serviceCreate as { id: string };
    const dep = execute(store, { operation: "deploymentCreate", variables: { serviceId: svc.id } })
      .data?.deploymentCreate as { id: string; status: string };
    expect(dep.status).toBe("RUNNING");
    const cancelled = execute(store, { operation: "deploymentCancel", variables: { id: dep.id } })
      .data?.deploymentCancel as { status: string };
    expect(cancelled.status).toBe("TERMINATED");
  });

  it("spins deployments down", () => {
    const store = ctx();
    const p = execute(store, { operation: "projectCreate", variables: { name: "demo" } }).data
      ?.projectCreate as { id: string };
    const svc = execute(store, {
      operation: "serviceCreate",
      variables: { projectId: p.id, input: { name: "web", image: "node:22-alpine" } },
    }).data?.serviceCreate as { id: string };
    execute(store, { operation: "deploymentCreate", variables: { serviceId: svc.id } });
    const down = execute(store, { operation: "deploymentDown", variables: { serviceId: svc.id } })
      .data?.deploymentDown as { status: string };
    expect(down.status).toBe("TERMINATED");
  });
});
