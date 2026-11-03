# Build walkthrough: Candle Gift Box Orders

A complete, chronological record of how this project was built, what was tried, what broke, and why each decision was made. Written so you can explain any part of it live without notes.

> This document contains no tokens, secrets or account subdomains on purpose. IDs that appear (the board ID) are ones the assignment itself asks you to record.

---

## Contents

1. [The brief and how it was read](#1-the-brief-and-how-it-was-read)
2. [Final architecture in one page](#2-final-architecture-in-one-page)
3. [Timeline, step by step](#3-timeline-step-by-step)
4. [Every bug found, and how](#4-every-bug-found-and-how)
5. [Decisions log (the "why")](#5-decisions-log-the-why)
6. [How it was verified](#6-how-it-was-verified)
7. [File map](#7-file-map)
8. [Commands you will actually use](#8-commands-you-will-actually-use)
9. [Security notes and risks you accepted](#9-security-notes-and-risks-you-accepted)
10. [Not done, limits, and open questions](#10-not-done-limits-and-open-questions)
11. [Customer demo script](#11-customer-demo-script)
12. [Code walkthrough Q&A](#12-code-walkthrough-qa)

---

## 1. The brief and how it was read

**The input.** A 23-page PDF, "Candle Gift Box Assignment Plan", describing a monday.com app for a candle company: a designer takes an order by phone, picks exactly 3 different scents and a number of boxes, and the order lands on a Production Orders board. A Production Manager keeps the fragrance list in the app instead of a spreadsheet.

**First obstacle.** The built-in PDF reader needed a system tool (poppler) that was not installed, and no Python PDF libraries were present. The PDF was read instead with the Desktop Commander connector's PDF reader, which returns the text page by page. Lesson: when one tool cannot read a file, check for another tool before asking the user to paste content.

**How the plan was interpreted.** The PDF contains an "Updated decisions" section at the top that says it replaces anything below that differs. The later sections still describe older choices (monday code Storage, a `POST /api/orders` endpoint, a `recipe` field). Every decision in this project follows the top section:

| Topic | Final decision | Why |
| --- | --- | --- |
| Fragrance storage | monday code Document DB (MongoDB-compatible) | Part of monday code, so it respects "no additional services". The connection string is provided at runtime. |
| Fragrance fields | Exactly the brief's: `id`, `name`, `description`, `category`, `image_url`, `created_at`, `updated_at` | The brief defines the schema. No extra `recipe` field; scent notes go in `description`. |
| Creating the order | Through the server: `POST /api/orders` checks the order, then writes it with the caller's session token | One place enforces the 3-scent rule (PDF). Reversed the earlier browser-direct choice; see section 13. |
| Backend job | Fragrance API, session-token check, health route, serving the built client | Matches "API with endpoints to add, update, delete and get all fragrances". |
| Hosting | One Express server on monday code | Matches "hosted within the monday code platform". |
| Scent columns | Text, not dropdown (this turned out to be wrong for this board, see section 4) | The plan assumed dropdowns do not work in automations. |

---

## 2. Final architecture in one page

```
monday board "Production Orders"
  └─ "Order" board view (React + Vibe, rendered in an iframe)
       │  1. monday.get("sessionToken")  ──►  Authorization: Bearer <token>
       │                                          │
       │                                          ▼
       │                              Express on monday code
       │                                /api/health          (open)
       │                                /api/fragrances      (token verified)
       │                                static client bundle (public/)
       │                                          │
       │                                          ▼
       │                              Document DB "fragrances" collection
       │
       │  2. POST /api/orders: checks, then create_item  ──►  Production Orders board
       │        (session token, user from monday)                (Requests group)
       ▼
Board automations (no code): set status New Order, notify, set complete date on Done
Dashboard "Candle Orders SLA": chart of orders by status
```

Two separate trust paths, and it is worth saying so out loud:

- **Fragrance data** goes browser → your server → database. The server proves the caller is a real monday user by verifying the session token.
- **Orders** go browser → your server → monday. The server checks each order and writes it with the caller's own session token, so no monday API token is stored and the browser has no write access to the board.

---

## 3. Timeline, step by step

### Step 1: Inspect the environment

**What:** Checked Node (v24), npm, git, and the working folder.
**Why:** The plan says Node 22 or newer. Found that the real repository was already cloned one level down (`giftcandle/giftcandle`, remote `iamyugant/giftcandle`, no commits), so all work happens there.

### Step 2: Scaffold the project

**What:** Created a single root `package.json` with scripts `dev`, `build`, `start`, `test`, `lint`, plus `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, an Express app with `/api/health`, and a React page.

**Decisions and why:**

- **One `package.json`, not separate server and client ones.** `mapps code:push` expects a single project with `npm start` at the root. Fewer moving parts.
- **`lint` is `tsc --noEmit`.** A type check is the cheapest meaningful lint; adding ESLint would be configuration with no extra safety for a project this size.
- **`tsx` as a runtime dependency.** `npm start` runs TypeScript directly, so there is no separate compile step to deploy.
- **`.gitignore` written before the first commit.** It covers `.env`, `.mappsrc`, `node_modules/`, `public/`, `dist/`. The plan is explicit that the CLI's local config file (which holds your API token) must never be committed.
- **`.env.example` lists names only.**
- **helmet with `frameguard` and CSP off.** monday renders board views in an iframe; with framing blocked, the view would appear blank inside the board.

**Check:** lint, one test (health route), build, and a curl against the running server.

### Step 3: The fragrance API (plan Step 7)

**What was built:**

| File | Responsibility |
| --- | --- |
| `shared/fragrance.ts` | Zod schema for the brief's fields, shared by client and server |
| `server/errors.ts` | `AppError`, async wrapper, one error shape for every failure |
| `server/repository.ts` | `FragranceRepository` interface with a memory and a Mongo implementation |
| `server/auth.ts` | Verifies the monday session token on every fragrance route |
| `server/routes/fragrances.ts` | `GET`, `POST`, `PUT /:id`, `DELETE /:id` |
| `server/seed*.ts`, `scripts/seed-fragrances.ts` | 24 starter scents across 6 categories, idempotent |

**Why it is shaped this way:**

- **A repository interface.** The routes do not know whether they talk to memory or a database. Tests use memory; production uses Mongo. If the storage ever changes, one file changes.
- **Uniqueness enforced by a database index.** Names are unique ignoring case. A unique index on a lowercased copy (`name_lower`) means two admins saving the same name at the same moment cannot both succeed. A check-then-insert in code cannot give that guarantee.
- **One error shape** (`{ error: { code, message, fields } }`). The client shows server errors next to the right input without special cases.
- **Auth in front of the whole router.** A new route added later cannot accidentally go live without a token check. `/api/health` stays open so the platform can health-check it.
- **Zod validation and trimming.** Names 1 to 80 characters, description up to 500, `image_url` must be http(s). Unknown input is rejected with a field-level message.

**Tests:** 10 API tests with supertest: auth (missing token, wrong secret, open health), full create/list/update/delete, search and category filters, missing name, bad image URL, duplicate name in different case (409), unknown id (404), empty update (400).

### Step 4: The order rule and the order screen (plan Step 8)

**The business rule** lives in `shared/order.ts` as `validateOrder`: both names required, quantity a whole number from 1 to 1,000, exactly 3 different scents, inscription (optional) at most 80 characters after trimming. It returns a message per invalid field, and an empty object means valid.

**Why shared:** The form uses it to explain what is missing. A server endpoint could import the exact same function, so the UI and the API cannot disagree about the rule.

**How this step was handled:** The function body was left for you to write as a learning exercise (with tests written first, so 5 failed). You asked me to write it, so I did, and all tests then passed. The duplicate check runs before the count check on purpose: `["a","a","b"]` has 3 entries, so a count-only check would let it through.

**The screen** (`client/src/OrderScreen.tsx`): First Name, Last Name, Quantity, one multi-select limited to 3 scents, an optional Inscription, and Start Order.

Design points worth stating:

- **Nothing is red until the first Start Order click.** A designer on a call should not be scolded for fields they have not reached yet.
- **A fourth scent is made impossible, not just rejected.** Once 3 are chosen the menu offers only those 3 (Vibe's dropdown has no per-option disabling). `validateOrder` still enforces the rule as the real guard.
- **Double clicks are ignored** while a request is in flight, so one order cannot become two.
- **Loading, empty, error and success states** exist for each area.
- **The running total is read aloud text**: "12 boxes, 36 candles", so the designer can confirm with the customer.

**Later redesign.** You supplied a Figma mockup: one row of three fields, a single multi-select, a wide Start Order button. The first version used a custom slot picker with category chips. It was rebuilt to match the mockup. The inscription field is not in the mockup but was kept because the board has an Inscription column and the plan keeps it as optional.

### Step 5: Developer Center setup, done in your browser

**Why in Chrome:** Creating an app and feature has no CLI equivalent for the feature step, so this was done through Claude in Chrome in your signed-in session. Each action that spends something permanent was announced; a few things were left to you on purpose.

What was done:

1. Created the app "Candle Gift Box Orders" (slug `candle-gift-box`). Slugs are permanent.
2. Added a **Board View** feature named "Order" (slug `order`), starting from scratch because the project code already existed.
3. Saved the OAuth scopes `boards:read` and `boards:write` (the plan says add `users:read` only if needed; it was not).
4. Opened Host on monday, Server-side code, and clicked "Connect to monday code". The terms-and-conditions checkbox appeared. **Accepting legal terms was left to you**, and you accepted them.
5. After a successful deploy, set the feature's deployment to **Server-side code** with an empty sub-route.

**Your API token.** `mapps init` was run by you in your own terminal so the token never passed through the chat. (At one point the token appeared in a message you pasted; see section 9.)

### Step 6: First deploy, and why it failed

**What happened:** `mapps code:push` reported "the container should be up and listen on port 8080" and the deploy failed.

**Diagnosis:** The runtime logs could not be read from here (the `code:logs` history option is interactive and crashes without a terminal). The best explanation was that the server waited for the database connection before it started listening, so the platform's health check on port 8080 timed out.

**Fix:** `server/index.ts` now listens immediately. The database connects in the background, and requests wait on the same promise (`waitForStore`). Redeploy succeeded.

**A second snag:** killing the CLI mid-deploy does not cancel the deployment on monday's side. A new push was refused with "an existing deployment is already in progress". The fix was to poll `mapps code:status` until the first one finished, then push again. Always check status before retrying.

### Step 7: Adding the view to the board

The board already had an "Order" tab with a broken-page icon. That tab belongs to the board (part of the assignment's template) and was **left alone**. The new view was added through **+ Add view, Apps, Installed, Order**. It rendered both tabs inside the board.

### Step 8: Authentication in practice

The view showed "Missing or invalid session token". That was correct: the server had no signing secret, so it rejected everything. You set it with `mapps code:env ... -k MONDAY_SIGNING_SECRET`. The Client Secret turned out to be the right secret (the plan said to verify which one signs the token). After the new instance started, the view loaded with no 401.

**Why an environment variable and not `code:secret`:** the server reads `process.env`. Secrets set with `code:secret` are read through monday's SDK instead, which would have been an extra dependency and unverified behavior.

### Step 9: Seeding the real database

The seed script needs the database connection string, which only exists inside monday code, so it cannot run from a laptop. The solution: a `SEED_FRAGRANCES=true` environment variable makes the server seed missing scents at startup. It was set, the app redeployed, 24 scents appeared, and the **flag was then removed** (otherwise a scent someone deleted would return on every restart). The seeder is idempotent and has a test.

### Step 10: Reading the real board

Using the API playground (read-only queries), the real column and group IDs were read and saved to `docs/board-setup.md`. This replaced guessed IDs in `client/src/boardColumns.ts`.

Important findings:

- **Scent Profiles is a dropdown column**, not text. The order now sends the 3 fragrance names as dropdown **labels** and sets `create_labels_if_missing`, because a scent added yesterday has no label on the board yet.
- The board's **Status** column had no value for new items (see section 4).

### Step 11: End-to-end testing inside the board

A first labelled test order ("Test Order") was placed through the form. It exposed two bugs (section 4). After fixing and redeploying, a second order ("Retry Test") was placed and its stored columns were read back through the API: group Requests, Sales Associate = you, three scent labels, quantity, **local** received date, inscription empty. The admin tab was then tested live: duplicate name rejected, add, edit, search and delete with confirmation.

### Step 12: Cleanup of test data

"Test Order" and "Retry Test" were moved to monday's trash on your instruction. "Auto Test", created later to prove the automations fire, was cleaned up the same way. Trash keeps them 30 days; nothing was permanently erased. The throwaway scent "Zz Test Scent" was deleted through the app. The one-time seed flag was deleted. Orders A, B and C (the assignment's sample data) were never touched.

### Step 13: Board automations (plan Step 10)

Three no-code recipes, each seen firing on a real order:

| Recipe | Why |
| --- | --- |
| When an item is created, set **Status** to **New Order** | App orders arrive with no status; without this they never appear in a status dashboard. |
| When an item is created, notify the Production Manager | The manager hears about it immediately. Currently targets you, the only user. |
| When **Status** changes to **Done**, set **Order Complete Date** to the current date | Feeds the existing Order Turnaround formula, the SLA metric. |

**Why no-code:** the customer's own team can edit recipes later without an engineer. Dropdown columns cannot be used in automations, so every recipe keys off Status.

### Step 14: Dashboard (plan Step 11)

Created "Candle Orders SLA", connected the Production Orders board, and added a chart with Status on the X-axis. It showed "No results" until an item had a status, which is how the missing-status gap was found. After the automation was added, the chart showed Done: 1 and updated live.

### Step 15: Hardening, docs, tests

- **Admin stale-error nit fixed:** editing a field now clears its server error.
- **Component test:** an order with fewer than 3 scents never reaches the board, and the form says why.
- **Secret scan:** scanned every file git would stage. No secrets. It did find `code.tar.gz` (the CLI's deploy archive) in the project folder; it held no secrets, but it was deleted and git-ignored.
- **README** written in full.

### Step 16: Walkthrough-readiness refactor

Behavior-preserving refactor of **all source files** (client, server, shared, scripts), done in two passes: first the six with the most logic, then the rest, with comments shortened everywhere to at most two lines of "why". No imports changed, no logic removed. The suite (22 tests) and a production build confirmed identical behavior.

What changed structurally:

- **Early returns instead of nested ternaries.** `ScentSection` and `FragranceList` each decide error, loading, empty or loaded with one `return` per state. The error handler is a flat chain of early returns around one `sendError` helper.
- **Small single-purpose helpers.** `createOrderItem` is `buildColumnValues` plus `readCreatedItemId`; `validateOrder` is one check per rule (`nameError`, `quantityError`, `scentsError`, `inscriptionError`); the API client is `headersFor`, `toApiError` and `request`; the repository shares one `newFragrance`.
- **Comments say why, not what.** Examples: why the server listens before the database connects, why scent names are stored and not ids, why the date is local and not UTC, why duplicates are caught by an index, why auth wraps the whole router, why `/api/health` is open.

Files left as they were because they were already short and clear: `main.tsx`, `localDate.ts`, `seedData.ts` (comment trimmed), the test files.

---

## 4. Every bug found, and how

| # | Bug | How it was found | Fix | Lesson |
| --- | --- | --- | --- | --- |
| 1 | First deploy failed ("listen on port 8080") | Deploy output | Listen first, connect to the database in the background | Never block startup on a slow dependency when the platform health-checks a port |
| 2 | Retry blocked: "deployment already in progress" | Verbose push output | Poll `code:status`, then push | Killing the CLI does not cancel the remote deploy |
| 3 | "Missing or invalid session token" | Seen in the board | Set `MONDAY_SIGNING_SECRET` | Correct behavior: the guard worked |
| 4 | Order created but form showed an error ("reading 'id'") | Real order in the board; the item existed | Accept either response shape; a missing id is not a failed order | Unit tests cannot find mismatches with a live SDK; check the real board |
| 5 | Received date one day ahead in the evening | Reading the stored item back via the API | Use the local calendar day instead of UTC (`localDate`), with a test | `toISOString()` is UTC |
| 6 | Scent Profiles is a dropdown, not text | Column query | Send labels, `create_labels_if_missing` | Verify column types before writing values |
| 7 | New orders had no Status | Dashboard showed "No results" | Automation sets New Order on creation | A dashboard on a field nothing fills is empty |
| 8 | Stale server error stayed while editing | Hands-on admin test | Clear the field's error on change | Test the failure path, not only success |
| 9 | `code.tar.gz` in the repo folder | Secret scan | Git-ignore and delete | Scan the list of files git would stage |
| 10 | Oversized request body returned a misleading 500 | Edge-case test | Handle `entity.too.large` as 413 `PAYLOAD_TOO_LARGE` | Test the limits, not only the happy path |
| 11 | **Retry and Try again buttons never rendered** | Edge-case test could not find the button | `AttentionBox` ignores children when `text` is set; the button now sits beside it | A component that compiles can still silently drop what you pass it |
| 12 | Every text input had the same HTML id, so labels pointed at the wrong field | Probing the DOM while debugging a test | Give each `TextField` its own `inputAriaLabel` | Check accessibility in the rendered output, not the source |

A known side effect that was **not** fixed: monday's own "current date" in the Done automation is UTC, so a late-evening order can show a turnaround one day longer. It is documented in the README.

---

## 5. Decisions log (the "why")

| Decision | Why | Trade-off |
| --- | --- | --- |
| Document DB, not Storage or a board | Part of monday code, no extra service; connection string is automatic | Only reachable from inside monday code, which forced the seed-on-start approach |
| Orders created through the server | One place enforces the rules; the browser holds no write access | Every order needs a server round trip, and the server needs `me:read` to name the Sales Associate |
| Scent names on the order, not ids | Deleting a fragrance never breaks old orders | Renaming a fragrance later does not rename old orders |
| Uniqueness as a DB index | Race-proof | Needs the index created at connect time |
| Shared `validateOrder` | UI and server cannot disagree | Both call it; the server also checks that every scent is still in the catalogue |
| No-code automations | The customer's team can change them | Cannot use dropdown columns |
| Listen before database connects | Platform health check | Early requests wait on the connection |
| Environment variable for the signing secret | Simple, verified | Visible to app admins in the Developer Center |
| Cap at 3 scents by limiting the menu | Impossible by design | Relies on `validateOrder` as the real guard |
| In-memory fallback store | Local dev and fast tests | Data lost on restart (local only) |

---

## 6. How it was verified

| Check | Result |
| --- | --- |
| `npm run lint` (type check) | Pass |
| `npm test` | 204 tests, 12 files, all pass |
| `npm run build` | Pass |
| Local server smoke test with a signed token | Health 200, no token 401, create, duplicate 409, list, built page served |
| Live server | Health 200, fragrances without a token 401, deployed bundle matches local build |
| Live board: order placed | Item in Requests with correct person, scents, quantity, local date |
| Live board: validation | Empty names flagged; fourth scent impossible; duplicate scent impossible |
| Live admin tab | Duplicate rejected; add, edit, search, delete with confirmation |
| Automations | All three fired on a real order |
| Dashboard | Updated live on a status change |
| Secret scan of staged files | No secrets, no sensitive filenames |

What the 204 tests cover: order rules and edge cases (6 + 40), fragrance API and auth (10 + 55), seeding (1), health (1), local date (2), `POST /api/orders` against a fake monday (29), the monday client's retry and concurrency (7), order screen (2 + 27), admin screen (24).

---

## 7. File map

```
client/src/
  App.tsx            tabs: New order / Fragrances, reads the board from monday
  OrderScreen.tsx    the designer's form (ScentSection handles load/empty/error/picker)
  AdminScreen.tsx    the manager's library (FragranceList handles load/empty/error/rows)
  localDate.ts       local-calendar date helper
  api.ts             fetch with the session token on every call, including createOrder
server/
  index.ts           listen first, connect in the background, optional seeding
  app.ts             middleware, routes, static client
  auth.ts            session-token check: 401 missing, 403 invalid
  orders.ts          POST /api/orders: check, confirm scents, read user, create item
  monday.ts          monday API calls: session token, 5 in flight, 429 retry
  errors.ts          one error shape, async wrapper
  repository.ts      interface + memory + Mongo implementations
  routes/fragrances.ts
  seed.ts, seedData.ts
shared/
  fragrance.ts       fields and validation shared by client and server
  order.ts           the 3-different-scents business rule and the request type
  boardColumns.ts    real column and group IDs, used by the server
scripts/seed-fragrances.ts
docs/board-setup.md  group and column IDs, assumptions
docs/BUILD-WALKTHROUGH.md  this file
```

---

## 8. Commands you will actually use

```bash
npm install            # dependencies
npm test               # 204 tests
npm run lint           # type check
npm run build          # client into public/
npm start              # server on :8080 (memory store locally)

mapps init -l -t <your API token>                      # once; writes .mappsrc (git-ignored)
mapps code:push -i <APP_VERSION_ID>                    # deploy; takes roughly 5 to 10 minutes
mapps code:status -i <APP_VERSION_ID>                  # building-app, deploying-app, successful, failed
mapps code:env -i <APP_ID> -m list-keys                # which environment variables exist
mapps code:env -i <APP_ID> -m set -k <NAME> -v "<value>"
mapps code:env -i <APP_ID> -m delete -k <NAME>
```

---

## 9. Security notes and risks you accepted

- **Never committed:** API token (`.mappsrc`), signing secret, connection string. `.gitignore` covers them and a scan of staged files found nothing.
- **Exposure in chat:** your personal API token appeared once in a pasted message (it was not run), and your app's Client Secret was pasted in a message to set it. Anything pasted into a chat transcript should be treated as exposed.
- **Your decision:** you chose to **skip regenerating** the Client Secret. That is a legitimate risk call for a short-lived trial app, but record it. The consequence: anyone who has that chat transcript could forge a session token that your server would accept. Before sharing the app with real users, or if the transcript is ever shared, regenerate it and re-run the `mapps code:env set` command. Rotating your personal API token in the Developer Center is similarly cheap.
- **Authorization boundary:** Anything with a "send, publish, accept terms, or delete permanently" effect was left to you or confirmed first: accepting the monday code terms was yours; deleting board items moved them to the recoverable trash.

---

## 10. Not done, limits, and open questions

**Not done**

- The dashboard has one widget. Overdue orders, orders over time and turnaround would be quick no-code additions.
- No automation moves an item between groups (Requests, Working on it, Done) when status changes.
- The notify recipe targets you; point it at the real Production Manager.
- The Mongo code is verified only through the deployed app, not through automated tests.
- Concurrent catalogue edits are last-write-wins (no version check).
- Nothing is committed to git yet.

**Open questions for the company (the brief invites questions)**

1. Should Scent Profiles hold fragrance **names** or the six **categories** (Smokey, Fruity, Fresh, Floral, Herbaceous, Citrus) seen in the sample orders?
2. Is a recipe field wanted, or is `description` enough?
3. Is there a submission deadline?
4. Should the SLA dashboard be no-code (it currently is)?

---

## 11. Customer demo script

Aim for 10 to 12 minutes. Speak in outcomes first.

| Time | Section | Show |
| --- | --- | --- |
| 0:00 | Their problem | "A designer takes an order by phone, writes it down, retypes it later. The manager sees it hours late." |
| 1:00 | The outcome | "Now the order goes from the call straight into the pipeline, in under a minute, and everyone sees the same board." |
| 2:00 | Designer demo | Names, quantity, pick three scents, show a fourth is impossible, Start Order, toast |
| 4:30 | Manager demo | New item appears with status New Order, the notification, change status to Done, complete date fills |
| 6:00 | Fragrance library | Add a scent, edit, delete with confirmation; "the spreadsheet is no longer the source of truth" |
| 7:00 | Visibility | The dashboard updating |
| 8:00 | Why it scales | Per-account catalogue, no-code automations the customer can change |
| 9:00 | Next | Inventory (out of scope today), customer email or SMS, spreadsheet import |
| 10:00 | Questions | |

Say your assumptions out loud: quantity capped at 1,000 boxes, inscription capped at 80 characters, turnaround is measured from received date to complete date. Have a recorded backup in case the network fails, and clear the board of test items before presenting.

---

## 12. Code walkthrough Q&A

**Why validate on the server when the UI already blocks bad input?**
Anyone can call the API directly. The fragrance rules are enforced on the server, and so is the "exactly 3 scents" rule: `POST /api/orders` runs the same shared `validateOrder` before anything reaches the board.

**Why did the first deploy fail?**
The server waited for the database before listening, and monday code health-checks port 8080. It now listens first.

**How is the API protected?**
The browser sends a monday session token; the server verifies its signature with the app's signing secret on every fragrance request.

**What if two admins add the same scent at once?**
A unique index on the lowercased name makes the second insert fail; the server turns that into a 409 with a clear message.

**What if a fragrance is deleted after it was ordered?**
Orders store the scent names, so history stays correct.

**What was hardest?**
Two things only the live board revealed: the create-item response shape, and a UTC date. Neither shows up in unit tests.

**What would break first at scale?**
The one-document-style catalogue filtered in memory, and monday API rate limits on item creation.

**What would you do with another week?**
Inventory, customer notifications, spreadsheet import, richer reporting, automated tests for the Mongo store.

**What did you use AI for, and how did you check it?**
Scaffolding, boilerplate and first drafts of tests. Every monday-specific call was checked against the real board: column IDs read from the API playground, an order placed and read back through the API. The bugs the AI could not have known about were found by testing in the live board and fixed by hand.
