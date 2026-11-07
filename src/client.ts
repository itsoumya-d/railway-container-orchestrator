// Typed GraphQL client + CLI. Talks to POST /graphql exactly the way a
// Railway CLI talks to their GraphQL endpoint.

import { GraphQLResponse } from "./graphql.js";

export interface ClientOptions {
  baseUrl: string;
  token?: string;
}

export class OrchestratorClient {
  constructor(private opts: ClientOptions) {}

  private async request<T>(operation: string, variables: Record<string, unknown> = {}): Promise<T> {
    const res = await fetch(`${this.opts.baseUrl}/graphql`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.opts.token ? { authorization: `Bearer ${this.opts.token}` } : {}),
      },
      body: JSON.stringify({ operation, variables }),
    });
    const payload = (await res.json()) as GraphQLResponse;
    if (payload.errors?.length) {
      throw new Error(payload.errors.map((e) => `${e.code}: ${e.message}`).join("; "));
    }
    const key = operation;
    return (payload.data?.[key] as T) ?? (Object.values(payload.data ?? {})[0] as T);
  }

  projects(): Promise<unknown[]> {
    return this.request("projects");
  }
  projectCreate(name: string): Promise<unknown> {
    return this.request("projectCreate", { name });
  }
  projectDelete(id: string): Promise<unknown> {
    return this.request("projectDelete", { id });
  }
  serviceCreate(projectId: string, input: Record<string, unknown>): Promise<unknown> {
    return this.request("serviceCreate", { projectId, input });
  }
  services(projectId: string): Promise<unknown[]> {
    return this.request("services", { projectId });
  }
  deploymentCreate(serviceId: string): Promise<unknown> {
    return this.request("deploymentCreate", { serviceId });
  }
  deploymentDown(serviceId: string): Promise<unknown> {
    return this.request("deploymentDown", { serviceId });
  }
  deploymentCancel(id: string): Promise<unknown> {
    return this.request("deploymentCancel", { id });
  }
  deploymentDoctor(serviceId: string): Promise<unknown> {
    return this.request("deploymentDoctor", { serviceId });
  }
}

function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const [command, ...rest] = argv;
  const baseUrl = process.env.RAILWAY_API_URL ?? "http://127.0.0.1:4000";
  const token = process.env.RAILWAY_TOKEN;
  const client = new OrchestratorClient({ baseUrl, token });

  switch (command) {
    case "projects":
      print(await client.projects());
      break;
    case "project:create": {
      const name = rest[0];
      if (!name) throw new Error("usage: project:create <name>");
      print(await client.projectCreate(name));
      break;
    }
    case "project:delete": {
      const id = rest[0];
      if (!id) throw new Error("usage: project:delete <id>");
      print(await client.projectDelete(id));
      break;
    }
    case "service:create": {
      const projectId = rest[0];
      const image = rest[1];
      if (!projectId || !image) throw new Error("usage: service:create <projectId> <image> [name]");
      print(
        await client.serviceCreate(projectId, {
          name: rest[2] ?? "web",
          image,
          startCommand: rest[3] ?? "node dist/server.js",
        }),
      );
      break;
    }
    case "up": {
      const serviceId = rest[0];
      if (!serviceId) throw new Error("usage: up <serviceId>");
      print(await client.deploymentCreate(serviceId));
      break;
    }
    case "down": {
      const serviceId = rest[0];
      if (!serviceId) throw new Error("usage: down <serviceId>");
      print(await client.deploymentDown(serviceId));
      break;
    }
    case "doctor": {
      const serviceId = rest[0];
      if (!serviceId) throw new Error("usage: doctor <serviceId>");
      print(await client.deploymentDoctor(serviceId));
      break;
    }
    default:
      console.log(
        [
          "railway-container-orchestrator CLI",
          "",
          "  projects                      list projects",
          "  project:create <name>         create a project",
          "  project:delete <id>           delete a project and everything under it",
          "  service:create <projectId> <image> [name] [start.Command]",
          "  up <serviceId>                spin a container up",
          "  down <serviceId>              spin a container down",
          "  doctor <serviceId>            diagnose the latest failed deployment",
          "",
          "env: RAILWAY_API_URL (default http://127.0.0.1:4000), RAILWAY_TOKEN",
        ].join("\n"),
      );
      break;
  }
}

const invokedDirectly = process.argv[1]?.endsWith("client.js") || process.argv[1]?.endsWith("cli.js");
if (invokedDirectly) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
