// Fastify server: POST /graphql + a tiny static dashboard UI.

import Fastify from "fastify";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "./store.js";
import { execute } from "./graphql.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function buildApp() {
  const app = Fastify();
  const store = createStore();

  app.get("/health", async () => ({ ok: true }));

  app.post("/graphql", async (req) => {
    return execute(store, req.body);
  });

  app.get("/", async (_req, reply) => {
    const htmlPath = join(root, "ui", "index.html");
    if (existsSync(htmlPath)) {
      return reply.type("text/html").send(readFileSync(htmlPath, "utf8"));
    }
    return reply.type("text/html").send("<html><body>railway-container-orchestrator</body></html>");
  });

  return app;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT ?? "4000");
  buildApp().listen({ port, host: "0.0.0.0" }).then(() => {
    console.log(`railway-container-orchestrator listening on :${port}`);
  });
}
