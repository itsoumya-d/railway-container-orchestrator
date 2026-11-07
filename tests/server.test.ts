import { describe, expect, it, afterEach } from "vitest";
import { buildApp } from "../src/server.js";
import { OrchestratorClient } from "../src/client.js";

describe("server", () => {
  it("serves health, the dashboard UI and GraphQL", async () => {
    const app = buildApp();

    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);

    const ui = await app.inject({ method: "GET", url: "/" });
    expect(ui.statusCode).toBe(200);
    expect(ui.body).toContain("railway-container-orchestrator");

    const gql = await app.inject({
      method: "POST",
      url: "/graphql",
      payload: { operation: "projects" },
    });
    expect(gql.statusCode).toBe(200);
  });

  it("exposes the typed client against a real listener", async () => {
    const app = buildApp();
    const address = await app.listen({ port: 0, host: "127.0.0.1" });
      const client = new OrchestratorClient({ baseUrl: address });
    try {
      const project = (await client.projectCreate("demo")) as { id: string };
      const service = (await client.serviceCreate(project.id, {
        name: "web",
        image: "node:22-alpine",
      })) as { id: string };
      const deployment = (await client.deploymentCreate(service.id)) as { status: string };
      expect(deployment.status).toBe("RUNNING");
      const diagnosis = (await client.deploymentDoctor(service.id)) as { fix: string };
      expect(diagnosis.fix).toContain("Nothing to fix");
      const down = (await client.deploymentDown(service.id)) as { status: string };
      expect(down.status).toBe("TERMINATED");
    } finally {
      await app.close();
    }
  });
});
