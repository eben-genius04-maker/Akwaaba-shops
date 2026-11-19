# Akwaaba Shops

Multi-store online shopping platform for Ghana: storefronts, delivery by zone or distance, pay on delivery or MoMo/card, order tracking.
A product of LoneWolf Digital Technologies.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Auth, Postgres, Storage) · Vercel

---

## Progress

| Phase | What | Status |
|---|---|---|
| 2 | Database (`supabase/migrations` 1–4) | ✅ |
| 3 | Sign up, log in, create store, dashboard shell, store addresses | ✅ |
| 4 | Store settings, categories, products with photos, staff & invitations (`migration 5`) | ✅ |
| 5 | Delivery & payment settings (`migration 6`) | ✅ |
| 6 | Storefront & cart (`migration 7`) | ✅ |
| 7 | Checkout, order tracking, customer accounts (`migration 8`) | ✅ |
| 8 | Orders dashboard (`migration 9`) | ✅ |
| 9 | Paystack: each store's own account + automatic 1% commission (`migration 10`) | ✅ |
| 10 | Platform admin panel (`migration 11`) | ✅ |
| 11 | Testing & hardening (`migration 12`) | ✅ |
| 11b | Dark mode, Adinkra patterns, show-password, admin & Paystack polish | ✅ this version |
| 12 | Deployment (Vercel, domain, live keys, emails) | next |

## Upgrading from Phase 11

No database changes this time. Unzip, copy `.env.local` into the new folder, then `npm install` and `npm run dev`.

## Your platform admin account

There's no separate admin sign-up, on purpose: an admin page anyone could find would be a target.

1. **Sign up normally** at `/signup` with your own email, like any user.
2. In Supabase → **SQL Editor**, run once:
   ```sql
   update public.profiles set is_platform_admin = true where email = 'you@example.com';
   ```
3. **Log in.** If you don't own a store, you land straight in the admin panel (`/platform`). If you do, use the **Platform admin** link in your dashboard menu or on **My account**.

To add another admin later, run the same line with their email. To remove one, set it to `false`.

---

## Phase 11b — what's included

- **Show/hide password:** an eye button on every password box (log in, sign up, new password, confirm password, and the Paystack secret key).
- **Dark mode:**
  - a theme button cycles **Auto → Light → Dark**
  - it's in the dashboard menu (next to log out), the admin header, My account, the log-in and sign-up pages, and the shop header (on phones: the shop footer)
  - *Auto* follows the phone or computer setting, including when it switches at night
  - the choice is remembered, with no white flash when pages open
  - every colour pair was checked for readability, and dark mode passed the accessibility scan
  - shops keep their own brand colour
- **Adinkra heritage patterns:**
  - a soft repeating pattern of Akan Adinkra symbols behind the dashboard, admin panel, account, log-in and sign-up pages, and in each shop's footer
  - the symbols: **Gye Nyame** (except for God), **Sankofa** (learn from the past), **Adinkrahene** (chief of the symbols), **Dwennimmen** (humility and strength), **Akoma** (patience), **Nsoromma** (child of the heavens), **Nkyinkyim** (adaptability) and **Mpatapo** (reconciliation)
  - drawn as simple line versions, very faint in both themes, so it never competes with the content; it isn't printed
  - the log-in page explains what the symbols mean
- **Paystack, easier to find and check:**
  - **Settings** now has an *Online payments (Paystack)* card that opens the Payments page, where the Public and Secret key boxes are
  - when keys are saved, Paystack confirms they're real **and** that the account takes **cedis (GHS)**; a Nigerian or other non-GHS account is refused with a clear message
  - **Check connection** re-checks the keys and the commission split at any time
  - if the platform's Paystack settings are missing on the server, **you (as admin)** see exactly which settings to add; store owners just see "coming soon"
  - *Note:* Paystack's API doesn't return the business name for a key, so we show test/live mode and the Ghana (GHS) confirmation instead
- **Forgot password** was already there: **Log in → Forgot password?** emails a reset link that opens the "New password" page (now with the eye button too). Until Resend is connected in Phase 12, Supabase's built-in email service sends these, and it allows only a few emails per hour.

### Checklist

1. On the log-in page, type a password and tap the 👁 eye: you can see it. Tap again to hide it.
2. Tap the theme button (top right) until it says **Dark theme**. Reload: it stays dark. Open the dashboard: dark, with the Adinkra pattern behind.
3. Set your phone to dark mode and open the site with the theme on **Auto**: it follows the phone.
4. **Settings** → *Online payments (Paystack)* → paste your **test** keys → **Connect Paystack**. You see "Your keys are real and the account takes cedis (GHS)". Then tap **Check connection**.
5. Make yourself admin (above), log out, log in: you land in `/platform`.

---

## Phase 11 — what's included

