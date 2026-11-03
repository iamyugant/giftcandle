import { describe, expect, it } from "vitest";
import { createMondayClient } from "./monday.js";

const okResponse = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const rateLimitedResponse = () => ({ ok: false, status: 429, json: async () => ({}) });

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("calling monday", () => {
  it("sends the token and the pinned API version, and returns the data", async () => {
    const seenInits = [];
    const client = createMondayClient({
      fetchImpl: async (_url, init) => {
        seenInits.push(init);
        return okResponse({ hello: "world" });
      },
    });

    expect(await client.query("session-token", "{ me { id } }")).toEqual({ hello: "world" });

    const headers = seenInits[0].headers;
    expect(headers.Authorization).toBe("session-token");
    expect(headers["API-Version"]).toBe("2026-10");
  });

  it("turns a GraphQL error into a generic 502, without the detail", async () => {
    const client = createMondayClient({
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ errors: [{ message: "secret detail" }] }),
      }),
    });

    await expect(client.query("t", "q")).rejects.toMatchObject({ status: 502, code: "MONDAY_ERROR" });
  });

  it("turns an HTTP failure into a 502", async () => {
    const client = createMondayClient({
      fetchImpl: async () => ({ ok: false, status: 500, json: async () => null }),
    });

    await expect(client.query("t", "q")).rejects.toMatchObject({ status: 502 });
  });
});

describe("rate limiting (PDF §6.1)", () => {
  it("retries a 429 and then succeeds", async () => {
    let calls = 0;
    const client = createMondayClient({
      fetchImpl: async () => (++calls < 3 ? rateLimitedResponse() : okResponse({ done: true })),
      sleep: async () => undefined,
    });

    expect(await client.query("t", "q")).toEqual({ done: true });
    expect(calls).toBe(3);
  });

  it("backs off 250 ms, 500 ms, then 1 s, scaled by the jitter", async () => {
    const waits = [];
    const client = createMondayClient({
      fetchImpl: async () => rateLimitedResponse(),
      sleep: async (ms) => {
        waits.push(ms);
      },
      random: () => 0.5,
    });

    await expect(client.query("t", "q")).rejects.toMatchObject({ status: 503, code: "MONDAY_BUSY" });
    expect(waits).toEqual([250, 500, 1000]);
  });

  it("gives up after four attempts with a 503, not a crash", async () => {
    let calls = 0;
    const client = createMondayClient({
      fetchImpl: async () => {
        calls++;
        return rateLimitedResponse();
      },
      sleep: async () => undefined,
    });

    await expect(client.query("t", "q")).rejects.toMatchObject({ status: 503 });
    expect(calls).toBe(4);
  });

  it("keeps no more than five requests in flight, and drains the rest", async () => {
    let inFlight = 0;
    let peak = 0;
    const releases = [];
    const client = createMondayClient({
      fetchImpl: async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);

        await new Promise((resolve) => releases.push(resolve));
        inFlight--;
        return okResponse({ ok: true });
      },
    });

    const all = Array.from({ length: 12 }, () => client.query("t", "q"));

    for (let i = 0; i < 12; i++) {
      await flush();
      releases.shift()?.();
    }

    await Promise.all(all);
    expect(peak).toBe(5);
  });
});
