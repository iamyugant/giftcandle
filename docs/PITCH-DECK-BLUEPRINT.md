# Candle Production Pitch: deck blueprint (Part A)

Ten slides, 16:9, following monday.com's pitch-deck structure (cover, introduction, problem, solution, proof of progress, trust, business case, call to action):

1. Cover (slide 1 below)
2. Introduction (new: what the app is and who uses it)
3. The problem (slide 2 below)
4. Solution: the rules (slide 3)
5. Solution: how it works (slide 4)
6. Solution: the Order Maker (slide 5)
7. Proof of progress (slide 9)
8. Trust and security (slide 6)
9. Business case (slide 8, sample data)
10. Call to action, with contact placeholder (slide 10)

Not included: a team slide and financial projections, because the material for them doesn't exist yet. The handoff slide (slide 7 below) was dropped, since the flow on slide 4 covers it. The competition slide was optional and is omitted. Palette (light, from monday's Vibe design system in this project): background #ffffff, surface #eceff8, text #323338, secondary text #676879, accent monday Blue #0073ea for interactive and headings, warm accent monday Gold #ffcc00 for bullets and highlights, status colours #66CCFF (Request), #FDAB3D (Working On It), #00C875 (Done). The article has no colour guidance, so these come from monday's design system. Type: Fraunces for titles, Inter for body.

Rules applied: no more than three points per slide, bold lead-ins, and a visual blueprint for every slide. Every claim on a slide is either something the app does today (verified on the live board or by the 210 tests) or is labelled as a pilot target.

---

## Slide 1: Title and hook

- **Title:** From Craft to Scale: Artisanal Corporate Gifting on monday.com
- **Subtitle:** How modern enterprise gift box production moves at the speed of business.
- **Chips:** Exactly 3 scents per box · Built inside monday.com · Made to order

**Speaker notes:** Open with the client's problem: a custom gift box that has to be exactly right. Frame the app as bringing that craft into one system that moves at business speed.

**Visual blueprint:** Full-bleed Deep Indigo. A soft amber radial glow in the upper right. A flame icon, then the eyebrow in monday Blue, the title in large serif, the subtitle, and three outlined chips in a row. Nothing else.

---

## Slide 2: The status quo

- **Eyebrow:** The status quo
- **Title:** Clients expect instant turnaround. Production runs on paper.
- **Points:**
  - **Double entry:** orders are written on paper, then retyped for production.
  - **Lost detail:** inscriptions and scent choices get transcribed by hand.
  - **No visibility:** sales and floor managers cannot see where an order stands.

**Speaker notes:** Walk through the paper-to-spreadsheet path. Ask how many orders a month are retyped or corrected.

**Visual blueprint:** Split layout. Left column holds the three points. Right column holds two stacked cards. The top card, amber-bordered, is "The manual friction" with phone orders, paper notes and disconnected spreadsheets. The bottom card, blue-bordered, is "Client expectations" with instant turnaround, live order status and no re-typing. Each row has a small monday Blue icon.

---

## Slide 3: The operating rules

- **Eyebrow:** The operating rules
- **Title:** Three non-negotiables shape every box
- **Subtitle:** Generic carts cannot enforce these rules. This app does.
- **Pillars:**
  - **Exactly 3 scents:** each box holds three different fragrances. Two, four or a repeat is rejected before anything is produced.
  - **Made to order:** no pooled batches and no stock on shelves. Every order is produced on its own.
  - **Personal inscriptions:** every box can carry a bespoke message of up to 80 characters.

**Speaker notes:** These rules are why generic tools break. The app encodes them, rather than working around them.

**Visual blueprint:** Three equal cards across the middle of the slide, each with an amber icon (layers, package-open, pen-line), a serif heading and two lines of body text. The subtitle sits under the title.

---

## Slide 4: The pivot

- **Eyebrow:** The pivot
- **Title:** One workspace from client request to production
- **Points:**
  - **Native:** runs inside monday.com Work Management, with nothing extra to install.
  - **Validated:** the 3-scent rule is checked before anything is written.
  - **Connected:** each order lands on the production board the moment it is submitted.

**Speaker notes:** Point to the single board. Everything after this slide lives in the same place.

**Visual blueprint:** A horizontal flow of four cards with arrows between them: Client request → Order Maker (board view, validated) → Production board (Request, Working On It, Done) → Candles made (each box produced on its own). Points sit below the flow.

