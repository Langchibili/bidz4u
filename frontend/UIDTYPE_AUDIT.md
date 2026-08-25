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
| `POST /affiliate-links` (`targetAuctionItem`) | `strapi.service(...).create({ data })` — Document Service | likely **documentId** (relation-connect convention in v5) |
| `POST /auction-items` (default core `create`, relation fields `seller`/`itemOriginCountry`/`actImages`) | Document Service | likely **documentId** for `seller`/`itemOriginCountry` — **media relations conventionally still use numeric `id`** in most v5 codebases, unverified against your exact version |

**Practical rule applied in the frontend code below:**
`apiClient.resolveId(entity)` defaults to `documentId` everywhere. Every call
site that hits a controller doing raw `strapi.db.query(...).findOne({ where:
{ id } })` explicitly overrides with `apiClient.resolveId(entity, 'id')` —
and each override has a code comment pointing at this table so it's obvious
*why* it deviates from the default.

**If a relation-connect call in `/sell` (seller, itemOriginCountry, or the
uploaded image) throws a "relation not found"-style error**, that's the one
genuinely ambiguous row above — try switching that specific field to
`apiClient.resolveId(x, 'id')` and it should resolve, since Strapi v5's exact
behavior here can vary by patch version.

## Addendum — `GET /countries` for towns

`app/sell/page.jsx` fetches the seller's country's `towns` via
`GET /countries?filters[id][$eq]=<numeric countryId>&fields[0]=towns` — a
list `find` query, not the default core `findOne` (`:id` route). List
queries filter on the raw `id` column as a plain equality condition, so this
works with the numeric id we have cached, without needing the country's
documentId at all. This is the same reasoning as the `country.id` uses
elsewhere in this table (effective-settings, user-registration) — country
identifiers stay numeric throughout this app.
