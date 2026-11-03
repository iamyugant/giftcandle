import { ZodError } from "zod";

export class AppError extends Error {
  status;
  code;
  fields;

  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const asyncHandler = (fn) => (req, res, next) => {
  fn(req, res, next).catch(next);
};

function sendError(res, status, code, message, fields) {
  res.status(status).json({ error: { code, message, fields } });
}

function fieldErrorsFrom(err) {
  const fields = {};
  for (const issue of err.issues) {
    fields[issue.path.join(".") || "_"] ??= issue.message;
  }
  return fields;
}

export const errorHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const fields = fieldErrorsFrom(err);
    return sendError(res, 400, "VALIDATION_FAILED", Object.values(fields)[0] ?? "Invalid input.", fields);
  }

  if (err instanceof AppError) {
    return sendError(res, err.status, err.code, err.message, err.fields);
  }

  if (err?.type === "entity.parse.failed") {
    return sendError(res, 400, "INVALID_JSON", "Request body is not valid JSON.");
  }

  if (err?.type === "entity.too.large") {
    return sendError(res, 413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  }

  console.error(err);
  return sendError(res, 500, "INTERNAL", "Something went wrong.");
};