---

## Slide 5: Frictionless intake (Order Maker)

- **Eyebrow:** Frictionless intake
- **Title:** Assemble an order in seconds, inside monday.com
- **Points:**
  - **Locked at three:** once three scents are chosen, the menu offers only those.
  - **Instant search:** type a scent name. The catalogue covers six families, from Citrus to Smokey.
  - **Familiar look:** built with monday's Vibe design system, so it feels native.

**Speaker notes:** Demo moment. Choose three scents, show the locked menu, then submit. Point out the live counter.

**Visual blueprint:** Left column holds the points. Right column has an annotated mock-up of the Order Maker: first name, last name and quantity fields; three scent chips; the amber counter line "3 of 3 chosen"; the inscription field; the character and box counter; and a monday Blue "Start Order" button. Under the mock-up, three numbered amber callouts: 1 Locked at three, 2 Live counter, 3 One click to send.

---

## Slide 6: Native architecture

- **Eyebrow:** Native architecture
- **Title:** Hosted on monday-code, with no external cloud
- **Points:**
  - **No external cloud:** the app runs on monday-code. No AWS, GCP or Azure.
  - **Identity on every request:** each call is checked against the caller's short-lived monday session.
  - **Rules on the server:** the server re-checks each order before it is written to the board.

**Speaker notes:** For IT and security. No external cloud, identity checked on every request, and the rules enforced on the server.

