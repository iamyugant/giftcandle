import { AppError } from "./errors.js";

const API_ENDPOINT = "https://api.monday.com/v2";

const API_VERSION = "2026-10";

const MAX_IN_FLIGHT = 5;

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 250;

class RateLimited extends Error {}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createMondayClient({ fetchImpl = fetch, sleep = wait, random = Math.random } = {}) {
  let inFlight = 0;
  const waiting = [];

  const withSlot = async (task) => {
    if (inFlight < MAX_IN_FLIGHT) {
      inFlight++;
    } else {
      await new Promise((resolve) => waiting.push(resolve));
    }

    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else inFlight--;
    }
  };

  const post = async (token, query, variables) => {
    const res = await fetchImpl(API_ENDPOINT, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json", "API-Version": API_VERSION },
      body: JSON.stringify({ query, variables }),
    });

    if (res.status === 429) throw new RateLimited();

    const body = await res.json().catch(() => null);
    if (!res.ok || !body || body.errors || !body.data) {
      console.error("monday API error", res.status, JSON.stringify(body?.errors ?? body));
      throw new AppError(502, "MONDAY_ERROR", "monday did not accept the request. Nothing was saved.");
    }

    return body.data;
  };

  const withRetry = async (token, query, variables) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await withSlot(() => post(token, query, variables));
      } catch (err) {
        if (!(err instanceof RateLimited)) throw err;

        if (attempt + 1 >= MAX_ATTEMPTS) {
          throw new AppError(503, "MONDAY_BUSY", "monday is busy. Wait a moment and try again.");
        }

        await sleep(BASE_DELAY_MS * 2 ** attempt * (0.5 + random()));
      }
    }
  };

  return {
    async query(token, query, variables = {}) {
      return await withRetry(token, query, variables);
    },
  };
}
