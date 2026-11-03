import { SEED_FRAGRANCES } from "./seedData.js";

export async function seedFragrances(repo) {
  const existingNames = new Set((await repo.list()).map((fragrance) => fragrance.name.toLowerCase()));

  let added = 0;
  for (const fragrance of SEED_FRAGRANCES) {
    if (existingNames.has(fragrance.name.toLowerCase())) continue;

    await repo.create(fragrance);
    added++;
  }

  return { added, present: SEED_FRAGRANCES.length - added };
}
