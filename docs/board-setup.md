# Board setup

Board: **Production Orders**, ID `18437897186` (API version `2026-10`).
Read with the API playground: `{ boards(ids: 18437897186) { groups { id title } columns { id title type } } }`

## Groups

| Title | ID | Moved to by |
| --- | --- | --- |
| Request | `topics` | New orders (the app writes here) |
| Working On It | `group_title` | Status changes to Working On It |
| Done | `new_group` | Status changes to Done |

## Columns

| Title | ID | Type | App writes it? |
| --- | --- | --- | --- |
| Name | `name` | name | Yes, "Order - First Last (N Kits)" |
| Sales Associate | `person` | people | Yes, the user from the session token (or monday's `me`) |
| Inscription Request | `text5` | text | Yes, optional |
| Status | `status` | status | No, set to Request on creation by an automation |
| Fragrance Profile | `dropdown` | dropdown | Yes, the categories of the 3 scents, each once |
| Order Details | `order_details` | long text | Yes, one "• scent" bullet per line |
| Order ID | `item_id` | item_id | No |
| Quantity | `numbers` | numbers | Yes |
| Order Received Date | `date_1` | date | Yes, the designer's local day |
| Order Complete Date | `date_13` | date | No, set by an automation on Done |
| Order Turnaround | `formula` | formula | No |
| Time Tracking | `time_tracking` | time tracking | No, started and stopped by automations |
| Client First Name | `text` | text | Yes |
| Client Last Name | `text6` | text | Yes |
| Client Shipping Address | `location` | location | No |
| Client Email | `email` | email | No |
| Client Phone | `phone` | phone | No |

Status labels: **Request**, **Working On It**, **Done**, plus monday's default **Stuck** and the grey default label.

## Automations

1. When an item is created, set Status to **Request**.
2. When an item is created, notify the account owner (point it at the Production Manager).
3. When Status changes to **Working On It**, start Time Tracking and move the item to **Working On It**.
4. When Status changes to **Done**, stop Time Tracking and move the item to **Done**.
5. When Status changes to **Done**, set Order Complete Date to today.

## Webhook

None. The PDF's SLA webhook (§3.3) is an open gap. The Time Tracking and Done automations cover the SLA on the board.

## Assumptions

- Fragrance Profile holds categories (Smokey, Fruity, Fresh, Floral, Herbaceous, Citrus). The old Scent Profiles column held scent names; the labels for those names remain on the board, unused.
- Order Details is a long text column with a 2,000 character limit. Orders hold at most 3 scents, so it never comes close.
