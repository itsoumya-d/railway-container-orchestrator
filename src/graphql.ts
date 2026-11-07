// GraphQL-shaped API over the store and engine.
//
// The wire is intentionally small: one POST /graphql endpoint, query and
// mutation names that mirror Railway's public GraphQL schema (projectCreate,
// serviceCreate, deploymentCreate, deploymentCancel, deletion mutations) so a
// real client can be pointed at either backend with a one-line URL change.

import { createDeployment, downDeployment, latestForService, runDeployment, transition } from "./engine.js";
import { diagnose } from "./doctor.js";
import { Store, mintId, now } from "./store.js";

export interface ServiceInput {
  name: string;
  image: string;
  startCommand: string;
  port?: number;
  environment?: Record<string, string>;
}

export interface GraphQLError {
  message: string;
  code: string;
}

export interface GraphQLResponse {
  data?: Record<string, unknown>;
  errors?: GraphQLError[];
}

function err(message: string, code: string): GraphQLResponse {
  return { errors: [{ message, code }] };
}

export function execute(store: Store, query: unknown): GraphQLResponse {
  const op = (query as { operation?: string; variables?: Record<string, unknown> } | null);
  if (!op || typeof op.operation !== "string") {
    return err("missing operation", "BAD_REQUEST");
  }
  const vars = op.variables ?? {};
  switch (op.operation) {
    case "projects": {
      return { data: { projects: [...store.projects.values()] } };
    }
    case "project": {
      const p = store.projects.get(String(vars.id ?? ""));
      return p ? { data: { project: p } } : err("project not found", "NOT_FOUND");
    }
    case "projectCreate": {
      const name = String(vars.name ?? "").trim();
      if (!name) return err("name is required", "BAD_REQUEST");
      const project = { id: mintId(store, "prj"), name, createdAt: now() };
      store.projects.set(project.id, project);
      return { data: { projectCreate: project } };
    }
    case "projectDelete": {
      const id = String(vars.id ?? "");
      if (!store.projects.has(id)) return err("project not found", "NOT_FOUND");
      store.projects.delete(id);
      for (const [sid, svc] of store.services) {
        if (svc.projectId === id) store.services.delete(sid);
      }
      for (const [did, dep] of store.deployments) {
        if (dep.projectId === id) store.deployments.delete(did);
      }
      return { data: { projectDelete: { id, deleted: true } } };
    }
    case "serviceCreate": {
      const input = vars.input as ServiceInput | undefined;
      if (!input?.name || !input?.image) return err("input.name and input.image are required", "BAD_REQUEST");
      const projectId = String(vars.projectId ?? "");
      if (!store.projects.has(projectId)) return err("project not found", "NOT_FOUND");
      const service = {
        id: mintId(store, "svc"),
        projectId,
        name: input.name,
        image: input.image,
        startCommand: input.startCommand ?? "node dist/server.js",
        port: input.port ?? 3000,
        environment: input.environment ?? {},
        createdAt: now(),
      };
      store.services.set(service.id, service);
      return { data: { serviceCreate: service } };
    }
    case "services": {
      const projectId = String(vars.projectId ?? "");
      return {
        data: {
          services: [...store.services.values()].filter((s) => s.projectId === projectId),
        },
      };
    }
    case "deploymentCreate": {
      const serviceId = String(vars.serviceId ?? "");
      const service = store.services.get(serviceId);
      if (!service) return err("service not found", "NOT_FOUND");
      const deployment = runDeployment(createDeployment(store, service), service);
      return { data: { deploymentCreate: deployment } };
    }
    case "deploymentDoctor": {
      const serviceId = String(vars.serviceId ?? "");
      const deployment = latestForService(store, serviceId);
      if (!deployment) return err("no deployments for service", "NOT_FOUND");
      return { data: { deploymentDoctor: diagnose(deployment) } };
    }
    case "deploymentCancel": {
      const id = String(vars.id ?? "");
      const deployment = store.deployments.get(id);
      if (!deployment) return err("deployment not found", "NOT_FOUND");
      if (deployment.status === "TERMINATED") return err("deployment already terminated", "BAD_STATE");
      if (deployment.status === "RUNNING") transition(deployment, "STOPPED");
      if (deployment.status === "STOPPED" || deployment.status === "QUEUED") {
        transition(deployment, "TERMINATED");
      } else if (deployment.status === "FAILED") {
        transition(deployment, "TERMINATED");
      } else {
        return err(`cannot cancel deployment in state ${deployment.status}`, "BAD_STATE");
      }
      deployment.logs.push("cancelled by operator");
      return { data: { deploymentCancel: deployment } };
    }
    case "deploymentDown": {
      const serviceId = String(vars.serviceId ?? "");
      const deployment = latestForService(store, serviceId);
      if (!deployment) return err("no deployments for service", "NOT_FOUND");
      downDeployment(deployment);
      return { data: { deploymentDown: deployment } };
    }
    default:
      return err(`unknown operation ${op.operation}`, "UNKNOWN_OPERATION");
  }
}
