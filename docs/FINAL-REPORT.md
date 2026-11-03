# Candle Gift Box Orders: final report

Status as of 2 November 2026. This is the single reference for what was built, how it was checked, what matches the PDF, and what is still open. The chronological story is in `BUILD-WALKTHROUGH.md`. Board details are in `board-setup.md`.

## 1. What the app does

A Candle Designer takes a phone order in a monday.com board view ("Order" tab on the Production Orders board):

- First name, last name and quantity (boxes).
- Exactly three different scents from the fragrance library.
- An optional inscription of up to 80 characters.

**Start Order** sends the order to the server, which checks it and creates a board item in the Request group. The Production Manager uses the "Fragrances" tab to keep the library (add, edit, search and delete scents). Board automations and a dashboard track the order through Working On It and Done.

## 2. Architecture

```
monday board (Order view, React + Vibe, in an iframe)
   │  session token (Authorization: Bearer)
   ▼
Express on monday code  ──  Document DB (fragrance library)
   /api/fragrances    CRUD, with ?q= and ?category=
   /api/orders        check the order, confirm each scent is still in the library,
   │                  read the user from the session token, then create_item
   ▼  monday API v2, API-Version 2026-10, at most 5 calls in flight, 429 retried
Production Orders board (Request group)
   └─ automations: status, notify, time tracking, group moves, complete date
```

- **One server** serves the API and the built React app, so there is one container and one URL.
- **Auth:** every API route needs the monday session token. A missing token gets 401. A token that fails the check (forged, expired or signed with another secret) gets 403, with one message for all of them. `GET /api/health` is open so monday can health-check the app.
- **The server writes orders** with the app's API token, which it reads from the environment. The session token only identifies the user, through its `dat.user_id` claim.

## 3. Board

Board `Production Orders` (ID 18437897186).

| Group | Used for |
| --- | --- |
| Request (`topics`) | New orders. The app writes here. |
| Working On It (`group_title`) | Status changed to Working On It. |
| Done (`new_group`) | Status changed to Done. |

| Column | ID | Written by | Notes |
| --- | --- | --- | --- |
| Name | `name` | App | `Order - First Last (N Kits)` |
| Sales Associate | `person` | App | The designer, from the session token |
| Inscription Request | `text5` | App | Left empty when blank |
| Status | `status` | Automation | Request, Working On It, Done, Stuck |
| Fragrance Profile | `dropdown` | App | Categories of the three scents, each once |
| Order Details | `order_details` | App | One "• scent" bullet per line |
| Quantity | `numbers` | App | |
| Order Received Date | `date_1` | App | The designer's local day |
| Order Complete Date | `date_13` | Automation | Set when status becomes Done |
| Order Turnaround | `formula` | Formula | `DAYS(complete, received)` |
| Time Tracking | `time_tracking` | Automation | Starts on Working On It, stops on Done |
| Client First / Last Name | `text`, `text6` | App | |
| Order ID, address, email, phone | various | Not used | Left for later |

### Automations (6)

1. When an item is created, set Status to Request.
2. When an item is created, notify the account owner.
3. When Status changes to Working On It, start Time Tracking and move the item to Working On It.
4. When Status changes to Done, stop Time Tracking and move the item to Done.
5. When Status changes to Done, set Order Complete Date to today.
6. Two days after Order Received Date, at 9:00 AM Phoenix time, if Status is not Done, notify the manager that the order is past 48 hours. Configured on the live board; not yet seen firing.

## 4. Checked against the PDF

Source: "Candle Production Builder" specification (November 2026), section numbers in brackets.

| Requirement | Status | Notes |
| --- | --- | --- |
| FR-01 Board with Request, Working On It, Done groups | Done | |
| FR-02 Fragrance CRUD API, with `?category=` filter | Done | |
| FR-03 Fragrance schema | Done | Fields as specified |
| FR-04 Order Maker view on Vibe components | Done | |
| FR-05 Exactly 3 different scents, enforced on server | Done | Shared rule, run by the server before any write |
| FR-06 Order item created on submit | Done | Server writes the item |
| FR-07 Automations for status, notify, time, groups | Done | Webhook part open, see below |
| FR-08 SLA dashboard | Built earlier | "Candle Orders SLA" dashboard; not re-checked in this final pass |
| TR-01 Runs on monday code | Done | |
| TR-02 No external services | Done | Only monday services |
| TR-03 Vibe design system | Done | |
| SR-01 Secrets kept out of the repo | Done, with one caveat | Secrets are in monday code's environment. The Client Secret and API token were pasted into chat, so **rotate them** |
| §1.4 Catalogue check when a scent is removed mid-order | Done | 409 `STALE_CATALOGUE`, nothing written |
| §2.3 Board columns (Fragrance Profile, Order Details, item name) | Done | |
| §3.1 Fragrance endpoints | Done | |
| §3.2 Order mutation with stringified JSON | Done | Uses `create_labels_if_missing` |
| §3.3 Webhook for SLA timers | **Open** | Not built. See section 6 |
| §6.1 Rate limit: 5 workers, 429 backoff | Done | Retries up to four times, then 503 |
| §6.2 Token checks: 401 missing, 403 invalid | Done | |
| §6.3 SLA: Time Tracking, 48-hour target | Partly | Time Tracking runs. A 48-hour alert is configured but not yet seen firing. The formula shows days |
| §4 Phase 1: API version `2024-10` | **Not done, on purpose** | The app uses `2026-10`, as you asked |

