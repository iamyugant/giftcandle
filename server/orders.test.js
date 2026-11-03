import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { MemoryFragranceRepository } from "./repository.js";

const SECRET = "order-secret";

const API_TOKEN = "api-token";
const token = jwt.sign({ userId: 1, dat: { user_id: 1 } }, SECRET);
const auth = { Authorization: `Bearer ${token}` };

function fakeMonday({ userId = 7, itemId = "555" } = {}) {
  const calls = [];
  const client = {
    query: async (callToken, query, variables = {}) => {
      calls.push({ token: callToken, query, variables });

      const data = query.includes("me {") ? { me: { id: userId } } : { create_item: itemId ? { id: itemId } : null };
      return data;
    },
  };

  return { client, calls };
}

const ids = {};
let repo;
let monday;
let app;

beforeEach(async () => {
  repo = new MemoryFragranceRepository();

  const catalogue = [
    ["Campfire", "Smokey"],
    ["Black Cedar", "Smokey"],
    ["Herb Garden", "Herbaceous"],
    ["Mint Leaf", "Herbaceous"],
  ];
  for (const [name, category] of catalogue) {
    ids[name] = (await repo.create({ name, description: "x", category })).id;
  }

  monday = fakeMonday();
  app = createApp({ repo, signingSecret: SECRET, monday: monday.client, mondayApiToken: API_TOKEN });
});

const body = (patch = {}) => ({
  boardId: "18437897186",
  firstName: "Dana",
  lastName: "Reyes",
  quantity: 2,
  fragranceIds: [ids.Campfire, ids["Black Cedar"], ids["Herb Garden"]],
  inscription: "",
  receivedDate: "2026-11-01",
  ...patch,
});

const send = (patch = {}, headers = auth) => request(app).post("/api/orders").set(headers).send(body(patch));

const createCall = () => monday.calls.find((call) => call.query.includes("create_item"));
const values = () => JSON.parse(createCall()?.variables.values);

describe("creating an order", () => {
  it("creates one item and returns its id and PDF-style name", async () => {
    const res = await send();

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: "555", name: "Order - Dana Reyes (2 Kits)" });
    expect(monday.calls.filter((call) => call.query.includes("create_item"))).toHaveLength(1);
  });

  it("uses the app's API token for every call to monday, not the session token", async () => {
    await send();

    expect(monday.calls.every((call) => call.token === API_TOKEN)).toBe(true);
  });

  it("uses the user id in the session claims without asking monday again", async () => {
    const withUser = { Authorization: `Bearer ${jwt.sign({ dat: { user_id: 9 } }, SECRET)}` };

    const res = await send({}, withUser);

    expect(res.status).toBe(201);
    expect(values().person).toEqual({ personsAndTeams: [{ id: 9, kind: "person" }] });
    expect(monday.calls.some((call) => call.query.includes("me {"))).toBe(false);
  });

  it("takes the Sales Associate from monday's current user, not from the browser", async () => {
    monday = fakeMonday({ userId: 42 });
    app = createApp({ repo, signingSecret: SECRET, monday: monday.client, mondayApiToken: API_TOKEN });

    const noUserClaim = { Authorization: `Bearer ${jwt.sign({ userId: 1 }, SECRET)}` };
    await send({ sales: 99 }, noUserClaim);

    expect(values().person).toEqual({ personsAndTeams: [{ id: 42, kind: "person" }] });
  });

  it("targets the board and the Requests group", async () => {
    await send();

    expect(createCall()?.variables).toMatchObject({ boardId: "18437897186", groupId: "topics" });
  });

  it("trims both names in the item name and the columns", async () => {
    await send({ firstName: "  Dana ", lastName: "\tReyes  " });

    expect(createCall()?.variables.name).toBe("Order - Dana Reyes (2 Kits)");
    expect(values().text).toBe("Dana");
    expect(values().text6).toBe("Reyes");
  });

  it("sends the categories of the chosen scents as Fragrance Profile labels, each once", async () => {
    await send();

    expect(values().dropdown).toEqual({ labels: ["Smokey", "Herbaceous"] });
  });

  it("lists the exact scents, in order, as bullets in Order Details", async () => {
    await send();

    expect(values().order_details).toEqual({ text: "• Campfire\n• Black Cedar\n• Herb Garden" });
  });

  it("asks monday to create labels for brand-new scents", async () => {
    await send();

    expect(createCall()?.query).toContain("create_labels_if_missing: true");
  });

  it("sends quantity as a string, as the numbers column expects", async () => {
    await send({ quantity: 1000 });

    expect(values().numbers).toBe("1000");
  });

  it("writes the received date the browser sent, which is the designer's local day", async () => {
    await send({ receivedDate: "2026-10-30" });

    expect(values().date_1).toEqual({ date: "2026-10-30" });
  });

  it("omits the inscription column when blank or spaces", async () => {
    await send({ inscription: "   " });

    expect(values()).not.toHaveProperty("text5");
  });

  it("sends a trimmed inscription when given", async () => {
    await send({ inscription: "  For Dana, with thanks  " });

    expect(values().text5).toBe("For Dana, with thanks");
  });

  it("keeps odd characters in names and inscription verbatim", async () => {
    await send({ firstName: `Zoë "Z"`, lastName: "O'Brien <b>", inscription: "李 & 🕯️" });

    expect(createCall()?.variables.name).toBe(`Order - Zoë "Z" O'Brien <b> (2 Kits)`);
    expect(values().text5).toBe("李 & 🕯️");
  });

  it("writes only the columns the app owns", async () => {
    await send({ inscription: "hi" });

    expect(Object.keys(values()).sort()).toEqual(
      ["date_1", "dropdown", "numbers", "order_details", "person", "text", "text5", "text6"].sort(),
    );
  });

  it("reports a 502 when monday returns no item id, never a false success", async () => {
    monday = fakeMonday({ itemId: null });
    app = createApp({ repo, signingSecret: SECRET, monday: monday.client, mondayApiToken: API_TOKEN });

    const res = await send();

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("MONDAY_ERROR");
  });
});

