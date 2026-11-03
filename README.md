# Candle Gift Box Orders

A monday.com board view app for a candle company. A **Candle Designer** takes an order on the phone and, in under a minute, places it on the **Production Orders** board: customer name, number of boxes and exactly 3 different scents. The **Production Manager** keeps the fragrance library in the app instead of a spreadsheet and watches the pipeline on the board and dashboard.

## What was built

| Brief requirement | Where it lives |
| --- | --- |
| Board view to pick 3 fragrances and the number of kits | `client/src/OrderScreen.jsx` |
| A submitted order is checked by the server, then creates an item on the board | `server/orders.js` (`POST /api/orders`; the user comes from monday) |
| API to add, update, delete and get all fragrances | `server/routes/fragrances.js` |
| Fragrances in a secure central place | monday code Document DB, `server/repository.js` |
| Hosted on monday code, no extra services | one Express server, deployed with `mapps code:push` |
| At least one automation | six no-code automations, see [Automations](#automations) |
| Vibe UI components | `@vibe/core` throughout the client |

Out of scope, on purpose: **no batching, stock or inventory logic.** Each order is produced on its own.

## Automations

Six no-code automations on the Production Orders board (Automate center). Each one was seen firing on a real test order, except the 48-hour alert, which is configured but has not yet been seen firing:

| Automation | Why |
| --- | --- |
| When an item is created, set **Status** to **Request** | Orders from the app arrive without a status; this puts every one into the pipeline |
| When an item is created, notify the Production Manager | The manager hears about an order the moment it is placed |
| When **Status** changes to **Working On It**, start **Time Tracking** and move the item to the Working On It group | Records how long production has been running |
| When **Status** changes to **Done**, stop **Time Tracking** and move the item to the Done group | Stops the timer and closes the order |
| When **Status** changes to **Done**, set **Order Complete Date** to the current date | Feeds the **Order Turnaround** formula, which is the SLA metric |
| Two days after **Order Received Date**, at 9:00 AM Phoenix time, while **Status** is not Done, notify the manager that the order is past 48 hours | Flags late orders |

Why no-code automations: the customer's own team can change them later without an engineer. The notify automations currently target the account owner; point them at the real Production Manager. monday's "current date" is UTC, so an order completed late in the local evening can show a turnaround one day longer.

## Dashboard

**Candle Orders SLA** is a dashboard with a chart of orders by Status, connected to the Production Orders board. It updates as soon as a status changes. More widgets (overdue orders, orders over time, turnaround) can be added without code.

## Architecture

```
monday board ── Order view (React + Vibe, in an iframe)
                    │  session token (Authorization: Bearer)
                    ▼
            Express on monday code ── Document DB
              /api/fragrances   /api/orders  (token verified)
                    │  me, then create_item (session token,
                    ▼   API-Version 2026-10, max 5 in flight)
            Production Orders board
```

- **One Express server** serves both the API and the built React bundle: one container, one URL.
- The client gets the monday **session token** from the SDK and sends it on every API call. The server verifies it with the app's signing secret.
- The server checks each order (`validateOrder`, the same rules as the form) and confirms every scent is still in the catalogue before anything reaches the board.
- The Sales Associate is the user monday reports for the session token, so the browser cannot name someone else.
- monday calls are limited to five in flight, and HTTP 429 is retried with jittered backoff (PDF §6.1).
- `shared/order.js` holds the order rule (exactly 3 different scents, whole-number quantity from 1 to 1,000). The form uses it to explain what is missing before anything reaches the board.

## Run it locally

Needs Node 22 or newer.

```bash
npm install
npm test          # vitest
npm run lint      # syntax check of the server, shared and scripts files
npm run build     # client into public/
npm start         # API and built client on :8080
```

Locally there is no Document DB, so the fragrance store falls back to memory. `GET /api/health` works without a token; every other API route needs a valid monday session token, which only exists inside a board.

Environment names are in `.env.example`. Never commit real values.

## Deploy to monday code

```bash
npm install -g @mondaycom/apps-cli
mapps init -l -t <your API token>      # writes .mappsrc, which is git-ignored
mapps code:env -i <APP_ID> -m set -k MONDAY_SIGNING_SECRET -v "<client secret>"
mapps code:push -i <APP_VERSION_ID>
```

In the Developer Center: create the app, add a **Board View** feature (slug `order`), choose **Server-side code** as its deployment with an empty sub-route, add the `boards:read` and `boards:write` scopes, then add the view to the board from **+ Add view → Apps**.

Two values are set once with `mapps code:env`, which the server reads as `process.env`. Neither is stored in the repo. (`mapps code:secret` stores values the server cannot read as environment variables, so it does not work for these.)

```bash
mapps code:env -i <APP_ID> -m set -k MONDAY_API_TOKEN -v "<monday API token>"
```

`MONDAY_API_TOKEN` lets the server write orders to the board. The session token cannot call monday's API, so the server needs its own token.

To load the 24 starter scents once, set `SEED_FRAGRANCES=true`, redeploy, then delete the variable. The seed is idempotent, so it only adds scents that are missing.

## API

All routes except health require `Authorization: Bearer <monday session token>`.

| Method and path | Purpose | Success | Errors |
| --- | --- | --- | --- |
| `GET /api/fragrances` | List, optional `?q=` and `?category=` | 200 | 401, 403 |
| `POST /api/fragrances` | Add | 201 | 400, 401, 403, 409 duplicate name |
| `PUT /api/fragrances/:id` | Update any fields | 200 | 400, 401, 403, 404, 409 |
| `DELETE /api/fragrances/:id` | Delete | 204 | 401, 403, 404 |
| `POST /api/orders` | Check and create a Production Orders item | 201 `{ id, name }` | 400 rules, 401, 403, 409 scent removed, 502 monday refused, 503 monday busy |
| `GET /api/health` | Health check | 200 | none |

Auth: a request with **no token** gets 401 `UNAUTHORIZED`. A token that is **present but invalid, forged or expired** gets 403 `INVALID_SESSION`, with one message for all of them.

Order item name: `Order - First Last (N Kits)`, e.g. "Order - Joseph Souto (5 Kits)".

Fragrance fields are exactly the brief's: `id`, `name`, `description`, `category`, `image_url`, `created_at`, `updated_at`. Names are unique ignoring case.

Every error has one shape: `{ "error": { "code": "VALIDATION_FAILED", "message": "...", "fields": { "name": "..." } } }`.

## Decisions

- **Document DB, not Storage or a board, for fragrances.** It is part of monday code, so it respects "no additional services", and the connection string arrives in `MNDY_MONGODB_CONNECTION_STRING`. Everything goes through `FragranceRepository`, so the store can change in one file.
- **Orders are checked and written by the server.** The PDF requires one place that enforces the 3-scent rule, so the form is no longer the only guard. The browser holds no monday write access. This reverses the earlier choice to write from the view, which the walkthrough records.
- **Case-insensitive uniqueness is a database index**, not a check in code, so two admins cannot create the same scent at the same moment.
- **Scent names are stored on the order, not ids**, so deleting a fragrance never breaks an old order.
- **The server listens before the database connects.** monday code health-checks port 8080; waiting for the database first made the first deploy fail.
- **Order Received Date uses the designer's local date**, not UTC, which could be a day ahead in the evening.
- **Automations are no-code**, so the customer's own team can change them without an engineer.

## Assumptions and open questions

- The fragrance schema is kept exactly as the brief gives it; scent notes go in `description`. Open question for the company: is a separate recipe field wanted?
- **Fragrance Profile is a dropdown column.** The app sends the categories of the three scents (Smokey, Fruity, Fresh, Floral, Herbaceous, Citrus), each listed once. The scent names go in Order Details instead, one bullet per scent.
- Quantity is a whole number from 1 to 1,000 boxes.
- Inscription is optional, trimmed, up to 80 characters. The board has the column; the mockup does not show it.
- SLA: Order Turnaround (Order Complete Date minus Order Received Date) already exists on the board and is the metric. A 48-hour alert notifies the manager when an order is still open two days after it was received.

## Known limits and next steps

- **Deliberately different from the PDF:** the monday API version stays at `2026-10` (the PDF says `2024-10`).
- **Open gap, PDF §3.3 (webhook for SLA timers):** not built. The SLA runs on the board instead: Time Tracking starts on Working On It, stops on Done, and Order Turnaround shows the days. A webhook receiver was built and removed: monday's automation webhooks were denied at the endpoint, and the API did not expose the registered URL to check it.
- **Time tracking for SLA:** Time Tracking records the elapsed time, and Order Turnaround shows the days. The 48-hour alert is a notification only. Nothing blocks or reassigns a late order.
- Dropdown columns do not work in monday automations, so automations key off Status.
- The fragrance catalogue is edited last-write-wins; there is no version check on concurrent edits.
- The Document DB code has been run against the real database only through the deployed app, not in automated tests.
- Next: inventory (explicitly out of scope today), email or SMS to the customer, import of the existing spreadsheet, reporting by customer.

## Tests

`npm test` runs 210 tests across 12 files: the order rules and their edge cases, the fragrance API (auth including expired and forged tokens, CRUD, filters, field limits, duplicates, concurrency, oversized and malformed bodies, store failures), seeding, order creation through `POST /api/orders` against a fake monday (the same column checks as before, plus the server-side rules, a scent removed mid-order, and the user taken from monday), the monday client (429 retry and backoff, the five-in-flight limit, error mapping), and both screens (failure paths, double clicks, retry, search, delete confirmation).

## AI use

Claude Code was used for scaffolding, boilerplate and first drafts of tests. Every monday-specific call was checked against the live board: column IDs were read from the API playground, and an order was placed and read back through the API. Two bugs only the live board exposed (the create-item response shape and a UTC date) were fixed by hand afterwards.
