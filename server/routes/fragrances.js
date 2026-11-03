import { Router } from "express";
import { fragranceInputSchema, fragranceUpdateSchema } from "../../shared/fragrance.js";
import { asyncHandler } from "../errors.js";

const textParam = (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

export function fragranceRouter(repo) {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      res.json(await repo.list({ q: textParam(req.query.q), category: textParam(req.query.category) }));
    }),
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const created = await repo.create(fragranceInputSchema.parse(req.body));
      res.status(201).json(created);
    }),
  );

  router.put(
    "/:id",
    asyncHandler(async (req, res) => {
      res.json(await repo.update(req.params.id, fragranceUpdateSchema.parse(req.body)));
    }),
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      await repo.remove(req.params.id);
      res.status(204).end();
    }),
  );

  return router;
}
