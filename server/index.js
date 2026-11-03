import { createApp } from "./app.js";
import { config } from "./config.js";
import { createRepository } from "./repository.js";
import { seedFragrances } from "./seed.js";

const ready = createRepository(config.mongoUri);
ready.catch((err) => console.error("Fragrance store failed to start:", err));

if (config.seedOnStart) seedInBackground(ready);

const repo = waitForStore(ready);

process.on("unhandledRejection", (err) => console.error("Unhandled rejection:", err));

createApp({ repo, signingSecret: config.signingSecret, mondayApiToken: config.mondayApiToken }).listen(
  config.port,
  "0.0.0.0",
  () => {
    console.log(`giftcandle listening on :${config.port}`);
  },
);

function seedInBackground(store) {
  store
    .then(seedFragrances)
    .then(({ added, present }) => console.log(`Seeded ${added} fragrances (${present} already present).`))
    .catch((err) => console.error("Seeding failed:", err));
}

function waitForStore(store) {
  return {
    list: async (filter) => (await store).list(filter),
    create: async (input) => (await store).create(input),
    update: async (id, patch) => (await store).update(id, patch),
    remove: async (id) => (await store).remove(id),
  };
}