## 5. Verification

### Tests

`npm test`: **210 tests in 12 files, all passing.** `npm run lint` (syntax check) and `npm run build` are clean. The code is plain JavaScript; there is no type check.

| Area | Tests |
| --- | --- |
| Order rules and edge cases | 47 |
| Fragrance API and auth | 65 |
| `POST /api/orders` against a fake monday | 33 |
| monday client (retry, concurrency, errors) | 7 |
| Seeding, health, local date | 4 |
| Order screen | 30 |
| Admin screen | 24 |

### Live, on the deployed app

- **Five orders** through the Order view: Ava Lindqvist (2), Marcus Bell (12), Zoë O'Brien (1), Priya Raman (5), Tom Hayes (3). Each item has the right name, person, quantity, inscription, categories and scent bullets, status Request, and today's date. Tom's spaces-only inscription was left out. Zoë's 80-character inscription arrived unchanged.
- **Final check order** after the last redeploy: Order - Final Check (1 Kits), all columns correct.
- **Automations:** moving Ava's order to Working On It moved it to the Working On It group and started time tracking. Moving it to Done moved it to Done, set the complete date to today, and stopped time tracking at 00:13:39.
- **Auth:** the live endpoints return 401 with no token, 403 with a bad token, and 200 for health.
- **Removed webhook path:** returns 404.

### Not verified

- The 48-hour alert. It is configured but has not been seen firing on a real order.
- The dashboard, in this final pass.
- The webhook. See section 6.

## 6. Open items and decisions

### Open

1. **Webhook (§3.3).** Not built. monday's automation webhook was denied at the endpoint, and the webhook created through the API never delivered. The API doesn't expose the registered URL, so I couldn't diagnose it further. The SLA is covered by the automations and Time Tracking. If the PDF's webhook is still wanted, it needs a working delivery route first.
2. **Rotate the secrets** pasted into chat: the monday API token and the Signing Secret. Not rotated, at the owner's direction. Rotate before handover.
3. **Resolved:** Working On It is no longer marked as done in the status settings, so done reports count only finished orders.
4. **Resolved:** the six test orders (Ava, Marcus, Zoë, Priya, Tom and Final Check) were deleted from the board. The four sample orders from the brief (A to D) remain.
5. **Resolved:** the "Zz Edge Scent" label, left over from an edge-case test, has been removed from the Fragrance Profile dropdown.
6. **Unused environment and secret entries:** `MONDAY_WEBHOOK_SECRET` (environment) and the two `code:secret` entries from earlier. None are read by the app.

### Decisions

- **Server writes orders.** The PDF requires one place to enforce the 3-scent rule. The browser has no monday write access.
- **API token for writes, session token for identity.** The session token can't call monday's API. The server keeps its own token as an environment variable and takes the Sales Associate from the session's `user_id`.
- **Fragrance Profile holds categories, Order Details holds scents.** Matches the PDF. The old scent-name labels remain on the board, unused.
- **Status labels and groups renamed to the PDF's names.** The automation that sets Request on create was updated when the label was renamed.
- **API version 2026-10.** The PDF asks for 2024-10. Kept on purpose.
- **Disabled button with a tooltip (reverses the earlier errors-on-click choice).** Start Order is disabled until the form is valid, as the developer manual asks. A tooltip gives the first reason, and fields explain themselves as the designer types. The server enforces the same rules and rejects anything that gets through.
- **Webhook signature:** the PDF's HMAC-over-body scheme doesn't match monday's JWT signing, so it was never implemented as written.

## 7. Configuration and deployment

### Environment (set with `mapps code:env`)

| Name | Purpose |
| --- | --- |
| `MONDAY_SIGNING_SECRET` | Client Secret. Verifies session tokens |
| `MONDAY_API_TOKEN` | API token. Writes orders to the board |
| `MNDY_MONGODB_CONNECTION_STRING` | Set by monday code at runtime. Fragrance Document DB |
| `SEED_FRAGRANCES` | Optional. Set to `true` once to load the 24 starter scents |

Secret values are never written to the repo. `.env` and `.mappsrc` are git-ignored.

### Deploy

```bash
mapps code:push -i <APP_VERSION_ID>
```

About five minutes. `mapps code:status -i <APP_VERSION_ID>` shows whether the latest build is live. `mapps code:env -i <APP_ID> -m list-keys` lists names, not values.

### Run and test locally

```bash
npm install
npm test
npm run lint
npm run build
npm start
```

Locally the fragrance store falls back to memory.

## 8. Known limits

- Fragrance edits are last-write-wins. There is no version check.
- Deleting a scent does not change orders already placed. They keep the scent name.
- The webhook dedupe is not needed while no webhook exists.
- Order names are not length-checked. monday rejects very long item names, and the designer sees the error.
- An emoji counts as two characters toward the 80-character inscription limit.

## 9. Next steps

1. Rotate the two secrets before handover.
2. Decide on the webhook: retry the delivery route with monday support, or accept the gap in writing.
3. Remove the unused environment entries.
4. Confirm the 24 starter scents appear in the Fragrances tab on the deployed app.
5. Watch one order pass the 48-hour mark to confirm the alert fires, and re-check the dashboard.
