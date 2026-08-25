# bidz4u frontend

Next.js (App Router, JS/JSX) + Material UI frontend for bidz4u, wired to the
Strapi backend + socket.io sockets service described in the project plan.

## Structure

```
bidz4u-frontend/
├── Constants.js              # global fallback config, storage keys, socket event names
├── Functions.js               # phone/currency/countdown helpers
├── theme/index.js             # MUI dark theme + deep-shadow elevation
├── lib/
│   ├── api/
│   │   ├── client.js           # fetch wrapper; apiClient.getToken/setToken/clearToken
│   │   └── auth.js             # authAPI — register/sendOTP/reSendOTP/verifyOTP/
│   │                            # loginWithOTP/me/logout, mapped onto bidz4u's
│   │                            # /account-exist-check, /user-registration,
│   │                            # /auth-otp/send|resend|verify routes
│   ├── contexts/
│   │   ├── AuthContext.jsx     # createContext/useContext provider — user, loading,
│   │   │                        # error, register/sendOTP/verifyOTP/logout,
│   │   │                        # isAuthenticated(), plus country/currency config
│   │   │                        # and effective-settings caching
│   │   └── ContextProviders.jsx
│   └── hooks/
│       ├── useSocket.jsx       # dual-namespace socket.io + polling fallback
│       └── useAuctionTimer.jsx # countdown driven by actListingTimeEnd
├── components/AuctionCard.jsx  # compact card with gold-flash animation
├── app/
│   ├── layout.jsx              # root layout, mounts ClientProviders (theme+context)
│   ├── ClientProviders.jsx
│   ├── page.jsx                 # home / live auction feed
│   ├── (auth)/
│   │   ├── AuthLayoutClient.jsx  # splash + centered container for auth routes
│   │   ├── layout.jsx
│   │   ├── login/page.jsx
│   │   ├── signup/page.jsx
│   │   └── verify-phone/page.jsx
│   └── auction/[id]/page.jsx    # live bidding page (socket + polling fallback)
```

## Auth flow implemented

Structured like a typical `authAPI` + `AuthContext` split (thin API module,
context owns state/loading/error), but bidz4u is **OTP-only** — there is no
`/auth/local`, no password, no `/users/me` round-trip. The verify step is the
only place a JWT is issued, so `authAPI.me()` just re-reads what `verifyOTP`
already cached rather than hitting the network again.

1. `GET /countries?populate=currency` — country/currency picker.
2. `POST /account-exist-check/check-user` — existing vs new account
   (`authAPI.checkUserExists`, called inline from the login/signup pages).
3. Existing → `authAPI.loginWithOTP()` → `POST /auth-otp/send` (purpose
   `login`) → `/verify-phone`.
4. New → collect name → `authAPI.register()` → `POST /user-registration/register`
   → `POST /auth-otp/send` (purpose `registration`) → `/verify-phone`.
