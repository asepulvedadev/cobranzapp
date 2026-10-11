import type { ServiceStatus } from "@cobranzapp/contracts";
import Fastify from "fastify";

export interface AppDependencies {
  checkDatabase: () => Promise<void>;
  version: string;
}

export function buildApp(dependencies: AppDependencies) {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
    trustProxy: true,
    requestIdHeader: "x-request-id",
  });

  app.get(
    "/health",
    async (): Promise<ServiceStatus> => ({
      service: "api",
      status: "ok",
      version: dependencies.version,
      timestamp: new Date().toISOString(),
    }),
  );

  app.get("/ready", async (_request, reply): Promise<ServiceStatus> => {
    try {
      await dependencies.checkDatabase();
      return {
        service: "api",
        status: "ok",
        version: dependencies.version,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      app.log.error({ err: error }, "Database readiness check failed");
      reply.code(503);
      return {
        service: "api",
        status: "degraded",
        version: dependencies.version,
        timestamp: new Date().toISOString(),
      };
    }
  });

  app.get(
    "/v1/status",
    async (): Promise<ServiceStatus> => ({
      service: "cobranzapp",
      status: "ok",
      version: dependencies.version,
      timestamp: new Date().toISOString(),
    }),
  );

  return app;
}
