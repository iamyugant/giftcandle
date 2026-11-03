import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { AppError } from "./errors.js";

const duplicateError = () =>
  new AppError(409, "DUPLICATE_NAME", "A fragrance with this name already exists.", {
    name: "Already exists",
  });

const notFoundError = () => new AppError(404, "NOT_FOUND", "Fragrance not found.");

const sameCategory = (fragrance, category) =>
  !category || fragrance.category.toLowerCase() === category.toLowerCase();

const mentions = (fragrance, query) => {
  if (!query) return true;

  const needle = query.toLowerCase();
  return fragrance.name.toLowerCase().includes(needle) || fragrance.description.toLowerCase().includes(needle);
};

const matches = (fragrance, { q, category }) => sameCategory(fragrance, category) && mentions(fragrance, q);

const byName = (a, b) => a.name.localeCompare(b.name);

function newFragrance(input) {
  const now = new Date().toISOString();
  return { ...input, id: randomUUID(), created_at: now, updated_at: now };
}

export class MemoryFragranceRepository {
  items = new Map();

  nameTaken(name, exceptId) {
    return [...this.items.values()].some(
      (fragrance) => fragrance.id !== exceptId && fragrance.name.toLowerCase() === name.toLowerCase(),
    );
  }

  async list(filter = {}) {
    return [...this.items.values()].filter((fragrance) => matches(fragrance, filter)).sort(byName);
  }

  async create(input) {
    if (this.nameTaken(input.name)) throw duplicateError();

    const item = newFragrance(input);
    this.items.set(item.id, item);
    return item;
  }

  async update(id, patch) {
    const current = this.items.get(id);
    if (!current) throw notFoundError();
    if (patch.name && this.nameTaken(patch.name, id)) throw duplicateError();

    const next = { ...current, ...patch, updated_at: new Date().toISOString() };
    this.items.set(id, next);
    return next;
  }

  async remove(id) {
    if (!this.items.delete(id)) throw notFoundError();
  }
}

const toFragrance = (doc) => {
  const { name_lower: _nameLower, _id, ...fragrance } = doc;
  return fragrance;
};

const isDuplicateKey = (error) => error?.code === 11000;

const rethrowAsDuplicate = (error) => {
  throw isDuplicateKey(error) ? duplicateError() : error;
};

export class MongoFragranceRepository {
  collection;

  constructor(collection) {
    this.collection = collection;
  }

  static async connect(uri) {
    const client = new MongoClient(uri);
    await client.connect();

    const collection = client.db().collection("fragrances");
    await collection.createIndex({ name_lower: 1 }, { unique: true });
    await collection.createIndex({ id: 1 }, { unique: true });
    return new MongoFragranceRepository(collection);
  }

  async list({ q, category } = {}) {
    const docs = await this.collection.find({}).toArray();
    return docs.map(toFragrance).filter((fragrance) => matches(fragrance, { q, category })).sort(byName);
  }

  async create(input) {
    const item = newFragrance(input);

    try {
      await this.collection.insertOne({ ...item, name_lower: item.name.toLowerCase() });
    } catch (error) {
      rethrowAsDuplicate(error);
    }
    return item;
  }

  async update(id, patch) {
    const set = { ...patch, updated_at: new Date().toISOString() };
    if (patch.name) set.name_lower = patch.name.toLowerCase();

    try {
      const doc = await this.collection.findOneAndUpdate({ id }, { $set: set }, { returnDocument: "after" });
      if (!doc) throw notFoundError();

      return toFragrance(doc);
    } catch (error) {
      return rethrowAsDuplicate(error);
    }
  }

  async remove(id) {
    const result = await this.collection.deleteOne({ id });
    if (result.deletedCount === 0) throw notFoundError();
  }
}

export async function createRepository(mongoUri) {
  if (!mongoUri) {
    console.warn("MNDY_MONGODB_CONNECTION_STRING not set: using in-memory fragrance store.");
    return new MemoryFragranceRepository();
  }

  return MongoFragranceRepository.connect(mongoUri);
}
