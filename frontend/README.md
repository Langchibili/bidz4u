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
  `GET /auction-items/:id/lightweight-status` on `connect_error`. Returns
  both `livePrice` and `liveCurrencyCode` — see the currency-model section
  below for why both matter now.
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

2. **RESOLVED — `auction-item` now has a custom `create` controller.**
   `seller` is forced to `ctx.state.user.id` server-side; the Sell page no
   longer sends `seller` at all, and a modified client can't spoof it
   anymore. The controller still uses the same **Create** permission-matrix
   entry as before (overriding a core action keeps its name), so that
   admin-panel toggle is still required — just no longer a spoofing risk on
   top of it.

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

## Fixed: sockets not updating (currency model migration)

`auction-item` and `bid` moved from flat USD-denominated amounts to a
per-item "native currency" model: every listing is now priced in whichever
country it was listed in (`actNativeCurrencyCode`, computed automatically
from `itemOriginCountry`), and bids convert the bidder's own local currency
into that native currency server-side (`bidAmountNative`/
`bidNativeCurrencyCode`), only actually converting when the two currencies
differ (`bidWasConverted`).

**This is what broke real-time updates.** `bid.place` started emitting
`bidAmountNative` instead of the old `bidAmountUsd`, and the
`lightweight-status` polling fallback started returning
`actCurrentHighestPriceNative`/`actNativeCurrencyCode` instead of
`actCurrentHighestPriceUsd` — but `lib/hooks/useSocket.jsx` was still
reading the old field names. `setLivePrice(data.bidAmountUsd)` was
silently receiving `undefined` on every single bid (the field just doesn't
exist in the payload anymore), and the auction page's
`livePrice ?? item.actCurrentHighestPriceNative` fallback then quietly kept
showing the stale pre-bid price — no error anywhere, it just looked frozen.
Both `useSocket`'s live-bid handler and its polling fallback now read the
correct fields, and the hook also tracks `liveCurrencyCode` alongside
`livePrice` since a price without its currency is meaningless in this model.

**Everywhere a price is displayed now sources its currency from the item
itself, not the viewer.** `AuctionCard`, the auction detail page's current-
bid display, and `/my-bids` (using each bid's own `bidLocalCurrencyCode`,
not the viewer's *current* country) all changed for this reason — a listing
from Kenya shown to a bidder in Zambia should read "KES 6,000", not silently
relabel that amount as Kwacha. The one place the viewer's *own* currency is
still correct to show is the bid-entry box itself, since `bidAmountLocal` is
genuinely what they're typing in their own currency — the auction page now
shows both currencies side by side with a short note when they differ.

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

`country.towns` (JSON field) drives a Town `<select>` on the listing form,
now paired with a **Country** selector (defaulting to the seller's own
account country, but changeable — sellers can list from any country). A few
things worth knowing:

1. **RESOLVED — `actTown` now exists on `auction-item`.** `AuctionCard`
   (feed) and the auction detail page already render `item.actTown` when
   present (with a `PlaceIcon`) — no frontend change was needed once the
   field landed, since neither query restricts fields.
2. **The JSON shape of `towns` isn't pinned down by the schema** (`json`
   accepts anything), so `normalizeTowns()` in `app/sell/page.jsx` handles a
   few likely shapes — a plain array of strings, or an array of objects with
   a `name`/`townName`/`town`/`label` key. If your actual data doesn't match
   any of those, that one function is the only place to adjust.
3. **No separate towns request anymore.** The Sell page now fetches the
   full country list once (`GET /countries?populate=currency`, the same
   call `/login` and `/signup` already make) and reads `towns` straight off
   whichever country is currently selected — `towns` is a plain scalar
   field on `country`, so it's already present in that response without any
   extra query. Changing the Country dropdown re-derives both the town list
   and the starting-price currency label from the newly selected country,
   entirely client-side.