**Visual blueprint:** Left column holds the points. Right column is a vertical three-tier stack with arrows: monday Board context (the Order view opens inside the board), React frontend on Vibe (Order Maker and the fragrance library), and monday-code backend (REST API, rules and order writes, with the library in monday's Document DB).

---

## Slide 7: Automated handoff

- **Eyebrow:** Automated handoff
- **Title:** From request to done, without the back-and-forth
- **Points:**
  - **Automatic moves:** a status change moves the item and starts or stops the timer.
  - **Notified at once:** each new order sends a notification to its owner.
  - **One source of truth:** the board shows every order's stage to everyone.
- **Stages:**
  - **Request:** new order created, notification sent.
  - **Working On It:** item moves, time tracking starts.
  - **Done:** item moves, timer stops, complete date set.

**Speaker notes:** Show how one status change moves the work and starts or stops the timer.

**Visual blueprint:** Left column holds the points. Right column is three stage cards side by side, each with a pill in monday's own status colours (light blue for Request, orange for Working On It, green for Done), an icon and two lines of what happens.

---

## Slide 8: Visibility and SLA

- **Eyebrow:** Visibility and SLA
- **Title:** Turnaround and pipeline on one executive dashboard
- **Points:**
  - **Cycle time:** Done minus Working On It, measured by the board's timer.
  - **Pipeline at a glance:** orders by status, updated as the floor moves them.
  - **Turnaround per order:** days from received to complete, on every item.

**Speaker notes:** The bars and counts here are sample data. The status chart is live on the board today; the other widgets are configured during the pilot.

**Visual blueprint:** Left column holds the points. Right column: a row of four KPI cards (Open, Producing, Done, Avg days), and an "Orders by status · sample data" bar chart in the three status colours.

**Before presenting:** the KPI cards are illustrative. Only the status chart exists on the live board. Either build the other widgets, or keep the "Sample data" tag visible.

---

## Slide 9: Measured impact

- **Eyebrow:** Measured impact
- **Title:** What is proven today, and what the pilot will measure
- **Stats:**
  - **207**: automated tests covering order rules, access and catalogue changes. Passing on the current build.
  - **0**: retyping steps. The order goes straight from the form to the board. Confirmed on live orders.
  - **[X]%**: reduction in order-to-production cycle time. Not yet measured; set the baseline together in the pilot.

**Speaker notes:** Only the test count and the zero-retyping point are proven today. The cycle-time reduction is the pilot's job; agree the baseline with the client.

**Visual blueprint:** Three equal stat cards in a row. Each has a large serif number (blue, green, amber), a short label, and a grey note line.

**Changed from the brief:** the brief's "0% transcribing errors", "65% reduction" and "100% visibility" are not measured anywhere. They are replaced with the figures above. Put the real 65% back only after the pilot measures it.

---

## Slide 10: Summary and next steps

- **Eyebrow:** Next steps
- **Title:** One workspace for designers, makers and leadership
- **Steps:**
  - **Week 1, setup:** load your fragrance catalogue and categories once.
  - **Weeks 2 and 3, pilot:** one designer team takes live orders.
  - **Week 4, review:** compare cycle time and order accuracy with your baseline.

**Speaker notes:** Close on the pilot. Confirm the dates, and who owns the fragrance catalogue on the client side.

**Visual blueprint:** Left column holds the steps. Right column is a call-to-action card with a rocket icon, "Ready for a pilot?", one line on scope, and a monday Blue "Start the pilot" button.

---

## Claims changed from the brief, and why

| Brief said | Deck says | Reason |
| --- | --- | --- |
| 0% transcribing errors | 0 retyping steps, confirmed on live orders | Only the flow is measured; error rates are not |
| 65% reduction in cycle time | [X]%, to be measured in the pilot | No baseline exists to support 65% |
| 100% visibility | Pipeline visible on one board | "100%" overstates what a board shows |
| Real-time floor alerts | A notification to the order's owner | The app sends a notification per new order; floor alerts are not built |
| Artisan capacity on the dashboard | Not shown | Not built |
| Enterprise-grade security | Identity checked on every request; rules enforced on the server | Describes what is built, without an unverified certification claim |
| Olfactory families: Herbaceous, Fruity, Fresh | Six families, Citrus to Smokey | The catalogue has six categories |
| "Order Maker" view name | "Order Maker" on slides | The live tab is called "Order"; rename the tab to match |

## Checklist status (preparing a deck, 2026)

| Item | Status | Note |
| --- | --- | --- |
| Cover with company name and tagline | Partly | Tagline and "monday.com" shown; no company name yet |
| Problem statement backed by data | Partly | Qualitative only; no client data on the problem yet |
| Solution and value proposition | Done | Slides 3 to 6 |
| Market size and opportunity | Missing | No market data available |
| Business model and revenue | Missing | Customer deck; add if the pitch is commercial |
| Traction metrics and milestones | Partly | 210 tests and live orders; the cycle-time figure is a placeholder |
| Competition analysis | Missing | Not on any slide; could go on slide 4 |
| Team introductions | Missing | Needs names and experience |
| Financial projections | Missing | Needs real figures |
| Funding ask and use of funds | Partly | "Start the pilot" is the ask; no budget yet |
| Contact information on the final slide | Placeholder | Needs real details |
| Consistent branding | Done | monday light palette, Fraunces and Inter |
| High-quality visuals | Done | Diagrams and the Order Maker mock-up |
| Readable font sizes (30pt minimum) | Not met | Body is about 20pt; meeting 30pt means roughly half the words per slide |
| One key message per slide | Mostly | Slide 4 carries three points and a flow |
| Charts and data visualizations | Done | Sample data only on the business case slide |
| Slide numbers | Done | Bottom right of every slide |
| Works on multiple devices | Not verified | 375px check was inconclusive; the browser did not reflow the artifact |
| Links and media work | Done | No external links or media |
| Exported as PDF | Not done | The deck is a web page; print and PDF export are not available from the artifact |
| File size under 10MB | Done | About 27KB of source |
| Animations load | Done | Only a progress bar moves; reduced motion is honoured |
| Backup copy in multiple places | Done in repo | Source copied to `docs/pitch-deck.html`; the artifact is the live copy |
| No typos | Checked | Copy re-read during the audit |
| Data current and accurate | Partly | Placeholders and sample data remain; see above |
| Under 20 minutes | Likely | Ten slides with short notes |
| Practice at least twice | User | Speaker notes are on each slide |
| Answers to common questions | Drafted below | |

## Likely questions, with answers from the built app

- **Is it finished?** The order flow is live on the production board. Five test orders and a sixth check order were placed and read back, and automations move orders through Request, Working On It and Done.
- **What if a scent is deleted after a designer loads the list?** The server checks every scent before writing the order and refuses the order if one is gone.
- **Who can see customer data?** The app runs inside monday.com. Access follows the board's permissions, and the server checks the identity of every request.
- **Does it need external hosting?** No. It runs on monday code, and the fragrance library is stored in monday code's document database.
- **How long will a pilot take?** The proposed plan is two weeks of setup and pilot, then a review in week four. The timeline is a proposal, not a commitment.
- **What about the 48-hour target?** It is not enforced. Time tracking records the elapsed time, and the turnaround column shows days.
