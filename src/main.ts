import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";

import { healthController } from "./controllers/health.controller";
import { conversationController } from "./controllers/conversation.controller";

/**
 * Main application assembly (like app.js / main.ts in Node.js).
 *
 * CONVENTION — every API lives in a controller under src/controllers/:
 *   - public endpoints   → plain Elysia instance (health)
 *   - protected endpoints → wrapped with authInterceptor (future)
 * Each controller uses ONE prefix, documents every route with Swagger
 * `detail` (tags + summary), and delegates logic to src/services/.
 */
export const app = new Elysia()
  .use(
    swagger({
      path: "/swagger",
      // Use the classic Swagger UI (like typical Node.js projects)
      // instead of the default Scalar UI.
      provider: "swagger-ui",
      documentation: {
        info: {
          title: "Messaging Service",
          version: "1.0.0",
          description:
            "API documentation for the Messaging Service. Swagger UI is available at /swagger and the OpenAPI JSON spec at /swagger/json.",
        },
        tags: [
          {
            name: "Health",
            description: "Service health checks",
          },
          {
            name: "Conversation",
            description: "Conversation / messaging endpoints (Bearer token required)",
          },
        ],
        // Make Swagger UI's "Try it out" go through the APISIX gateway
        // (the service only trusts APISIX-injected X-Userinfo, not raw JWTs).
        servers: [
          {
            url: "http://localhost:9080/messaging",
            description: "APISIX Gateway (register as an upstream when ready)",
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
              description:
                "Keycloak access token. Click the Authorize (lock) button and paste your Bearer token.",
            },
          },
        },
      },
    })
  )
  .get("/", () => ({
    message: "Messaging Service is running 🚀",
    docs: "/swagger",
    openapi: "/swagger/json",
  }))
  .use(healthController) // public
  .use(conversationController) // protected (openid-connect + interceptor)
  .onError(({ code, set, error }) => {
    // Keep framework validation failures as HTTP 400 (Nest-style) instead of
    // Elysia's default 422 so Swagger Try-it-out behaves like the source API.
    if (code === "VALIDATION") {
      const err = error as { summary?: string; message?: string };
      const reason = err?.summary ?? err?.message ?? "Bad Request";
      set.status = 400;
      return {
        statusCode: 400,
        message: [reason],
        error: "Bad Request",
      };
    }
  });

export type App = typeof app;