4. **Permission still worth checking:** this call runs **while already
   authenticated** (unlike the same call on `/login`/`/signup`, which runs
   as the Public role before login). If `Country → find` is only enabled
   for Public and not Authenticated in Strapi admin, this will 403 the same
   way `/bids/place` did — add it to the same permissions pass described
   above.
5. **`itemOriginCountry` must be the country's numeric `id`**, not
   documentId — the new `auction-item.create` controller validates it via
   `strapi.db.query('api::country.country').findOne({ where: { id } })`,
   the raw Query Engine. The Country `<select>` in `/sell` already uses
   `country.id` as its value for exactly this reason, matching the same
   convention as the `/login` and `/signup` country pickers. See
   `UIDTYPE_AUDIT.md`.

## Fixed: JWT stored as `[object Object]`

`localStorage.setItem(key, value)` silently coerces `value` to a string —
so if `response.jwt` from `/auth-otp/verify` is ever an object instead of a
plain signed string, it gets stored as the literal text `"[object Object]"`
with zero errors anywhere. `apiClient.setToken()` (`lib/api/client.js`) now
refuses to store anything that isn't a string, tries to salvage a nested
`.jwt`/`.token`/`.accessToken` if the value is an object, and logs the raw
value to the console when it can't. `authAPI.verifyOTP()` (`lib/api/auth.js`)
also logs the exact response the moment it arrives, so the browser console
points straight at the cause instead of you discovering it later as a
malformed `Authorization` header. `apiClient.getToken()` additionally
self-heals: if it ever reads back the literal strings `"[object Object]"`,
`"undefined"`, or `"null"` from a previously-corrupted entry, it clears
them and returns `null` instead of sending garbage as a Bearer token.

