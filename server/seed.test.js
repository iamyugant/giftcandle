import { describe, expect, it } from "vitest";
import { MemoryFragranceRepository } from "./repository.js";
import { seedFragrances } from "./seed.js";
import { SEED_FRAGRANCES } from "./seedData.js";

describe("seedFragrances", () => {
  it("adds every starter scent once and is safe to repeat", async () => {
    const repo = new MemoryFragranceRepository();

    expect(await seedFragrances(repo)).toEqual({ added: SEED_FRAGRANCES.length, present: 0 });
    expect(await seedFragrances(repo)).toEqual({ added: 0, present: SEED_FRAGRANCES.length });
    expect(await repo.list()).toHaveLength(SEED_FRAGRANCES.length);
  });
});
