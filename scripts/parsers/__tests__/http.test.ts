import { describe, expect, it, vi } from "vitest";
import { PoliteHttpClient } from "../http";

describe("PoliteHttpClient", () => {
  it("caches duplicate URL requests during a run", async () => {
    const fetchImpl = vi.fn(async () => new Response("hello", { status: 200 }));
    const client = new PoliteHttpClient({
      userAgent: "test-agent",
      minDelayMs: 0,
      maxDelayMs: 0,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const [first, second] = await Promise.all([
      client.get("https://example.com/reports"),
      client.get("https://example.com/reports"),
    ]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(first.text).toBe("hello");
    expect(second.text).toBe("hello");
  });

  it("limits same-domain concurrency to one in flight", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const fetchImpl = vi.fn(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 10));
      inFlight -= 1;
      return new Response("ok", { status: 200 });
    });

    const client = new PoliteHttpClient({
      userAgent: "test-agent",
      minDelayMs: 0,
      maxDelayMs: 0,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await Promise.all([
      client.get("https://example.com/a"),
      client.get("https://example.com/b"),
      client.get("https://example.com/c"),
    ]);

    expect(maxInFlight).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
