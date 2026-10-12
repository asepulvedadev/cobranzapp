import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContactDeliveryError } from "./resend.js";
import { registerContactRoutes } from "./routes.js";

const valid = {
  name: "María Pérez",
  phone: "+57 300 000 0000",
  source: "planes",
  plan: "Pro",
  website: "",
  requestId: "12109052-962d-41c5-bb57-92dfe39a7c7b",
};
const applications: ReturnType<typeof Fastify>[] = [];
function fixture(available = true) {
  const app = Fastify({ trustProxy: true });
  const send = vi.fn(async () => "email-id");
  registerContactRoutes(app, {
    allowedOrigins: ["https://cobranzaap.tech"],
    mailer: available ? { send } : undefined,
  });
  applications.push(app);
  return {
    app,
    send,
    post: (payload: unknown = valid, origin = "https://cobranzaap.tech", extraHeaders = {}) =>
      app.inject({
        method: "POST",
        url: "/v1/contact",
        headers: { origin, ...extraHeaders },
        payload,
      }),
  };
}
afterEach(async () => {
  await Promise.all(applications.splice(0).map((app) => app.close()));
  vi.restoreAllMocks();
});

describe("public contact endpoint", () => {
  it("accepts a normalized phone without login and hides recipients from the response", async () => {
    const { post, send } = fixture();
    const response = await post();
    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ accepted: true, id: "email-id" });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "+573000000000", plan: "Pro" }),
    );
    expect(response.headers["cache-control"]).toBe("no-store");
  });
  it.each([
    { name: "A" },
    { name: "Name\r\nInjected" },
    { phone: "123" },
    { website: "spam" },
    { to: "attacker@example.com" },
    { plan: "Unknown" },
    { source: "spam" },
    { requestId: "bad" },
  ])("rejects invalid data or recipient overrides %j", async (override) => {
    const { post, send } = fixture();
    expect((await post({ ...valid, ...override })).statusCode).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });
  it("rejects foreign and missing origins", async () => {
    const { post, send } = fixture();
    expect((await post(valid, "https://evil.example")).statusCode).toBe(403);
    expect((await post(valid, "")).statusCode).toBe(403);
    expect(send).not.toHaveBeenCalled();
  });
  it("limits body size and rejects malformed JSON without global error logging", async () => {
    const { app, post } = fixture();
    expect((await post({ ...valid, name: "x".repeat(3000) })).statusCode).toBe(413);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/contact",
          headers: { origin: "https://cobranzaap.tech", "content-type": "application/json" },
          payload: "{bad",
        })
      ).statusCode,
    ).toBe(400);
  });
  it("does not claim success when missing configuration, delivery fails or key conflicts", async () => {
    expect((await fixture(false).post()).statusCode).toBe(503);
    const { post, send } = fixture();
    send.mockRejectedValueOnce(new ContactDeliveryError());
    expect((await post()).statusCode).toBe(503);
    send.mockRejectedValueOnce(new ContactDeliveryError(true));
    expect((await post()).statusCode).toBe(409);
  });
  it("blocks a burst before sending more than two provider requests", async () => {
    const { post, send } = fixture();
    await post();
    await post();
    const response = await post();
    expect(response.statusCode).toBe(429);
    expect(send).toHaveBeenCalledTimes(2);
  });
  it("uses the nearest nginx-forwarded address, not forged leading addresses", async () => {
    const { post, send } = fixture(false);
    for (let index = 0; index < 5; index++)
      await post(valid, undefined, { "x-forwarded-for": `198.51.100.${index}, 203.0.113.7` });
    expect(
      (await post(valid, undefined, { "x-forwarded-for": "198.51.100.99, 203.0.113.7" }))
        .statusCode,
    ).toBe(429);
    expect(send).not.toHaveBeenCalled();
  });
});
