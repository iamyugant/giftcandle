import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { MemoryFragranceRepository } from "./repository.js";

const SECRET = "test-secret";
const auth = { Authorization: `Bearer ${jwt.sign({ userId: 1 }, SECRET)}` };

const herbGarden = {
  name: "Herb Garden",
  description: "Fresh basil, thyme and rosemary.",
  category: "Herbaceous",
};

let app;

beforeEach(() => {
  app = createApp({ repo: new MemoryFragranceRepository(), signingSecret: SECRET });
});

describe("auth", () => {
  it("rejects a missing token", async () => {
    const res = await request(app).get("/api/fragrances");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a token signed with another secret", async () => {
    const forged = `Bearer ${jwt.sign({}, "other")}`;

    const res = await request(app).get("/api/fragrances").set("Authorization", forged);

    expect(res.status).toBe(403);
  });

  it("leaves health open", async () => {
    expect((await request(app).get("/api/health")).status).toBe(200);
  });
});

describe("fragrance CRUD", () => {
  it("creates, lists, updates and deletes", async () => {
    const created = await request(app).post("/api/fragrances").set(auth).send(herbGarden);
    expect(created.status).toBe(201);
    expect(created.body.id).toBeTruthy();
    expect(created.body.created_at).toBe(created.body.updated_at);

    const list = await request(app).get("/api/fragrances").set(auth);
    expect(list.body).toHaveLength(1);

    const updated = await request(app)
      .put(`/api/fragrances/${created.body.id}`)
      .set(auth)
      .send({ category: "Green" });
    expect(updated.status).toBe(200);
    expect(updated.body.category).toBe("Green");
    expect(updated.body.name).toBe("Herb Garden");

    const removed = await request(app).delete(`/api/fragrances/${created.body.id}`).set(auth);
    expect(removed.status).toBe(204);
    expect((await request(app).get("/api/fragrances").set(auth)).body).toEqual([]);
  });

  it("filters by q and category", async () => {
    await request(app).post("/api/fragrances").set(auth).send(herbGarden);
    await request(app)
      .post("/api/fragrances")
      .set(auth)
      .send({ name: "Citrus Grove", description: "Orange zest.", category: "Citrus" });

    const byCategory = await request(app).get("/api/fragrances?category=citrus").set(auth);
    expect(byCategory.body.map((f) => f.name)).toEqual(["Citrus Grove"]);

    const byQuery = await request(app).get("/api/fragrances?q=basil").set(auth);
    expect(byQuery.body.map((f) => f.name)).toEqual(["Herb Garden"]);
  });

  it("400s on a missing name with a field error", async () => {
    const res = await request(app)
      .post("/api/fragrances")
      .set(auth)
      .send({ description: "x", category: "y" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.body.error.fields.name).toBeTruthy();
  });

  it("400s on a non-http image_url", async () => {
    const res = await request(app)
      .post("/api/fragrances")
      .set(auth)
      .send({ ...herbGarden, image_url: "ftp://x.test/a.png" });

    expect(res.status).toBe(400);
  });

  it("409s on a duplicate name ignoring case", async () => {
    await request(app).post("/api/fragrances").set(auth).send(herbGarden);

    const res = await request(app)
      .post("/api/fragrances")
      .set(auth)
      .send({ ...herbGarden, name: "herb garden" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_NAME");
  });

  it("404s when updating or deleting an unknown id", async () => {
    expect((await request(app).put("/api/fragrances/nope").set(auth).send({ name: "A" })).status).toBe(404);
    expect((await request(app).delete("/api/fragrances/nope").set(auth)).status).toBe(404);
  });

  it("400s on an empty update", async () => {
    const created = await request(app).post("/api/fragrances").set(auth).send(herbGarden);

    const res = await request(app).put(`/api/fragrances/${created.body.id}`).set(auth).send({});

    expect(res.status).toBe(400);
  });
});