**Root cause is server-side**, though: Strapi's
`strapi.plugin('users-permissions').service('jwt').issue(...)` is
synchronous and returns a plain string in a standard install — if your
`otp-verification.verify` controller's `jwt` field isn't a plain string,
something in that call chain is either not being awaited (if your Strapi
version's `.issue()` is async) or is getting wrapped in an object before
`ctx.send(...)`. Add a quick `console.log(typeof jwt, jwt)` right before the
`ctx.send({ status: true, jwt, user })` line to confirm what's actually
being sent.

If you clear your existing corrupted `bidz4u_jwt` entry once (via
`localStorage.removeItem('bidz4u_jwt')` in devtools, or just logging out and
back in), the new `apiClient.getToken()` guard prevents this from silently
recurring even if the backend issue isn't fixed yet — you'll just see the
console error instead of a broken token.

## Draft-first listing creation, autosave, and editing

`/sell` is no longer a single create-and-submit form — it now follows a
draft lifecycle, matches the `ref`/`refId` image-attach pattern from your
gigs-app (`components/shared/DocumentUploadCard.jsx`, ported with icons
swapped from `lucide-react` to `@mui/icons-material` since the former isn't
a dependency here), and gates editing of already-published listings by
status.

### How it works

1. On visiting `/sell` (no `?editId=`), the page checks
   `localStorage.actDraftDocumentId`. If a cached draft still belongs to the
   user and is still `actIsDraft: true`, it loads straight into the form.
2. Otherwise, the entire page grays out behind a skeleton while a brand-new
   draft is created: `POST /auction-items` with `actTitle: 'Untitled'`,
   `actIsDraft: true`, and placeholder values for every other required
   field. The moment it's created, both of its ids are cached:
   - `localStorage.currentActDraftId` → the draft's **numeric** id
   - `localStorage.actDraftDocumentId` → the draft's **documentId**
3. Every field edit after that autosaves — debounced ~700ms, batched into
   one `PUT /auction-items/:documentId` per pause in typing, not one
   request per keystroke.
4. **"Publish Listing"** validates (real title, valid price, at least one
   photo, town selected if the country has any, a future end time), then
   flips `actIsDraft: false` and `actAuctionStatus: 'active'`, sets
   `actListingTimeStart` to the actual go-live moment, and clears both
   localStorage keys.

### ⚠️ Real schema conflict: `actImages` is `required: true`

This flow deliberately creates the draft **before** any image exists — the
image gets attached afterwards via the upload plugin's `ref`/`refId`
mechanism, which needs the entry to already exist. The initial create
payload sends `actImages: []`. If your Strapi instance enforces "required"
on a media field as "must have at least one item" (many installs do), draft
creation will fail outright with a validation error. There's no way to
satisfy "required" and "create-before-the-image-exists" simultaneously — if
you hit this, relax `actImages` to `required: false` in the schema.

### Image upload — `ref`/`refId`/`field`, not a relation array

`lib/api/uploads.js` mirrors your gigs-app's upload pattern exactly:
`POST /upload` with the file plus `ref: 'api::auction-item.auction-item'`,
`refId: <draft's numeric id>`, `field: 'actImages'` — Strapi's upload plugin
auto-attaches the file to that field directly, no separate `PUT` needed.
`refId` uses the numeric id (not documentId), consistent with the other
raw-Query-Engine-adjacent operations in `UIDTYPE_AUDIT.md`, but this
specific mechanism is genuinely unverified against your exact Strapi
version — if the upload succeeds but `actImages` never actually gets the
file, that's the first thing to check.

**Known limitation:** removing the photo (`DocumentUploadCard`'s remove
button) only clears local UI state — it doesn't call anything to detach or
delete the file server-side. The old file stays attached in Strapi until
cleaned up some other way (re-uploading just adds/replaces the preview, it
doesn't remove the previous one from storage).

### Currency staleness on country change

The custom `auction-item.create` controller auto-computes
`actNativeCurrencyCode` from `itemOriginCountry` at creation time, but there
is no equivalent override shown for `update` — the default core `PUT`
almost certainly does **not** recompute it if `itemOriginCountry` changes on
an existing draft or listing. To guard against `actNativeCurrencyCode`
silently going stale, `/sell` explicitly sends it alongside
`itemOriginCountry` any time the country selection changes, computed
client-side from the newly selected country's own currency.

### The drafts browser

Below the form (draft mode only): a **"Create New Auction Listing"** button
and a list of the seller's other drafts (`GET /auction-items` filtered by
`seller` + `actIsDraft: true`). Clicking a draft in the list swaps both
localStorage keys and reloads that draft into the form. Per the requested
ordering rule: if there are more than 2 drafts total, the button renders
**above** the list; with 2 or fewer, the list renders above the button.

### Editing an existing (published) listing

Reachable via `/sell?editId=<documentId>` — linked from the new **My
Listings** section on `/profile`. This skips the entire draft-creation
dance: it fetches that one item, requires the viewer to be its `seller`,
and requires `actAuctionStatus` to **not** be `active`, `sold`, or
`payment_pending` (those are excluded because the auction is live, already
sold, or awaiting a winner's payment — editing any of those out from under
the process would corrupt in-flight state). Same autosave mechanism as
draft mode; the primary button reads "Save Changes" and doesn't touch
`actIsDraft`/`actAuctionStatus`. Sellers **can** change the auction's end
time here (a new "timeframe"), via the same `actListingTimeEnd`
`datetime-local` field draft mode uses.

**This status gate is enforced client-side only** — there's no backend
check shown anywhere that rejects a `PUT` to a live/sold/pending-payment
auction-item. A modified client could bypass this page entirely and edit a
live auction directly via the API. If this matters for your launch, add a
server-side check (a custom `update` override, mirroring the pattern
`create` already uses) rather than relying on this page alone.

### Drafts excluded from public visibility

`app/page.jsx`'s feed query now explicitly filters
`filters[actIsDraft][$eq]=false` (on top of the existing
`actAuctionStatus=active` filter, which already excludes drafts today since
they default to `'scheduled'` — this is deliberate defense-in-depth, not
redundant given how easy it'd be for a future status change to slip a draft
past the status filter alone). The auction detail page also guards directly:
if a draft is somehow opened via its URL, it shows a
"finish setting it up" prompt instead of the bidding UI, and offers a button
that restores it as the active draft and routes back to `/sell`.