5. `authAPI.verifyOTP()` → `POST /auth-otp/verify` → `{ status, jwt, user }`.
   On success, `apiClient.setToken(jwt)` persists the token (mirrors the
   reference's `setToken`-on-verify pattern) and `AuthContext.verifyOTP`
   updates `user` in state. 1-year token lifespan is a backend/Strapi
   setting, so the client never has to refresh it.
6. Right after verify, `AuthContext` fetches
   `GET /countries/:id/effective-settings` using the `countryId` persisted
   during step 3/4 (via `persistCountryConfig`), and caches the result in
   context + `localStorage` (`bidz4u_effective_settings`) — its
   `_pollIntervalMs` feeds `useSocket`'s fallback interval.

`useAuth()` (from `lib/contexts/AuthContext.jsx`) exposes: `user`, `loading`,
`error`, `hydrated`, `countryConfig`, `effectiveSettings`,
`persistCountryConfig`, `register`, `sendOTP`, `reSendOTP`, `verifyOTP`,
`loginWithOTP`, `logout`, `isAuthenticated()`.

## Real-time bidding

`app/auction/[id]/page.jsx` combines:
- `useSocket(auctionItemId, { userId })` — connects to `/main-sockets`,
  listens for `bid:placed`, `auction:extended`, `auction:closed`,
  `bid:forfeited`; falls back to polling
  `GET /auction-items/:id/lightweight-status` on `connect_error`.
- `useAuctionTimer(endTime)` — independent countdown, resets automatically
  when `auction:extended` updates `endTime`.
- Placing a bid is a plain `POST /bids/place` — the bidder's own update
  arrives back through the same broadcast everyone else gets.

## Setup

```bash
cp .env.local.example .env.local   # point at your Strapi + sockets service
npm install
npm run dev
```

## Not yet wired in this pass

Per the backend reference, these are separate follow-up screens/hooks, not
included here to keep this drop focused on auth + core bidding:
- Wallet / deposit / withdrawal screens (`/wallets/me`, `/bidz4upay/*`)
- Winner payment flow + `usePaymentStatus`
- Affiliate link generation + WhatsApp share button
- Delivery confirmation UI
- Haptic bridge calls from `device:haptic` (RN WebView only)

## New in this pass: navigation + full user flows

`components/BottomNav.jsx` is now mounted on every logged-in page (Home,
auction detail, Wallet, My Bids, Sell, Profile) and covers the areas your
project plan calls out for a bidder/seller:

- **Auctions** (`/`) — live feed. Each `AuctionCard` now shows a thumbnail on
  the left, a live countdown chip, the current highest bid, and the bid
  count.
- **Sell** (`/sell`) — create a new auction listing (title, description,
  starting price, duration, photo upload).
- **Wallet** (`/wallet`) — balance + escrow balance, deposit, withdrawal
  (mobile money or bank account), recent transaction history.
- **My Bids** (`/my-bids`) — the bidder's own bid history with status chips
  (leading / outbid / won / forfeited).
- **Profile** (`/profile`) — account info, KYC status, country/currency,
  logout.

## ⚠️ Schema / backend gaps surfaced while building this

These aren't frontend bugs — they're things the current schema/backend
doesn't define yet, so I made a documented assumption in code (each one has
a comment at the top of the relevant file too):

1. **No bid-count field on `auction-item`.** The feed fetches
   `populate[bids][fields][0]=id` and counts the array client-side. Fine at
   small scale, but it means every feed load pulls one row per bid across
   every visible item. If the feed grows, add a maintained
   `actBidCount: integer` field (incremented in `bid.place`) instead.

2. **`auction-item` has no custom create controller.** It's Strapi's default
   `factories.createCoreRouter`, which means:
   - `seller` is **not** auto-set to the logged-in user — the Sell page sends
     `seller: user.id` itself, which a modified client could spoof. You'll
     want a custom `create` override that forces
     `seller: ctx.state.user.id` server-side before this is exposed publicly.
   - The "authenticated" role needs **Create** permission enabled on
     auction-item in Strapi admin (Settings → Users & Permissions → Roles) —
     that's an admin-panel toggle, not something in any file you've shared.

3. **No listing moderation/approval workflow.** `actAuctionStatus` has no
   "pending_review" value, so `/sell` sets new listings straight to
   `'active'`. If you want an approval step before a listing goes live,
   that's a schema addition (`pending_review` enum value) + an admin action
   to flip it to `active`.

4. **No enumerated mobile-money `operator` list.** pawapay/lenco each expect
   specific network codes (not free text) — nothing in the schema documents
   what values are valid for your configured gateway. The Wallet page uses a
   plain text field for now; swap it for a `<Select>` once you confirm the
   codes.

5. **No profile-edit endpoint.** There's no `PUT /users/me`-equivalent
   anywhere in what you've shared, so `/profile` is read-only + logout. Name
   changes, avatar, etc. need either the default `PUT /users/:id` opened up
   for "authenticated" (with an ownership check added) or a small custom
   controller.

6. **Upload permission.** `/sell`'s image upload calls `POST /upload`
   directly — the "authenticated" role needs Upload permission enabled in
   Strapi admin, same caveat as #2.

## Fixing the 403s (`/wallets/me`, `/transactions/me`, `/bids/me`, etc.)

`config: { auth: {} }` on a custom Strapi route only means **"a valid JWT is
required"** — it does **not** grant permission to call that action. Strapi's
Users & Permissions plugin separately checks a per-action checkbox for
*every* controller method, including custom ones, and content-type CRUD
default (find/create/update/delete) does **not** auto-enable custom methods.