**Security review**
- An automated **database security audit** now runs with the tests. It fails if a future change ever:
  - leaves a table without row-level security
  - lets the public call anything other than the shop, checkout and tracking functions
  - lets the public write to any table
  - lets anyone edit the admin flag, store status, commission, Paystack link or order money directly
  - makes payment functions callable from the browser
- All 41 server actions were reviewed: every one checks who's asking before doing anything.
- Dependency audit: **0 known vulnerabilities**.

**Abuse limits** (counted in the database, so they work across all Vercel servers; no emails or IP addresses are stored, only scrambled keys)

| What | Limit |
|---|---|
| Wrong passwords | 8 per account and 20 per device, per 15 minutes |
| Sign-ups | 10 per device per hour |
| Password-reset / confirmation emails | 3 per email, 10 per device, per hour |
| Placing orders | 15 per device per 10 minutes (plus the existing 3 waiting orders per phone) |
| Cart and delivery-fee checks | 120 per device per minute |
| Creating stores | 5 per person per day |
| Staff invitations | 30 per store per day |
| Connecting Paystack | 10 per store per hour |

**Security headers** on every page: no embedding in other sites (stops clickjacking), no MIME sniffing, private referrers, location only for our own map, HTTPS enforced in production, and the server software is no longer advertised.

