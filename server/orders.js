import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { COLUMNS, GROUP_REQUESTS } from "../shared/boardColumns.js";
import { validateOrder } from "../shared/order.js";
import { bearerToken } from "./auth.js";
import { AppError, asyncHandler } from "./errors.js";

const orderSchema = z.object({
  boardId: z.string().regex(/^\d+$/, "Board id must be a number."),
  firstName: z.string(),
  lastName: z.string(),
  quantity: z.number().nullable(),
  fragranceIds: z.array(z.string()),
  inscription: z.string(),
  receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Received date must be YYYY-MM-DD."),
});

const CURRENT_USER_QUERY = `query { me { id } }`;

const CREATE_ITEM_MUTATION = `
  mutation ($boardId: ID!, $groupId: String, $name: String!, $values: JSON!) {
    create_item(
      board_id: $boardId
      group_id: $groupId
      item_name: $name
      column_values: $values
      create_labels_if_missing: true
    ) {
      id
    }
  }
`;

export function orderRouter({ repo, monday, mondayApiToken }) {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const body = orderSchema.parse(req.body);
      const form = {
        firstName: body.firstName,
        lastName: body.lastName,
        quantity: body.quantity,
        fragranceIds: body.fragranceIds,
        inscription: body.inscription,
      };

      const errors = validateOrder(form);
      if (Object.keys(errors).length > 0) {
        throw new AppError(400, "VALIDATION_FAILED", Object.values(errors)[0] ?? "Invalid order.", errors);
      }

      if (!mondayApiToken) {
        throw new AppError(503, "NOT_CONFIGURED", "The app is not set up to write orders yet.");
      }

      const claims = sessionClaims(bearerToken(req.get("authorization") ?? ""));
      const scents = await chosenScents(repo, form.fragranceIds);

      const userId =
        claims.user_id !== undefined ? Number(claims.user_id) : await currentUserId(monday, mondayApiToken);

      const id = await createItem(monday, mondayApiToken, {
        boardId: body.boardId,
        form,
        scents,
        userId,
        receivedDate: body.receivedDate,
      });

      res.status(201).json({ id, name: itemName(form) });
    }),
  );

  return router;
}

function sessionClaims(sessionToken) {
  const payload = jwt.decode(sessionToken);
  return payload?.dat ?? {};
}

async function chosenScents(repo, ids) {
  const byId = new Map((await repo.list()).map((fragrance) => [fragrance.id, fragrance]));
  const scents = ids.map((id) => byId.get(id));

  if (scents.some((fragrance) => !fragrance)) {
    throw new AppError(
      409,
      "STALE_CATALOGUE",
      "One of these scents was removed from the catalogue. Refresh the list and pick again.",
      { fragranceIds: "No longer in the catalogue." },
    );
  }

  return scents;
}

async function currentUserId(monday, token) {
  const data = await monday.query(token, CURRENT_USER_QUERY);
  const id = data.me?.id;

  if (id === undefined) {
    throw new AppError(502, "MONDAY_ERROR", "monday did not return the current user. Nothing was saved.");
  }

  return Number(id);
}

const itemName = (form) => `Order - ${form.firstName.trim()} ${form.lastName.trim()} (${form.quantity} Kits)`;

async function createItem(monday, token, { boardId, form, scents, userId, receivedDate }) {
  const data = await monday.query(token, CREATE_ITEM_MUTATION, {
    boardId,
    groupId: GROUP_REQUESTS,
    name: itemName(form),
    values: JSON.stringify(columnValues({ form, scents, userId, receivedDate })),
  });

  const id = data.create_item?.id;

  if (!id) {
    throw new AppError(502, "MONDAY_ERROR", "monday did not confirm the order. Check the board before trying again.");
  }

  return id;
}

function columnValues({ form, scents, userId, receivedDate }) {
  const values = {
    [COLUMNS.salesAssociate]: { personsAndTeams: [{ id: userId, kind: "person" }] },

    [COLUMNS.fragranceProfile]: { labels: [...new Set(scents.map((scent) => scent.category))] },

    [COLUMNS.orderDetails]: { text: scents.map((scent) => `• ${scent.name}`).join("\n") },

    [COLUMNS.quantity]: String(form.quantity),
    [COLUMNS.received]: { date: receivedDate },
    [COLUMNS.clientFirstName]: form.firstName.trim(),
    [COLUMNS.clientLastName]: form.lastName.trim(),
  };

  const inscription = form.inscription.trim();
  if (inscription) values[COLUMNS.inscription] = inscription;

  return values;
}
