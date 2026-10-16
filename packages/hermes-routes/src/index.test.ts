import { afterEach, describe, expect, it, vi } from "vitest";
import { createHermesCollectionRoutePlanner, orderByNearestNeighbor } from "./index.js";

const stops = [
  { id: "10000000-0000-4000-8000-000000000001", latitude: 4.61, longitude: -74.08 },
  { id: "10000000-0000-4000-8000-000000000002", latitude: 4.62, longitude: -74.09 },
  { id: "10000000-0000-4000-8000-000000000003", latitude: null, longitude: null },
];

afterEach(() => vi.restoreAllMocks());

describe("collection route planner", () => {
  it("orders located stops first and keeps unlocated stops at the end", () => {
    const order = orderByNearestNeighbor(stops);
    expect(new Set(order)).toEqual(new Set(stops.map((stop) => stop.id)));
    expect(order.at(-1)).toBe(stops[2]?.id);
  });

  it("accepts a complete structured agent order", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  orderedStopIds: [stops[1]?.id, stops[0]?.id, stops[2]?.id],
                }),
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const planner = createHermesCollectionRoutePlanner({
      apiKey: "secret",
      endpoint: "http://routes.test/v1/chat/completions",
    });
    await expect(planner.plan(stops)).resolves.toEqual([stops[1]?.id, stops[0]?.id, stops[2]?.id]);
  });

  it("rejects missing, duplicated, or invented stop IDs", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ orderedStopIds: [stops[0]?.id] }) } }],
        }),
        { status: 200 },
      ),
    );
    const planner = createHermesCollectionRoutePlanner({
      apiKey: "secret",
      endpoint: "http://routes.test/v1/chat/completions",
    });
    await expect(planner.plan(stops)).rejects.toThrow("HERMES_ROUTES_INVALID_RESPONSE");
  });
});
