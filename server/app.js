import express from "express";
import helmet from "helmet";
import path from "node:path";
import { requireSession } from "./auth.js";
import { errorHandler } from "./errors.js";
import { createMondayClient } from "./monday.js";
import { orderRouter } from "./orders.js";
import { fragranceRouter } from "./routes/fragrances.js";

export function createApp({ repo, signingSecret, mondayApiToken = "", monday = createMondayClient() }) {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false, frameguard: false }));
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/fragrances", requireSession(signingSecret), fragranceRouter(repo));
  app.use("/api/orders", requireSession(signingSecret), orderRouter({ repo, monday, mondayApiToken }));

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Unknown API route." } });
  });

  app.use(express.static(path.resolve("public")));

  app.use(errorHandler);
  return app;
}