To fix, in the Strapi admin: **Settings → Users & Permissions Plugin →
Roles → Authenticated**, then under each content type, enable these
specific action checkboxes (not just the default find/create ones):

- **Wallet** → `myWallet`
- **Transaction** → `myTransactions`, `initiateDeposit`
- **Bid** → `myBids`, `place`
- **Auction-item** → `lightweightStatus`, `confirmDelivery`
- **Commission-ledger** → `myEarnings`
- **Affiliate-link** → `create`, `trackClick`
- **Bidz4upay** → `initiate`, `getPaymentStatus`, `requestWithdrawal`

Save, then retry — no code change needed for this part, it's purely an
admin-panel permission toggle per role.

## `uidType` — `id` vs `documentId`, propagated app-wide

`apiClient.get/post/put/delete` now all take a **final `uidType` parameter**
(default `'documentId'`), and `apiClient.resolveId(entity, uidType)` is the
single place every file resolves an entity's identifier from — no more
`.id` scattered around. Full breakdown of which backend endpoint needs which
convention is in **`UIDTYPE_AUDIT.md`** at the project root; short version:

- **Default core routes** (`GET/PUT/DELETE /auction-items/:id`) → Strapi v5's
  Document Service resolves `:id` as **documentId**. This is why
  `/auction-items/3` 404'd — plain integers don't resolve there anymore.
- **Custom controllers using `strapi.db.query(...).findOne({ where: { id } })`**
  (bid.place, lightweight-status, confirm-delivery, effective-settings,
  user-registration) bypass the Document Service and need the **numeric
  id**.
- **Sockets** (rooms, the polling fallback) are keyed entirely off the
  numeric id server-side — always pass `apiClient.resolveId(entity, 'id')`
  into `useSocket()`.

Every place this matters now has an inline comment pointing back to
`UIDTYPE_AUDIT.md` explaining the specific override. The auction detail page
is the trickiest case — it fetches the item by **documentId** (matches its
own URL) but then extracts `apiClient.resolveId(item, 'id')` separately for
the socket connection and the bid-placement call, since those two need the
numeric id from the very same object.

## Town selection on `/sell`

`country.towns` (JSON field) now drives a Town `<select>` on the listing
form. A few things worth knowing:

1. **`auction-item` has no field to store the selected town.** I couldn't
   find one in any schema you've shared. The Sell page sends `actTown` in
   the create payload anyway, and both `AuctionCard` (feed) and the auction
   detail page already render `item.actTown` when present (with a `PlaceIcon`)
   — Strapi silently drops attributes it doesn't recognize rather than
   erroring, so nothing breaks today, but the field will stay blank
   everywhere until you add something like
   `"actTown": { "type": "string" }` to `auction-item`'s `schema.json`.
   Once you add it, no frontend change is needed — the feed/detail queries
   don't restrict fields, so `actTown` starts flowing through automatically.
2. **The JSON shape of `towns` isn't pinned down by the schema** (`json`
   accepts anything), so `normalizeTowns()` in `app/sell/page.jsx` handles a
   few likely shapes — a plain array of strings, or an array of objects with
   a `name`/`townName`/`town`/`label` key. If your actual data doesn't match
   any of those, that one function is the only place to adjust.
3. **New permission needed:** the towns fetch calls `GET /countries` (list
   `find`, filtered by id) **while already authenticated**, unlike the
   country dropdown on `/login` and `/signup` which runs before login as the
   **Public** role. If `Country → find` is only enabled for Public and not
   for Authenticated in Strapi admin, this will 403 the same way
   `/bids/place` did — add it to the same permissions pass described above.
4. This deliberately queries `GET /countries?filters[id][$eq]=...` (a list
   query) rather than the default core `GET /countries/:id` — the latter
   resolves `:id` as documentId in v5, and `countryConfig` only ever caches
   the country's numeric id. Filtering a list by `filters[id][$eq]` matches
   on the plain `id` column regardless, sidestepping the documentId question
   entirely. See `UIDTYPE_AUDIT.md`.
