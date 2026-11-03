import jwt from "jsonwebtoken";
import { AppError } from "./errors.js";

export const bearerToken = (header) => header.replace(/^Bearer\b\s*/i, "").trim();

export function requireSession(secret) {
  const missing = () => new AppError(401, "UNAUTHORIZED", "Missing session token.");
  const invalid = () => new AppError(403, "INVALID_SESSION", "Invalid or expired session token.");

  return (req, _res, next) => {
    const token = bearerToken(req.get("authorization") ?? "");
    if (!token) return next(missing());

    if (!secret) return next(invalid());

    try {
      jwt.verify(token, secret);
      next();
    } catch {
      next(invalid());
    }
  };
}
