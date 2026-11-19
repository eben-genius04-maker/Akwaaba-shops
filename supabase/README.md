# Database & Supabase Setup

Multi-store commerce platform · LoneWolf Digital Technologies

## Files

| File | What it does |
|---|---|
| `migrations/20261117000001_schema.sql` | All 17 tables: stores, team, catalogue, delivery, payments, addresses, orders |
| `migrations/20261117000002_functions.sql` | Store creation, invites, delivery fees, checkout, order status, Paystack, commission |
| `migrations/20261117000003_security.sql` | Who can read/write what (privileges + Row Level Security) |
| `migrations/20261117000004_storage.sql` | Image bucket and upload rules |
| `migrations/20261117000005_phase4_catalogue_team.sql` | Phase 4: teammate emails on the Staff page, saving product photos in one step |
| `migrations/20261117000006_phase5_delivery_payments.sql` | Phase 5: keep at least one way to pay, Paystack needed for online payments, unique area names, max 50 areas |
| `migrations/20261117000007_phase6_storefront.sql` | Phase 6: `get_cart()` re-prices a shopper's cart from the database |
| `migrations/20261117000008_phase7_checkout.sql` | Phase 7: saved addresses (max 20, one default), fix for the "digital address or directions" rule |
| `migrations/20261117000009_phase8_orders.sql` | Phase 8: order counts per status and sales summary for the dashboard |
| `migrations/20261117000010_phase9_paystack.sql` | Phase 9: each store's own Paystack keys (encrypted, server-only), automatic commission split, unpaid-order clean-up (pg_cron) |
| `migrations/20261117000011_phase10_platform_admin.sql` | Phase 10: admin audit log, platform statistics, store list for the admin panel |
| `migrations/20261117000012_phase11_hardening.sql` | Phase 11: rate-limit counters (server only), extra indexes |
| `seed.sql` | Optional demo store: products, Accra delivery zones, pay on delivery |

Run the files **in number order**. Each new phase may add a file; run only the new one when upgrading.

---

## Step 1 — Start with an empty Supabase project

If you ran any of the earlier files, don't run these on top of them. Pick one:

- **Easiest:** create a **new project** at <https://supabase.com/dashboard> → **New project**
- **Or** delete the old one first: old project → **Project Settings → General → Delete project**

New project settings:
- Name: anything (you can rename later)
- Database password: strong, saved in your password manager
- Region: one close to Ghana (a European region such as London or Frankfurt is usually fastest from Accra)

Wait until the project finishes setting up (about 2 minutes).

## Step 2 — Run the migrations, in order

1. Open **SQL Editor** → **New query**
2. Open `20261117000001_schema.sql` in VS Code → copy all → paste → **Run**
3. New query, then do the same for `…02`, `…03`, `…04`, `…05`

Each should end with **"Success. No rows returned"**.
If any file shows an error, stop there and send me the full error message.

## Step 3 — Check it worked

Run this in a new query:

```sql
select count(*) as tables, bool_and(rowsecurity) as all_protected
from pg_tables where schemaname = 'public';
```

You should see **tables = 17** and **all_protected = true**.

## Step 4 — Auth settings

**Authentication → Sign In / Providers → Email**

- Email provider: **On**
- Allow new users to sign up: **On** (store owners, staff and customers all sign up)
- Confirm email: **On**

Site URL and redirect URLs come in Phase 3.

## Step 5 — Create your account and make yourself platform admin

1. **Authentication → Users → Add user → Create new user**: your email and a password, tick **Auto Confirm User**
2. SQL Editor, replace the email, run:

```sql
update public.profiles
set is_platform_admin = true
where id = (select id from auth.users where email = 'you@example.com');
```

It should say **1 row affected**. Only the SQL Editor can do this — the app can never make anyone platform admin.

## Step 6 — (Optional) Demo store

Open `seed.sql`, change `you@example.com` to your email, run it. You get a live store at slug `demo` with 6 products, 5 Accra delivery zones and pay on delivery switched on — handy for testing the storefront later.

## Step 7 — Save your credentials

**Project Settings → Data API** (URL) and **Project Settings → API Keys**

| Credential | Needed from | Where it's used |
|---|---|---|
| Project URL `https://xxxx.supabase.co` | Phase 3 | App (browser + server) |
| Publishable key `sb_publishable_…` (or legacy **anon** key) | Phase 3 | App (browser + server). Safe: the security rules protect the data |
| Secret key `sb_secret_…` (or legacy **service_role** key) | Phase 9 | **Server only:** Paystack webhook, starting a payment, order expiry job. Never in browser code, never in a `NEXT_PUBLIC_` variable, never on GitHub |

---

## What's in the database

