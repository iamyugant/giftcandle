import { config } from "../server/config.js";
import { createRepository } from "../server/repository.js";
import { seedFragrances } from "../server/seed.js";

const repo = await createRepository(config.mongoUri);
const { added, present } = await seedFragrances(repo);

console.log(`Seeded ${added} fragrances (${present} already present).`);
process.exit(0);
