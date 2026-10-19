import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

describe("web health release", () => {
  const originalVersion = process.env.APP_VERSION;

  afterEach(() => {
    if (originalVersion === undefined) delete process.env.APP_VERSION;
    else process.env.APP_VERSION = originalVersion;
  });

  it("publishes the runtime release without allowing caches", async () => {
    process.env.APP_VERSION = "release-test";
    const response = GET();

    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toMatchObject({
      service: "web",
      status: "ok",
      version: "release-test",
    });
  });
});
