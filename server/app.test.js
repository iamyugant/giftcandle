import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { MemoryFragranceRepository } from "./repository.js";

describe("GET /api/health", () => {
  it("returns ok", async () => {
    const app = createApp({ repo: new MemoryFragranceRepository(), signingSecret: "s" });

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
