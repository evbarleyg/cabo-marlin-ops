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

  it("returns a timeout failure when a request hangs", async () => {
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>(() => {
          // Never resolve to simulate an upstream hang.
        }),
    );
    const client = new PoliteHttpClient({
      userAgent: "test-agent",
      minDelayMs: 0,
      maxDelayMs: 0,
      requestTimeoutMs: 10,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await client.get("https://example.com/hanging");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.error).toContain("Timeout after 10ms");
  });

  it("uses fallback fetch when native fetch fails", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("fetch failed");
    });
    const fallbackGet = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: '{"items":[]}',
      fetchedAt: new Date().toISOString(),
    }));
    const client = new PoliteHttpClient({
      userAgent: "test-agent",
      minDelayMs: 0,
      maxDelayMs: 0,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      fallbackGet,
    });

    const result = await client.get("https://example.com/fallback");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fallbackGet).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.text).toContain("items");
  });
});