### Checkout
- Customer gives name, phone, email (required only for pay now), and the delivery location: **phone GPS pin**, plus a **digital address** and/or **directions for the rider** (at least one).
- **Delivery fee** — each store picks one method and sets its own prices:
  - **Zones**: customer picks their area, fee is the store's price for that zone
  - **Distance**: base fee + price per km from the store's pickup point (straight-line distance × 1.3 for roads, adjustable), with a maximum range
  - Plus an optional surcharge for medium/large items and free delivery above an amount
- **Payment**: pay on delivery (store can switch off or set a maximum) or pay now through Paystack.
- On placing the order, stock is reserved immediately and the customer gets an order number (#1001, #1002 … per store) and a **tracking link**.

### Orders
`pending → confirmed → (processing) → out for delivery → delivered`, or `cancelled` at any step before delivery (stock goes back).
- Prepaid orders can't be confirmed until paid, and auto-cancel if unpaid after 30 minutes.
- Pay-on-delivery orders become "paid" when marked delivered.
- The store can correct the delivery fee before confirming.
- Notes added at each step appear on the customer's tracking page.

### Payments and commission
- Each store connects **its own Paystack account** (Phase 9). Customers pay straight into it. The secret key is encrypted by the app before it's saved, and only the server can read it (`store_paystack_keys` has no access for anyone else). Owners see only test/live mode and the last 4 characters.
- **Platform commission: 1%** of every online payment. On connecting, the server creates an "Akwaaba Shops commission" subaccount inside the store's Paystack that settles to your bank/MoMo, and every payment is split to it. You can change the rate per store (e.g. a launch promo) with `set_store_platform_fee()`. The store pays Paystack's own processing fee, not you. If the store edits or deletes that subaccount, online payments pause until it's restored.
- Payments are matched by reference and exact amount. Duplicate or late payments are flagged "refund due".

### Customers
- One account works across every store; each store still has its own branded storefront.
- Saved addresses (with GPS pin) are private to the customer. Guests just use the tracking link.

### Who can do what

| Action | Owner | Manager | Staff | Public |
|---|:-:|:-:|:-:|:-:|
| See active products, categories, store info | ✓ | ✓ | ✓ | ✓ |
| See hidden products and draft categories | ✓ | ✓ | ✓ | |
| Add/edit products, upload product photos | ✓ | ✓ | ✓ | |
| Delete products; manage categories | ✓ | ✓ | | |
| View orders; confirm, dispatch, mark delivered | ✓ | ✓ | ✓ | |
| Cancel orders; change delivery fee | ✓ | ✓ | | |
| Delivery zones and prices | ✓ | ✓ | | |
| View payment records | ✓ | ✓ | | |
| Payment settings, connect Paystack | ✓ | | | |
| Store settings, logo, WhatsApp number | ✓ | | | |
| Invite/remove staff, change roles | ✓ | | | |

**Platform admin (you):** sees every store, its orders and payments; approves/suspends stores; sets commission. Cannot edit a store's products or move its orders.

### Built-in safety rules
- New stores are **pending** and invisible to the public until you approve them.
- Prices, delivery fees and totals are always calculated by the database; the browser can't change them.
- Two customers can't buy the last item — stock is locked while an order is placed.
- Max 3 unconfirmed orders per phone number per store per day (stops fake-order spam).
- Every store's data is separated: products, orders, files and team are invisible to other stores.
- A store always keeps at least one owner. Invitations expire after 7 days, work once, and only for the invited email.

## Tested

Run on PostgreSQL 16 with a simulated Supabase (including its automatic permissions on new tables):
- **83 tests** — stores, approvals, roles, catalogue, invitations, storage, cross-store isolation
- **119 tests** — delivery fees, checkout validation, stock, order lifecycle, every role's order permissions, customer privacy, Paystack flows, 1% commission
- **Race test** — two customers ordering the last item at once: one gets it, the other sees "out of stock"
- **22 tests** (Phase 5) — delivery settings and area permissions per role, duplicate/limit rules, payment rules
- **11 tests** (Phase 6) — cart pricing, stock problems, hidden products, pending-store privacy
- **12 tests** (Phase 7) — saved addresses: defaults, limits, privacy, directions rule
- **6 tests** (Phase 8) — order counts and sales summary per role, cancelled/old orders excluded
- **23 tests** (Phase 9) — keys hidden from everyone but the server, connect/disconnect, 1% commission, broken-split pause and repair
- **22 tests** (Phase 10) — admin-only access, statistics, store list/search, audit log of approvals/suspensions/commission
- **13 tests** (Phase 11) — automated security audit (RLS everywhere, public functions/tables allow-list, locked columns, server-only payment functions) and rate limiter
- **Demo seed** runs cleanly and is safe to run twice