describe("the server enforces the same rules as the form", () => {
  it.each([
    ["two scents", { fragranceIds: [ids.Campfire, ids["Black Cedar"]] }],
    ["four scents", { fragranceIds: [ids.Campfire, ids["Black Cedar"], ids["Herb Garden"], ids["Mint Leaf"]] }],
    ["a duplicate scent", { fragranceIds: [ids.Campfire, ids.Campfire, ids["Herb Garden"]] }],
    ["quantity 0", { quantity: 0 }],
    ["a decimal quantity", { quantity: 1.5 }],
    ["a quantity above the cap", { quantity: 1001 }],
    ["a blank first name", { firstName: "   " }],
    ["an inscription of 81 characters", { inscription: "x".repeat(81) }],
  ])("rejects %s with 400 and writes nothing", async (_name, patch) => {
    const res = await send(patch);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(monday.calls).toHaveLength(0);
  });

  it("accepts an inscription of exactly 80 characters", async () => {
    expect((await send({ inscription: "x".repeat(80) })).status).toBe(201);
  });

  it("refuses a quantity sent as text", async () => {
    const res = await send({ quantity: "3" });

    expect(res.status).toBe(400);
    expect(monday.calls).toHaveLength(0);
  });

  it("refuses a received date in the wrong format", async () => {
    const res = await send({ receivedDate: "30/10/2026" });

    expect(res.status).toBe(400);
    expect(monday.calls).toHaveLength(0);
  });

  it("refuses a board id that is not a number", async () => {
    const res = await send({ boardId: "abc" });

    expect(res.status).toBe(400);
    expect(monday.calls).toHaveLength(0);
  });
});

describe("the catalogue can change before Start Order", () => {
  it("refuses a scent deleted after the screen loaded, and writes nothing", async () => {
    await repo.remove(ids["Herb Garden"]);

    const res = await send();

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("STALE_CATALOGUE");
    expect(res.body.error.fields).toHaveProperty("fragranceIds");
    expect(monday.calls).toHaveLength(0);
  });

  it("refuses a scent id that was never in the catalogue", async () => {
    const res = await send({ fragranceIds: [ids.Campfire, ids["Black Cedar"], "not-a-real-id"] });

    expect(res.status).toBe(409);
    expect(monday.calls).toHaveLength(0);
  });
});

describe("when the app has no API token yet", () => {
  it("says so with a 503 and calls nothing, instead of failing with a monday error", async () => {
    app = createApp({ repo, signingSecret: SECRET, monday: monday.client });

    const res = await send();

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("NOT_CONFIGURED");
    expect(monday.calls).toHaveLength(0);
  });
});

describe("authentication on the order route", () => {
  it("returns 401 with no token and calls nothing", async () => {
    const res = await request(app).post("/api/orders").send(body());

    expect(res.status).toBe(401);
    expect(monday.calls).toHaveLength(0);
  });

  it("returns 403 for a token signed with another secret", async () => {
    const forged = { Authorization: `Bearer ${jwt.sign({ userId: 1 }, "other")}` };

    const res = await send({}, forged);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("INVALID_SESSION");
    expect(monday.calls).toHaveLength(0);
  });
});
