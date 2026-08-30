# uidType audit — which bidz4u backend endpoints need `id` vs `documentId`

Strapi v5 stores BOTH `id` (numeric) and `documentId` (string) as real columns
on every row — so both are always present on any object you get back. The
inconsistency isn't that one doesn't exist; it's that different backend code
paths look entities up differently:

- **Default core routes** (`factories.createCoreRouter`, e.g. `GET/PUT/DELETE
  /auction-items/:id`) go through the v5 Document Service, which resolves
  `:id` as **documentId**.
- **Custom controllers that call `strapi.db.query(X).findOne({ where: { id } })`**
  bypass the Document Service entirely and hit the old Query Engine directly
  — which only matches the numeric `id` column. This is true even though the
  route parameter is *also* named `:id` — the param name has nothing to do
  with which value the handler body actually needs.

Audited from your shared controllers:

| Endpoint | Lookup method in controller | Needs |
|---|---|---|
| `GET /auction-items/:id` (default core `findOne`) | Document Service | **documentId** |
| `GET /auction-items/:id/lightweight-status` | `strapi.db.query(...).findOne({ where: { id } })` | **id (numeric)** |
| `POST /auction-items/:id/confirm-delivery` | `strapi.db.query(...).findOne({ where: { id } })` | **id (numeric)** |
| `POST /bids/place` (body `auctionItemId`) | `strapi.db.query('api::auction-item.auction-item').findOne({ where: { id: auctionItemId } })` | **id (numeric)** |
| `GET /countries/:id/effective-settings` | `resolveSettingsForCountry(strapi, Number(id))` | **id (numeric)** — `Number(documentId)` would be `NaN` |
| `POST /user-registration/register` (body `countryId`) | `strapi.db.query('api::country.country').findOne({ where: { id: countryId } })` | **id (numeric)** |
| Socket rooms (`auction:${auctionItemId}`) | `bid.place` emits with `auctionItem.id` (numeric); `auctionLifecycle.ts` / `forfeitureLifecycle.ts` also key everything off numeric `.id` | **id (numeric)**, always |
| `POST /affiliate-links` (`targetAuctionItem`) | `strapi.service(...).create({ data })` — Document Service | likely **documentId** (relation-connect convention in v5) — still unverified, not yet exercised by any frontend flow |
| `POST /auction-items` (now a **custom** `create` override, not default core — validates `itemOriginCountry` via `strapi.db.query('api::country.country').findOne({ where: { id } })` before calling the Document Service) | Raw Query Engine for validation, then Document Service for the actual create | **id (numeric)** for `itemOriginCountry` — confirmed, not guessed, since the validation step is raw db.query. `seller` is no longer sent by the frontend at all (the controller now forces it server-side from `ctx.state.user.id`, resolving the earlier spoofing gap). Media (`actImages`) relation unchanged — still numeric `id` from the upload response. |

**Practical rule applied in the frontend code below:**
`apiClient.resolveId(entity)` defaults to `documentId` everywhere. Every call
site that hits a controller doing raw `strapi.db.query(...).findOne({ where:
{ id } })` explicitly overrides with `apiClient.resolveId(entity, 'id')` —
and each override has a code comment pointing at this table so it's obvious
*why* it deviates from the default.

**If a relation-connect call in `/sell` (the uploaded image) throws a
"relation not found"-style error**, `actImages` is the one still-unverified
row above — try switching it to `apiClient.resolveId(x, 'id')`-style
resolution and it should resolve, since Strapi v5's exact behavior here can
vary by patch version. `seller` and `itemOriginCountry` are no longer
ambiguous — see the `POST /auction-items` row above.

## Addendum — country/town selection on `/sell`

`app/sell/page.jsx` no longer makes a separate towns request at all — it
fetches the full country list once (`GET /countries?populate=currency`,
list `find`, same call `/login` and `/signup` already make) and reads each
country's `towns` field straight off that response, since `towns` is a
plain scalar attribute and isn't excluded by that query. The Country
`<select>` uses `country.id` (numeric) as its value, matching the
`itemOriginCountry` numeric requirement confirmed in the table above — no
conversion needed between what the dropdown holds and what the create
payload sends.
