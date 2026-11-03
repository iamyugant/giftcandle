import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import { MemoryFragranceRepository } from "./repository.js";

const SECRET = "edge-secret";

const signedToken = (options = {}, key = SECRET) => jwt.sign({ userId: 1 }, key, options);
const auth = { Authorization: `Bearer ${signedToken()}` };

const base = { name: "Herb Garden", description: "Fresh basil.", category: "Herbaceous" };

let app;

beforeEach(() => {
  app = createApp({ repo: new MemoryFragranceRepository(), signingSecret: SECRET });
});

afterEach(() => vi.restoreAllMocks());

const post = (body) => request(app).post("/api/fragrances").set(auth).send(body);

describe("authentication edge cases", () => {
  it.each([
    ["no header", {}],
    ["empty bearer", { Authorization: "Bearer " }],
  ])("rejects %s as missing, with 401", async (_name, headers) => {
    const res = await request(app).get("/api/fragrances").set(headers);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it.each([
    ["wrong scheme", { Authorization: "Basic abc123" }],
    ["garbage token", { Authorization: "Bearer not-a-jwt" }],
    ["token signed with another secret", { Authorization: `Bearer ${signedToken({}, "other")}` }],
    ["expired token", { Authorization: `Bearer ${signedToken({ expiresIn: -10 })}` }],
    [
      "unsigned (alg none) token",
      {
        Authorization: `Bearer ${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from('{"u":1}').toString("base64url")}.`,
      },
    ],
  ])("rejects %s as invalid, with 403", async (_name, headers) => {
    const res = await request(app).get("/api/fragrances").set(headers);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("INVALID_SESSION");
  });

  it("rejects a token whose payload was tampered with", async () => {
    const [header, , signature] = signedToken().split(".");
    const forged = `${header}.${Buffer.from('{"userId":999}').toString("base64url")}.${signature}`;

    const res = await request(app).get("/api/fragrances").set("Authorization", `Bearer ${forged}`);

    expect(res.status).toBe(403);
  });

  it("accepts a lower-case bearer scheme", async () => {
    const res = await request(app).get("/api/fragrances").set("Authorization", `bearer ${signedToken()}`);

    expect(res.status).toBe(200);
  });

  it("refuses everything when no secret is configured, even a token signed with an empty one", async () => {
    const open = createApp({ repo: new MemoryFragranceRepository(), signingSecret: "" });

    const res = await request(open).get("/api/fragrances").set("Authorization", `Bearer ${signedToken({}, "x")}`);

    expect(res.status).toBe(403);
  });

  it("protects every method, not only GET", async () => {
    expect((await request(app).post("/api/fragrances").send(base)).status).toBe(401);
    expect((await request(app).put("/api/fragrances/x").send(base)).status).toBe(401);
    expect((await request(app).delete("/api/fragrances/x")).status).toBe(401);
  });

  it("does not reveal why a token was refused", async () => {
    const malformed = await request(app).get("/api/fragrances").set("Authorization", "Bearer nope");
    const wrongKey = await request(app)
      .get("/api/fragrances")
      .set("Authorization", `Bearer ${signedToken({}, "other")}`);

    expect(malformed.body).toEqual(wrongKey.body);
  });
});

describe("request body edge cases", () => {
  it("returns 400 INVALID_JSON for malformed JSON", async () => {
    const res = await request(app)
      .post("/api/fragrances")
      .set(auth)
      .set("Content-Type", "application/json")
      .send("{bad");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });

  it("returns 400 for a JSON primitive or array instead of an object", async () => {
    const asString = await request(app)
      .post("/api/fragrances")
      .set(auth)
      .set("Content-Type", "application/json")
      .send('"hi"');
    expect(asString.status).toBe(400);

    const asArray = await post([]);
    expect(asArray.status).toBe(400);
    expect(asArray.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("returns 400 VALIDATION_FAILED for an empty body", async () => {
    const res = await request(app).post("/api/fragrances").set(auth);

    expect(res.status).toBe(400);
    expect(res.body.error.fields).toBeTruthy();
  });

  it("returns 413, not 500, for an oversized body", async () => {
    const res = await post({ ...base, description: "x".repeat(300_000) });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("strips unknown fields instead of storing them", async () => {
    const res = await post({ ...base, id: "hacked", created_at: "1999", isAdmin: true });

    expect(res.status).toBe(201);
    expect(res.body.id).not.toBe("hacked");
    expect(res.body.created_at).not.toBe("1999");
    expect(res.body).not.toHaveProperty("isAdmin");
  });
});

describe("field limits", () => {
  it("accepts a name of exactly 80 characters and rejects 81", async () => {
    expect((await post({ ...base, name: "n".repeat(80) })).status).toBe(201);

    const res = await post({ ...base, name: "m".repeat(81) });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.name).toMatch(/80/);
  });

  it("accepts a description of exactly 500 characters and rejects 501", async () => {
    expect((await post({ ...base, description: "d".repeat(500) })).status).toBe(201);
    expect((await post({ ...base, name: "Other", description: "d".repeat(501) })).status).toBe(400);
  });

  it("limits category to 50 characters", async () => {
    expect((await post({ ...base, category: "c".repeat(50) })).status).toBe(201);
    expect((await post({ ...base, name: "Other", category: "c".repeat(51) })).status).toBe(400);
  });

  it.each(["name", "description", "category"])("rejects a whitespace-only %s", async (field) => {
    const res = await post({ ...base, [field]: "   \t " });

    expect(res.status).toBe(400);
    expect(res.body.error.fields[field]).toBeTruthy();
  });

  it("trims leading and trailing spaces before storing", async () => {
    const res = await post({ ...base, name: "  Padded Name  " });

    expect(res.body.name).toBe("Padded Name");
  });

  it("rejects wrong types instead of coercing them", async () => {
    expect((await post({ ...base, name: 123 })).status).toBe(400);
    expect((await post({ ...base, category: ["a"] })).status).toBe(400);
    expect((await post({ ...base, description: null })).status).toBe(400);
  });

  it("stores unicode and HTML-looking text verbatim (the client escapes on render)", async () => {
    const name = `Zoë <b>"smoke"</b> & 李`;

    const res = await post({ ...base, name });

    expect(res.body.name).toBe(name);
  });

  it.each(["javascript:alert(1)", "ftp://x.test/a.png", "not a url", "//x.test/a.png", "data:text/html,<script>"])(
    "rejects image_url %j",
    async (image_url) => {
      expect((await post({ ...base, image_url })).status).toBe(400);
    },
  );

  it("accepts http and https image URLs and omits the field when absent", async () => {
    expect((await post({ ...base, image_url: "https://x.test/a.png" })).status).toBe(201);

    const res = await post({ ...base, name: "No Image" });
    expect(res.body).not.toHaveProperty("image_url");
  });

  it("rejects an empty-string image_url (the admin form omits blanks)", async () => {
    expect((await post({ ...base, image_url: "" })).status).toBe(400);
  });

  it("reports the first problem per field, with a field map", async () => {
    const res = await post({ name: "", description: "", category: "" });

    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(Object.keys(res.body.error.fields).sort()).toEqual(["category", "description", "name"]);
  });
});

describe("update edge cases", () => {
  it("returns 409 when renaming onto another scent, ignoring case", async () => {
    await post(base);
    const other = await post({ ...base, name: "Citrus Grove" });

    const res = await request(app).put(`/api/fragrances/${other.body.id}`).set(auth).send({ name: "HERB GARDEN" });

    expect(res.status).toBe(409);
  });

  it("allows changing only the case of a scent's own name", async () => {
    const created = await post(base);

    const res = await request(app)
      .put(`/api/fragrances/${created.body.id}`)
      .set(auth)
      .send({ name: "herb garden" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("herb garden");
  });

  it("allows saving a scent with its own unchanged name", async () => {
    const created = await post(base);

    const res = await request(app).put(`/api/fragrances/${created.body.id}`).set(auth).send(base);

    expect(res.status).toBe(200);
  });

  it("bumps updated_at but never created_at or id", async () => {
    const created = await post(base);
    await new Promise((resolve) => setTimeout(resolve, 5));

    const res = await request(app)
      .put(`/api/fragrances/${created.body.id}`)
      .set(auth)
      .send({ category: "Green" });

    expect(res.body.id).toBe(created.body.id);
    expect(res.body.created_at).toBe(created.body.created_at);
    expect(res.body.updated_at > created.body.updated_at).toBe(true);
  });

  it("ignores attempts to overwrite id or timestamps", async () => {
    const created = await post(base);

    const res = await request(app)
      .put(`/api/fragrances/${created.body.id}`)
      .set(auth)
      .send({ category: "Green", id: "x", created_at: "1999" });

    expect(res.body.id).toBe(created.body.id);
    expect(res.body.created_at).toBe(created.body.created_at);
  });

  it("returns 400 when only unknown fields are sent", async () => {
    const created = await post(base);

    const res = await request(app).put(`/api/fragrances/${created.body.id}`).set(auth).send({ foo: 1 });

    expect(res.status).toBe(400);
  });

  it("validates updated values with the same limits", async () => {
    const created = await post(base);

    const res = await request(app)
      .put(`/api/fragrances/${created.body.id}`)
      .set(auth)
      .send({ name: "x".repeat(81) });

    expect(res.status).toBe(400);
  });
});

describe("delete edge cases", () => {
  it("returns 204 once, then 404 for the same id", async () => {
    const created = await post(base);

    expect((await request(app).delete(`/api/fragrances/${created.body.id}`).set(auth)).status).toBe(204);
    expect((await request(app).delete(`/api/fragrances/${created.body.id}`).set(auth)).status).toBe(404);
  });

  it("allows reusing a deleted scent's name", async () => {
    const created = await post(base);
    await request(app).delete(`/api/fragrances/${created.body.id}`).set(auth);

    expect((await post(base)).status).toBe(201);
  });

  it("handles ids with odd characters without crashing", async () => {
    const res = await request(app).delete("/api/fragrances/..%2F..%2Fetc").set(auth);

    expect(res.status).toBe(404);
  });
});

describe("list and search edge cases", () => {
  beforeEach(async () => {
    await post(base);
    await post({ name: "Citrus Grove", description: "Orange zest and basil.", category: "Citrus" });
  });

  const names = (res) => res.body.map((f) => f.name);

  it("is sorted by name", async () => {
    expect(names(await request(app).get("/api/fragrances").set(auth))).toEqual(["Citrus Grove", "Herb Garden"]);
  });

  it("searches names and scent notes, ignoring case", async () => {
    expect(names(await request(app).get("/api/fragrances?q=BASIL").set(auth))).toEqual([
      "Citrus Grove",
      "Herb Garden",
    ]);
    expect(names(await request(app).get("/api/fragrances?q=orange").set(auth))).toEqual(["Citrus Grove"]);
  });

  it("combines search and category", async () => {
    expect(names(await request(app).get("/api/fragrances?q=basil&category=herbaceous").set(auth))).toEqual([
      "Herb Garden",
    ]);
  });

  it("ignores a blank or repeated query instead of failing", async () => {
    expect(names(await request(app).get("/api/fragrances?q=%20%20").set(auth))).toHaveLength(2);
    expect(names(await request(app).get("/api/fragrances?q=a&q=b").set(auth))).toHaveLength(2);
  });

  it("returns an empty list, not an error, when nothing matches", async () => {
    const res = await request(app).get("/api/fragrances?q=zzz").set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("treats regex characters in the query literally", async () => {
    const res = await request(app).get("/api/fragrances?q=.*").set(auth);

    expect(res.body).toEqual([]);
  });
});

describe("concurrency and failure edge cases", () => {
  it("lets exactly one of two simultaneous creates of the same name win", async () => {
    const [first, second] = await Promise.all([post(base), post({ ...base, name: "HERB garden" })]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
  });

  it("returns a generic 500 and never leaks internals when the store breaks", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const broken = {
      list: async () => {
        throw new Error("connection string mongodb://secret@host failed");
      },
      create: async () => {
        throw new Error("boom");
      },
      update: async () => {
        throw new Error("boom");
      },
      remove: async () => {
        throw new Error("boom");
      },
    };

    const res = await request(createApp({ repo: broken, signingSecret: SECRET }))
      .get("/api/fragrances")
      .set(auth);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL");
    expect(JSON.stringify(res.body)).not.toMatch(/mongodb|secret|boom/);
  });

  it("returns a JSON 404 for unknown API routes", async () => {
    const res = await request(app).get("/api/nope").set(auth);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("keeps /api/health open and tiny", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("sends security headers but still allows framing inside monday", async () => {
    const res = await request(app).get("/api/health");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeUndefined();
  });
});
