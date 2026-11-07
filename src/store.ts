// In-memory persistence for projects, services and deployments.
// A real Railway deployment would back this with Postgres; the records here
// intentionally mirror the GraphQL schema (ids, timestamps, status enums).

export type DeploymentStatus =
  | "QUEUED"
  | "BUILDING"
  | "DEPLOYING"
  | "RUNNING"
  | "FAILED"
  | "STOPPED"
  | "TERMINATED";

export interface Project {
  id: string;
  name: string;
  createdAt: string;
}

export interface Service {
  id: string;
  projectId: string;
  name: string;
  image: string;
  startCommand: string;
  port: number;
  environment: Record<string, string>;
  createdAt: string;
}

export interface Deployment {
  id: string;
  serviceId: string;
  projectId: string;
  status: DeploymentStatus;
  replica: number;
  logs: string[];
  errorCode: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface Store {
  projects: Map<string, Project>;
  services: Map<string, Service>;
  deployments: Map<string, Deployment>;
  seq: number;
}

export function createStore(): Store {
  return {
    projects: new Map(),
    services: new Map(),
    deployments: new Map(),
    seq: 0,
  };
}

export function mintId(store: Store, prefix: string): string {
  store.seq += 1;
  return `${prefix}_${store.seq.toString(36).padStart(4, "0")}`;
}

export function now(): string {
  return new Date().toISOString();
}