**Friendly errors**
- "Something went wrong · Try again" pages for the whole site, inside the shop (keeps the store's look; the cart is safe) and inside the dashboard (keeps the menu)
- Plus a last-resort page if everything fails

**Search engines and monitoring**
- `robots.txt` lets Google list shops and products but not dashboards, checkout, orders or accounts
- `/api/health` for an uptime monitor (e.g. UptimeRobot, free)

**Accessibility (checked with axe on a phone-sized screen, 16 key pages, 0 serious problems)**
- **Skip to content** link for keyboard users
- WhatsApp buttons and one gold button made darker or fixed, so their text is readable for people with low vision
- Photo upload buttons labelled for screen readers; product photos have proper link names
- **Fix:** style overrides (e.g. a red "Disconnect" button, gold "Sign up" button) now always win over the default button colours

**Speed:** extra database indexes for the admin pages, payment look-ups and order search.

### Phase 11 test checklist

1. **Login limit:** log out, then enter the wrong password 9 times for your account. You see "Too many login attempts. Please wait 15 minutes". Wait, or use another account.
2. **Headers:** on any page, open DevTools (F12) → Network → click the page → Response Headers. You see `X-Frame-Options: DENY`.
3. Open `http://localhost:3000/robots.txt` and `http://localhost:3000/api/health` (shows `{"ok":true}`).
4. On a shop page, press **Tab** once: a "Skip to content" button appears top-left.
5. Click around everything once more on your phone (connect to `http://<your computer's IP>:3000` on the same Wi-Fi), and tell me anything that looks off before we deploy.

---

## Phase 10 — what's included

The admin panel is at **`/platform`**, for platform admins only. Anyone else gets "Page not found", and logged-out visitors are asked to log in. If you also own a store, your dashboard menu has a **Platform admin** link.

- **Overview:**
  - stores waiting for approval (with a shortcut to each)
  - money for the last 30 days: your commission, paid online, order value
  - activity: orders today, 7 and 30 days; live, waiting and suspended stores
  - Paystack connections: live, test, paused; and the number of customer accounts
- **Stores:**
  - tabs for Waiting, Live, Suspended and All
  - search by store name, address or owner email
  - each row shows owner, products, orders, Paystack status and commission rate
- **Store page:**
  - **Approve**: the store goes live and customers can see it and order
  - **Suspend** (with a reason): the store is hidden and stops taking orders. The owner can still log in and sees your reason on their dashboard.
  - **Reactivate** a suspended store
  - **Commission:** set this store's rate (0–20%, e.g. a 0% launch promo); it applies to new online payments
  - contact details, team, products, totals, latest orders, Paystack health, and the store's **admin history**
- **Orders:** every order on the platform, read-only, for support. Search by customer phone, name or order number.
- **Payments:** every online payment with the commission it earned, with totals.
- **Activity:** a permanent log of every approval, suspension and commission change, with who did it and when.

**Security:** every admin action is checked again by the database, not just hidden in the page. Nobody can make themselves an admin through the app; it can only be done in the Supabase SQL Editor.

**Also fixed:** the "(2) Orders" count in the browser tab could disappear when the orders list refreshed itself.

### Phase 10 test checklist

1. Make yourself admin (step 2 above) and open `/platform`.
2. In another browser (or incognito), sign up as a new seller and create a store. It shows "Waiting for approval".
3. In `/platform`, the overview shows "1 store is waiting for approval". Open it.
4. **Approve store** → the seller's dashboard now says live, and the storefront opens for everyone.
5. Set **Commission** to `0.5` and save.
6. **Suspend store** with a reason → the storefront shows "Page not found", and the seller's dashboard shows your reason. Then **Reactivate store**.
7. Check **Activity**: all three changes are listed with your name.
8. As the seller, try opening `/platform`: "Page not found".

---

## Paystack setup (platform owner, one time)

Each store connects **its own** Paystack account. You only set up where **your** commission goes. Add these to `.env.local` now, and to Vercel later (Phase 12). They are secret, so never put `NEXT_PUBLIC_` in front of them.

| Setting | What to put |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → **service_role** (secret) key |
| `PAYSTACK_KEYS_ENCRYPTION_KEY` | Run `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` once and paste the result. **Back it up.** If it's lost, every store must re-enter its keys. |
| `PLATFORM_PAYSTACK_SETTLEMENT_BANK` | The Paystack code for where your commission is paid: a bank code or a mobile-money code (e.g. `MTN`). The full list is at `https://api.paystack.co/bank?currency=GHS` (needs any Paystack secret key). |
| `PLATFORM_PAYSTACK_ACCOUNT_NUMBER` | Your bank account number, or MoMo number like `0241234567` |
| `CRON_SECRET` (optional) | Any long random text; protects the backup clean-up link |

Until the first four are set, stores see "Online payments aren't switched on yet" and keep using pay on delivery.

---

## Phase 9 — what's included

**For store owners (Payments page)**
- **Connect Paystack:** paste the **Public** and **Secret** key from the store's own Paystack dashboard (Settings → API Keys & Webhooks).
  - test keys to try it, live keys to sell; the two can't be mixed
  - the keys are checked with Paystack before they're saved
- **Security:**
  - the secret key is **encrypted** (AES-256-GCM) before it's stored
  - only the server can read it: not the owner, not staff, not the browser
  - afterwards the owner only ever sees "key ending …ab12"
- **Your 1%:** connecting automatically creates a subaccount called **"Akwaaba Shops commission"** inside the store's Paystack, paying out to your account. On every online payment:
  - the store keeps 99% and pays Paystack's processing fee from its share
  - **1% goes to you** (or the store's own rate if the platform admin changes it)
- **Webhook link** to paste into the store's Paystack, with "last message received" shown. Payments are confirmed even if the customer closes the page.
- **Tamper protection:**
  - the server re-checks the commission subaccount every few hours, and after every payment
  - if it was edited or deleted, online payments pause, pay on delivery switches on, and the owner sees **Restore commission split**
- **Replace keys** (e.g. test → live) and **Disconnect** (keys deleted)

**For customers**
- Checkout offers **Pay now with MoMo or card** (email required for the receipt), then sends them to Paystack and back.
- The tracking page asks Paystack for the real result, never trusting the address bar:
  - *Payment received*, or *Your payment didn't go through* with a **Pay now** button to retry
- Online orders must be paid within **30 minutes**, otherwise they're cancelled automatically and the stock goes back.

**For the store's team**
- Unpaid online orders show **Awaiting payment** and can't be confirmed until paid.
- Paid ones show **Paid**.

### Phase 9 test checklist (Paystack test mode)

1. Create a free Paystack account if you don't have one (test mode works before your business is verified).
2. Fill in the **Paystack setup** settings above and restart the app.
3. **Payments** → paste your **test** Public and Secret keys → **Connect Paystack**. You see "Connected · Test mode" and "key ending …".
4. In your Paystack dashboard → **Settings → Subaccounts**, you see "Akwaaba Shops commission".
5. Copy the **webhook link** into Paystack → Settings → API Keys & Webhooks → **Test Webhook URL**. Note: on your computer (`localhost`) Paystack can't reach the webhook; it starts working after deployment. Payments are still confirmed when the customer returns.
6. Turn on **Accept MoMo and card payments** and save.
7. As a customer, check out with **Pay now with MoMo or card** and your email. On Paystack's test page, pay with a test card (e.g. `4084 0840 8408 4081`, any future date, CVV `408`) or the test MoMo option. You come back to "Payment received".
8. In the dashboard the order shows **Paid**. In Paystack → Transactions, the payment shows the split to the commission subaccount.
9. Try again but cancel on Paystack's page: the tracking page offers **Pay now**.

> I tested all of this against a stand-in for Paystack, because my test machine can't reach Paystack's servers. The calls follow Paystack's documented API, but **please run steps 3–8 with your real test keys**, and tell me if Paystack shows any error (especially when creating the commission subaccount, which depends on the bank/MoMo code you set).

---

## Phase 8 — what's included

- **Orders page:**
  - tabs for New, In progress, Delivered, Cancelled and All, each with a count
  - search by order number (`1002` or `#1002`), phone (any format) or name
  - new orders are highlighted; 30 per page
- **Order page:**
  - one big button for the next step: **Confirm order** → **Start preparing** → **Out for delivery** → **Delivered and paid**
  - optional message to the customer with each step (shown on their tracking page)
  - **Cancel order** (owners and managers) asks for a reason, puts the stock back and tells the customer
  - **Change delivery fee** before confirming (owners and managers), e.g. when a customer picked the wrong area. The customer sees the new total and your reason.
  - customer: call or WhatsApp in one tap, with their note highlighted
  - delivery: address, area or km, **Directions in Google Maps** (if they dropped a pin)
  - **Copy for rider / Send to rider:** a ready-made WhatsApp message with name, phone, address, map link, items and the amount to collect
  - **Team notes** that only your team sees, a history showing who changed what, and **Print**
- **New-order alerts** while any dashboard page is open (checked every 20 seconds):
  - a pop-up with **View**, a chime, the count in the browser tab, e.g. "(2) Orders"
  - a badge on **Orders** in the menu
  - **Sound on/off** and **Pop-ups on/off** (pop-ups also show when the dashboard tab is in the background)
- **Overview:** "N new orders waiting" banner, orders today, sales today, last 7 days, delivered in 30 days, and the latest orders. Staff see order counts but not money figures.
- **Rules come from the database:** the allowed steps, who can cancel, and when the fee can change are all checked there, not just hidden in the page.

### Phase 8 test checklist

1. Place 2–3 orders from your store (use incognito windows, with different phone numbers).
2. Open the dashboard: the overview says "3 new orders waiting" and **Orders** has a badge.
3. **Orders:** search `#1002`, then a customer's phone number, then a name.
4. Open an order, tap **Add a message for the customer**, type something, then **Confirm order**. Open the customer's tracking page: it shows *Confirmed* and your message.
5. Continue: **Start preparing → Out for delivery → Delivered and paid**.
6. On another order, tap **Change delivery fee**, set 35 with a reason, and save: the total changes.
7. Tap **Send to rider**: WhatsApp opens with the delivery details.
8. Cancel a third order: it asks for a reason, and the product's stock goes back up.
9. **Alerts:** keep the Orders page open, tap **Sound on** once, then place a new order from your phone. Within about 20 seconds you see "New order #…", hear a chime, and the badge updates.
10. Log in as a Staff member: they can move orders forward but can't cancel or change fees, and the overview hides money.

> Alerts work while the dashboard is open in a browser tab. Notifications when the dashboard is closed (SMS/email/WhatsApp) come later with Resend in Phase 12.

---

## Phase 7 — what's included

- **Checkout** (`/checkout` in every store), in 3 steps with a live order summary:
  1. **Your details:** name, phone (any Ghana format) and optional email. No account needed.
  2. **Delivery:**
     - *area stores:* pick your area (with its fee), plus an optional map pin
     - *distance stores:* **Use my location** or drop a pin, and the fee is calculated from the distance
     - digital address (`ga1234567` is tidied to `GA-123-4567`) and/or directions for the rider
  3. **Payment:** pay on delivery (cash or MoMo to the rider), respecting the store's maximum. MoMo/card shows "coming soon" until Phase 9.
- **The database is in charge:** prices, stock, delivery fee and free delivery are re-checked when the order is placed. If stock runs out meanwhile, nothing is charged and the customer is sent back to the cart.
- **Order tracking page** (secret link, no login): thank-you message, 5-step progress, updates from the store, items, total, delivery details, WhatsApp/call the store, copy link, and **Cancel order** until the store confirms (stock goes back). The page refreshes itself every 30 seconds.
- **Short tracking link:** `akwaabashops.com/track/…` opens the order on the store's address (ready for SMS/email later)
- **Customer accounts:**
  - "Log in" and "Create an account" from checkout come straight back to the checkout
  - name pre-filled; "Save this address for next time"; saved addresses are picked automatically next time, including the area
  - **My account** (`/account`, or the person icon in any store): orders from every shop, plus manage saved addresses
  - shoppers without a store go to their account after logging in, not to "create a store"
- **Fake-order protection:** max 3 orders waiting for confirmation per phone number per store per day.
- **Fix:** the database now properly rejects a saved address that has neither a digital address nor directions.

### Phase 7 test checklist

Use a store with **area pricing** and one product with stock 5 or more.

1. As a guest (incognito window), add 2 items and open **Checkout**. The button says "Choose your area" until you pick one, then shows the total including delivery.
2. Tap **Place order** with the name empty and phone `123`: you see red messages on name, phone and directions.
3. Fill in everything (try digital address `ga1234567`) and place the order. You land on the **tracking page** with "Thank you". The cart is now empty.
4. In Supabase → Table editor → `orders`: the order is there with phone `233…` and digital address `GA-123-4567`; the product's stock went down.
5. On the tracking page, tap **Cancel order** and confirm: it shows "Cancelled" and the stock comes back.
6. Set **Payments → Only for orders up to** to a small amount: checkout now says pay on delivery is only for orders up to that amount.
7. **Account:** from checkout tap **Log in**, then **Create an account**. You come back to checkout with your name filled in. Place an order with "Save this address" ticked. Start another checkout: your address is already chosen. Open **My orders** (person icon): your order is listed.
8. **Distance store (optional):** switch Delivery to *By distance* with your shop pin, then at checkout tap **Use my location**: the fee shows with the km.

> **Store subdomain + accounts on your computer:** logins on `localhost:3000` aren't shared with `yourstore.localhost:3000` (browsers keep them apart). Test accounts using the backup address `localhost:3000/s/yourstore`. After deployment, `NEXT_PUBLIC_COOKIE_DOMAIN=.akwaabashops.com` shares the login across all store addresses.

---

## Phase 6 — what's included

- **Storefront home:** your brand colour, logo, banner photo and headline (text turns dark automatically on light colours), free-delivery banner, featured products, category chips, sort (newest, price), search, and "Show more" (24 at a time)
- **Product cards:** cover photo (small version, saves data), price, *Only 2 left* and *Sold out* badges, and a **+** button to add to the cart quickly
- **Product page:** swipeable photos, price, stock, quantity, **Add to cart** and **Buy now**, "Ask about this on WhatsApp" (the message includes the product link), delivery info, description, and more from the same category. Sharing the link shows the product photo on WhatsApp and social media.
- **Cart:** saved on the shopper's phone, one cart per store. Every time it opens or changes, prices and stock are re-checked from the database:
  - *Price updated* when a price changed
  - *Only 1 left · Change to 1* when stock dropped
  - *No longer available* for hidden or deleted products
  - Checkout stays disabled until problems are fixed
  - "Add GH₵50 more for free delivery" progress bar
- **WhatsApp:** floating chat button on browsing pages, plus WhatsApp and contact details in the footer
- **Works on both addresses:** `yourstore.akwaabashops.com` and the backup `akwaabashops.com/s/yourstore`
- **Pending stores:** the public sees "Page not found"; your team sees a preview with a dark banner
- **Checkout** shows "almost ready" for now; Phase 7 builds the real checkout.

### Phase 6 test checklist

1. In the dashboard, add 3+ products with photos (mark one **Featured**, set one to stock `2` and one to `0`), and make sure your store is approved (see "Approving a store" below).
2. Open your store from **View your store**. Check the banner, featured product, categories and badges.
3. Search for part of a product name. Tap a category. Try **Price: low to high**.
4. Open a product: swipe the photos, set quantity 2, tap **Add to cart**. The cart icon shows 2.
5. Open the cart. Change quantities and watch the subtotal and free-delivery bar update.
6. In the dashboard, change that product's stock to `1`, then reload the cart: you see "Only 1 left" and a **Change to 1** button.
7. Change its price in the dashboard and reload the cart: you see "Price updated".
8. Open the store in an incognito window *before* approving a new store: you see "Page not found".

---

## Phase 5 — what's included


- **Delivery page** (owner, manager):
  - **Accept delivery orders** switch: pause new orders for holidays or when riders are off
  - choose **By area** or **By distance**; you can switch any time, and the other method's prices are kept
  - **By area:** add areas (e.g. *Teshie / Nungua*, GH₵20) with the places they include; edit, hide from checkout, reorder, delete. GH₵0 shows as *Free*. Up to 50 areas, no duplicate names.
  - **By distance:** drop a pin at your shop on the map (tap the map, drag the pin, **Use my location**, or search a place), then set a starting fee, price per km and furthest distance. A table shows what customers will pay at 2–25 km as you type.
  - **Extras:** extra charge for medium and large items, free delivery above an amount, and a delivery note shown at checkout
- **Payments page** (owner):
  - pay on delivery on/off, with an optional maximum order amount
  - MoMo and card: shows Paystack status (connecting comes in Phase 9) and the 1% platform fee
  - you can't switch off every way to pay; the database enforces this too
- **Overview checklist** ticks "Set your delivery prices" once areas or a shop pin are saved.

> The map uses free OpenStreetMap tiles. That's fine for setup and testing. Before a big launch we may switch to a paid map tile provider; it's a one-line change.

### Phase 5 test checklist

1. **Areas:** open **Delivery**. Add *Teshie / Nungua* GH₵20, *Osu* GH₵35, *East Legon* GH₵45.50 and *Tema* GH₵0. Then:
   - Try adding *osu* again: you see "You already have an area with this name."
   - Move *Tema* up, edit *Osu* to 40, hide *East Legon* with the eye icon, and delete *Tema* (a confirmation appears first).
2. **Extras:** set medium GH₵10, large GH₵30, free delivery from GH₵1,000, then **Save delivery settings**. You see "Delivery settings saved".
3. **Distance:** click **By distance** and save straight away: you see "Distance pricing needs your shop's location".
   - Click **Use my location** (allow it in the browser), or tap the map where your shop is. Drag the pin to adjust.
   - Set starting fee 15, per km 4, furthest 20. The table shows GH₵35 for 5 km and "Too far" for 25 km.
   - Save, then reload: the pin is still there.
4. **Pause:** switch off **Accept delivery orders**: a yellow "Delivery is paused" box appears. Switch it back on and save.
5. **Overview:** "Set your delivery prices" is ticked.
6. **Payments:** set "Only for orders up to" to 2,500 and save. Switch off pay on delivery: the save button is disabled, with a red "Customers need a way to pay" message. Switch it back on.
7. **Roles:** a Manager can open Delivery but not Payments. Staff can open neither.

---

## Phase 4 — what's included

- **Settings** (owner): store name, description, WhatsApp and phone (any Ghana format, saved as 233…), email, shop address, logo, banner photo, brand colour, banner text, Instagram/TikTok/Facebook/X (username or link)
- **Categories** (owner, manager): create with picture, edit, hide, reorder with arrows, delete (products are kept)
- **Products** (everyone; delete is owner/manager only):
  - name, description, price in GH₵, stock, category, delivery size (small/medium/large)
  - show/hide, pause orders, featured
  - up to 8 photos: pick several at once, choose the cover, reorder, remove
  - search, filter by category and status (hidden, out of stock, low stock, featured), quick show/hide
- **Photos are shrunk on the phone before upload.** A 4000×3000 photo becomes about 140 KB, plus a small thumbnail for lists, which saves your customers' data. Old photos are deleted from storage when replaced or removed.
- **Staff** (owner):
  - invite by email as Manager or Staff, then share the link with **Copy link** or **Send on WhatsApp**
  - change roles, remove people, cancel invitations
  - the last owner is protected
- **Invitation page:** the invitee creates an account (email pre-filled) or logs in, then taps **Accept**. Links expire after 7 days and work once, only for the invited email.
- **Overview:** products, visible, out of stock and categories counts, plus recently added products

### Phase 4 test checklist

1. **Settings:** type `123` as WhatsApp and you see an error. Enter your real number, upload a logo and banner, pick a colour, save, and you see "Settings saved". Click **View your store**: your logo and description show.
2. **Categories:** create *Sneakers* (with a picture), *Bags* and *Watches*. Move *Bags* up with the arrow. Open one and **Delete** it: a confirmation appears first.
3. **Products:**
   - Click **Add product** and save empty: you see red messages.
   - Fill it in with price `1,250.50`, add 3 photos, tap **Cover** on the third, then save.
   - The product shows in the list with its cover photo and GH₵1,250.50.
4. Open it, remove a photo, save. Add a second product with stock `0`: it shows **Out of stock**. Try search and the filters.
5. Click the eye icon to hide a product: you see "now hidden from customers".
6. **Overview:** the numbers match what you added.
7. **Staff:** invite a second email of yours as *Staff* and copy the link.
   - Open the link in an incognito window. You see "Join [your store]".
   - Create the account (email is already filled in) and tap **Accept and join**.
   - You land in the store. The menu shows only Overview, Orders and Products.
8. Back as owner, change their role to **Manager**: they can now open Categories. Then **Remove** them: they lose access.

---

## Phase 3 — what's included

- Platform landing page
- Sign up, email confirmation (works even if the email is opened on another device), log in, log out
- Forgot password and reset password
- Create a store: name plus a permanent address (`kofishoes.akwaabashops.com`)
- New stores start as **Pending approval**
- Store dashboard: sidebar with store switcher, mobile menu, overview with store link and setup checklist
- Placeholder pages for sections built in later phases
- Store subdomains: `kofishoes.localhost:3000` locally, `kofishoes.akwaabashops.com` in production, plus the backup address `/s/kofishoes`
- Temporary storefront page (the full shop arrives in Phase 6)

---

## 1. Requirements

- **Node.js 20.9 or newer.** Check with `node -v` in a terminal. If it's older, install the LTS version from <https://nodejs.org>.
- VS Code and Git (you already have both).
- Your Supabase project from Phase 2.

## 2. Install

1. Unzip `akwaaba-shops` somewhere simple, e.g. `C:\Projects\akwaaba-shops`.
2. In VS Code: **File → Open Folder** → choose `akwaaba-shops`.
3. Open the terminal (**Terminal → New Terminal**) and run:

```powershell
npm install
```

## 3. Environment variables

Create your private settings file:

```powershell
Copy-Item .env.example .env.local
```

Open `.env.local` and fill in:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → **Project Settings → Data API** → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → **Project Settings → API Keys** → Publishable key (`sb_publishable_…`), or the legacy **anon** key |
| `NEXT_PUBLIC_SITE_URL` | Leave as `http://localhost:3000` |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Leave as `localhost:3000` |

`.env.local` is ignored by Git, so it never goes to GitHub. Never put the **secret / service_role** key in this project before Phase 9.

## 4. Supabase settings (one time)

### 4a. URLs

**Authentication → URL Configuration**

- **Site URL:** `http://localhost:3000`
- **Redirect URLs:** add `http://localhost:3000/**`

(In Phase 12 we add the live domain.)

### 4b. Email templates

These make the email links work when someone signs up on a laptop but opens the email on their phone.

**Authentication → Emails → Templates**

**Confirm signup.** Set the subject to `Confirm your Akwaaba Shops account` and replace the message body with:

```html
<h2>Welcome to Akwaaba Shops</h2>
<p>Tap the button below to confirm your email and open your store.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm my email</a></p>
<p>If you didn't create an account, you can ignore this email.</p>
```

**Reset Password.** Set the subject to `Reset your Akwaaba Shops password` and replace the body with:

```html
<h2>Reset your password</h2>
<p>Tap the button below to choose a new password. The link works for one hour.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Choose a new password</a></p>
<p>If you didn't ask for this, you can ignore this email.</p>
```

Click **Save** on each.

### 4c. About test emails

Supabase's built-in email sender is for testing only:
- It sends a small number of emails per hour.
- It may only deliver to email addresses on your Supabase team.

**Test with your own email address.** If emails stop arriving, wait an hour or check spam. Before launch (Phase 12) we connect a proper email service (Resend) so customers get emails reliably.

## 5. Run it

```powershell
npm run dev
```

Open <http://localhost:3000> in **Chrome or Edge**.

---

## 6. Phase 3 test checklist

Work through these in order. Each one should behave exactly as described.

(With email confirmation off, steps 5–6 are skipped: sign-up goes straight to "Let's create your store".)

1. **Landing page** loads at `http://localhost:3000`.
2. **Protected pages:** go to `http://localhost:3000/dashboard` and you're sent to **Log in**.
3. **Sign-up errors:** on **Open your store**, click **Create account** with empty fields. You see red messages under each field. Type phone `12345`: "Enter a valid Ghana number".
4. **Sign up** with your real email and a phone like `024 123 4567`. You land on **Check your email**.
5. **Log in before confirming** shows "Please confirm your email first" with a **Send a new link** button.
6. **Confirm:** open the email (try it on your phone) and tap **Confirm my email**. You land on **Let's create your store**.
7. **Create a store:**
   - Type a name and the store address fills itself in.
   - Try `admin` as the address: "That address is reserved".
   - Use a real address and click **Create store**. You see **Your store is created!** and a **Pending approval** badge.
8. **Dashboard:**
   - Click each sidebar item: Orders, Products and the others show "Coming in phase X".
   - On a phone-sized window, the ☰ menu opens and closes.
9. **Preview:** click **Preview**. You see your store page with a black "Preview" bar.
10. **Public can't see it yet:** open a private/incognito window and go to `http://localhost:3000/s/YOUR-ADDRESS`. You see "This store isn't available".
11. **Approve your store** with the SQL below, then refresh incognito. Your store appears. Also try `http://YOUR-ADDRESS.localhost:3000`.
12. **Log out** (icon next to your name), then **Forgot password?**: request a link, open the email, set a new password. You land in the dashboard with "Your password has been changed".
13. **Old password** no longer works; the new one does.

### Approving a store with SQL (before you set up the admin panel)

Supabase → **SQL Editor**:

```sql
-- See stores waiting for approval
select id, name, slug, created_at from public.stores where status = 'pending';

-- Approve one (replace the slug)
update public.stores set status = 'active', approved_at = now() where slug = 'kofishoes';
```

To add a WhatsApp number for the storefront button (the Settings page comes in Phase 4):

```sql
update public.store_settings set whatsapp_number = '233241234567'
where store_id = (select id from public.stores where slug = 'kofishoes');
```

---

## Logo and installable app (PWA)

Akwaaba Shops and every shop on it can be installed like an app: Chrome on Android or a computer shows **Install**, and on iPhone you use Safari → Share → **Add to Home Screen**. There is also an **Install app** button in the dashboard menu and in every shop's footer. It only appears when the browser can install.

**Changing the platform logo**
1. Make a square logo, 1024×1024 PNG, with the mark centred and some empty space around it. It should have no text and still read clearly at small sizes.
2. Save it as `branding/logo.png`, cropped close around the mark (the script adds the padding). The current one is your Sankofa-bag logo; `branding/logo-original.png` and `branding/wordmark.png` are the originals. If the background colour changes, update `BG` in `scripts/make-icons.mjs`.
3. Run `npm run icons`. This rebuilds everything in `public/icons/`: the favicon, the Android icons, the "maskable" icons that phones crop into circles, and the iPhone icon.
4. Restart `npm run dev` and commit the new `public/icons/*` files.

**Shop apps.** Each shop gets its own app automatically, with no work needed:
- the app name is the shop name
- the colour is the shop's brand colour
- the icon is the shop logo from Settings, or the first letter of the shop name if there's no logo

The addresses are `/app-manifest` and `/app-icon/192` on the shop's own address, so they work on `kofishoes.akwaabashops.com` too.

**Offline.** `public/sw.js` only shows a friendly "You're offline" page. It never stores pages or data, so customers always see live prices and stock. If you change `offline.html`, raise the version in `CACHE` inside `sw.js`.

To test installing on a phone you need the real `https://` site (Phase 12). `localhost` works on your computer's Chrome.

## Going live (Phase 12)

Follow the "Akwaaba Shops: go-live guide" doc step by step. After deploying, sign in as a platform admin and open **Admin → Go-live checks** (`/platform/setup`). It tests every production setting and tells you exactly what's missing. Secret values are never shown.

## How it's organised

```
src/
├─ app/
│  ├─ (marketing)/page.tsx        Landing page
│  ├─ (auth)/                     login, signup, check-email, forgot-password, reset-password
│  ├─ auth/confirm/route.ts       Email links land here
│  ├─ dashboard/
│  │  ├─ page.tsx                 Sends you to the right store (or "create store")
│  │  ├─ new/                     Create a store
│  │  └─ [storeId]/               One store's dashboard (layout = sidebar)
│  │     ├─ page.tsx              Overview: stats, checklist, recent products
│  │     ├─ products/             List, new, [productId] edit
│  │     ├─ categories/           List, new, [categoryId] edit
│  │     ├─ settings/  staff/
│  │     └─ [section]/page.tsx    "Coming in phase X" (orders, delivery, payments)
│  ├─ invite/[token]/             Accept a staff invitation
│  ├─ s/[store]/                  Storefront (subdomains are rewritten here)
│  └─ go-to-platform/route.ts     Sends store-subdomain visitors to the main site
├─ actions/                       Server Actions: auth, store, settings, catalogue, staff
├─ components/                    ui/, brand/, auth/, dashboard/
├─ lib/
│  ├─ supabase/                   client.ts (browser), server.ts, proxy.ts
│  ├─ auth/dal.ts                 Who is logged in, which stores they can open
│  ├─ tenant.ts                   Subdomain → store, store links, reserved addresses
│  ├─ validations/                Form rules (zod)
│  ├─ images.ts                   Shrinks photos in the browser, uploads them
│  ├─ storage.ts                  Image paths and links
│  └─ format.ts                   Slugs, Ghana phone numbers, GH₵
├─ proxy.ts                       Runs before every request: session + subdomains
└─ types/database.ts              Database types (matches supabase/migrations)
supabase/
├─ migrations/                    All database SQL, in order (1–5 so far)
├─ seed.sql                       Optional demo store
└─ README.md                      Database setup guide
```

**Security model:** pages check access through `lib/auth/dal.ts`. The database's Row Level Security from Phase 2 enforces it again underneath, so even a bug in a page can't show another store's data.

**Caching:** this project uses Next.js's classic mode (`cacheComponents: false`). Pages that need your login simply render fresh on each request.

## Regenerating database types

Only needed if the database changes. The included `src/types/database.ts` already matches migrations 1–5.

```powershell
npx supabase login
npx supabase gen types typescript --project-id YOUR_PROJECT_REF --schema public > src/types/database.ts
```

`YOUR_PROJECT_REF` is the `xxxx` in `https://xxxx.supabase.co`.

## Saving to GitHub

```powershell
git init
git add .
git commit -m "Phase 4: settings, catalogue, staff"
```

Then create an empty repository on GitHub and follow its "push an existing repository" steps. `.env.local` is never committed.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Missing environment variable…" | `.env.local` is missing or a value is empty. Restart `npm run dev` after editing it. |
| No confirmation email | Check spam. Use your own email (see 4c). Wait a minute before tapping "send again". |
| "That link didn't work" | The link expired, was already used, or the email templates (4b) weren't saved. Request a new one. |
| `kofishoes.localhost:3000` doesn't open | Use Chrome or Edge. Or use the backup address `localhost:3000/s/kofishoes`. |
| Photo upload says "permission" | You're not a member of that store, or the `store-assets` bucket is missing (see "Upgrading", step 3). |
| "Could not find the function set_product_images" | Migration 5 wasn't run. Run it in the SQL Editor. |
| Map is grey or blank | Check your internet connection. The map loads from OpenStreetMap. You can still tap it to place the pin. |
| "Use my location" doesn't work | Allow location for the site (the icon at the left of the address bar). On phones, location needs `https`, so it fully works after deployment; on your computer, `localhost` is allowed. |
| Logged in but sent back to the login page | Your computer's clock or time zone is wrong. Set the time zone to (UTC+00:00) Monrovia, Reykjavik, turn on "Set time automatically" and click **Sync now**. |
| Build error mentioning a deleted page (e.g. `debug-session`) | Delete the `.next` folder and run the command again. |
| Port 3000 already in use | Close the other terminal running the app, or run `npm run dev -- -p 3001` (and change the two URLs in `.env.local` to 3001). |
