# Wine Tracker

A personal wine cellar tracker: inventory, wishlist, and tasting notes. See
[`PROJECT.md`](./PROJECT.md) for the full project spec and reasoning behind
the technical choices, [`BACKLOG.md`](./BACKLOG.md) for known data-model
gaps worth revisiting later, and
[`FUTURE_CAPABILITIES.md`](./FUTURE_CAPABILITIES.md) for bigger, deferred
features like separate cellars per user.

## What's here so far

- **Inventory** (`/inventory`) — bottles you own, with add/edit/remove and
  filtering by variety, region, country, vintage, and rating. Lists show
  just each bottle's header line by default (producer, bottling, vintage,
  type); clicking a row expands it in place for the fuller details and a
  link to its full page, so a long list stays scannable. Each bottle
  has both a short `type` (a header-friendly style label like "Red Bordeaux
  Blend" or "Zinfandel") and a fuller `variety` field for more detailed
  notes on the grape(s). "Region" is deliberately one flexible field rather
  than a rigid hierarchy: a US state for domestic wines, or a named
  region/appellation otherwise (Bordeaux, Burgundy, Central Otago, etc.) —
  a fuller multi-level drill-down can be layered on top later without a
  schema rework. There's also `bottling`, for producers who make more than
  one wine from the same grape/vintage: a vineyard designation (e.g.
  "Rochioli Vineyard") or a proprietary/cuvée name (e.g. "Madeleine"),
  shown right in the header so a producer's own bottlings read as
  distinct entries instead of looking like duplicates. Variety and Region
  fields offer autocomplete suggestions as you type (grape names/regional
  synonyms for Variety, well-known appellations plus anything you've typed
  before for Region) - still plain text underneath, so anything not on
  either list is fine to type too. Searching Variety by a grape name also
  matches bottles logged under a regional synonym for the same grape (e.g.
  searching "Grenache" also finds one logged as "Garnacha" or "Cannonau") -
  see [`BACKLOG.md`](./BACKLOG.md) #1.
- **Wishlist** (`/wishlist`) — bottles to try or buy, same filtering. A
  "Bought it" button moves a bottle into inventory.
- **History** (`/consumed`) — bottles you've finished, kept around (with
  their tasting notes) via "Mark as finished" on an inventory bottle.
- **Tasting notes** — a note and an optional 1–5 rating logged against any
  bottle, regardless of its current status. Rating is optional so a note
  can be logged without a personal score yet (e.g. a shop's own write-up
  brought in via scanning, before you've actually tasted it yourself).
- **Scan a label** (`/scan`) — photograph (or pick from your library) one or
  more photos at once. Each photo can hold a single bottle label *or* a
  document listing several wines (a shop's tasting sheet, a menu) - Claude
  figures out which and produces one reviewable card per wine either way.
  For each, it checks your own saved bottles for anything similar and
  infers what it can (e.g. the grape variety for a Bordeaux or Burgundy
  labeled only by region), and carries over any tasting-note-style text the
  source document already had. Nothing saves until you confirm each wine;
  saving one doesn't interrupt the rest of the batch. A wine it wasn't
  fully confident about is flagged "Needs research" when saved.
- **Needs research** (`/research`) — a queue of bottles the scan feature
  flagged as unsure about some field. Open one and hit "Research further"
  on its page to have Claude look it up with an actual web search (not
  just its training knowledge) and propose corrections - reviewed and
  edited the same way as everywhere else before you save them. Dismiss a
  bottle straight from the queue if the current details already look
  fine, without spending a search on it.
- **Suggest** (`/suggest`) — describe tonight's menu for a pairing, or a
  theme/mood for a tasting flight, in one flexible text box; Claude infers
  which you mean. It browses your current inventory (never the wishlist)
  for real candidates, explains its reasoning, and - when nothing owned is
  a strong match - proposes a specific gap suggestion you can add to the
  wishlist in one click instead of forcing a mediocre pick. A pairing
  recommendation is ephemeral (not saved anywhere) but links each pick
  straight to "log this pairing," which prefills the dish into a new
  tasting note. Saved/browsable tasting flights (a "queue" you can later
  pull bottles from to consume and rate) are a planned follow-up, not yet
  built.
- **Guest favoriting** (`/guest`) — share this link with friends/family so
  they can browse your current inventory (read-only) and favorite bottles
  they'd like pulled for their next visit. No account or password — a
  guest just enters a name (reused if they type the same one again from a
  new device), remembered via a cookie so their favorites persist across
  visits. Favorites show up back on `/inventory` as a ❤️ with who picked
  it. This is deliberately lightweight; everyone getting their own
  separate cellar is a bigger, separate capability - see
  [`FUTURE_CAPABILITIES.md`](./FUTURE_CAPABILITIES.md).

## Running it locally

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

There's one Postgres database, used everywhere (no separate local
database) — set its connection string as `DATABASE_URL` in a `.env` file
(see `.env.example`). On Vercel, `npm run build` runs `prisma migrate
deploy` first, so schema changes apply automatically on every deploy.

The label-scanning feature needs an `ANTHROPIC_API_KEY` (also in
`.env.example`) — without one, `/scan` shows a clear error and falls back to
a manual add-bottle form, so it degrades gracefully rather than breaking the
rest of the app.

## Tech stack

- [Next.js](https://nextjs.org) (App Router, JavaScript) — pages and backend
  logic in one project, deployed on [Vercel](https://vercel.com).
- [Prisma](https://www.prisma.io) — the database layer. Models live in
  [`prisma/schema.prisma`](./prisma/schema.prisma).
- [Tailwind CSS](https://tailwindcss.com) — styling.
- [Anthropic's Claude API](https://docs.claude.com) (`@anthropic-ai/sdk`) —
  reads wine photos for the scan feature (`extractWinesFromPhoto`), reasons
  over the cellar for pairing/tasting suggestions (`getSuggestions`), and
  looks up an uncertain bottle with a real web search (`researchBottle`).
  All three in `app/actions.js`.

Data mutations (adding a bottle, logging a tasting note, etc.) go through
Next.js Server Actions in [`app/actions.js`](./app/actions.js) — plain
`async` functions that run on the server and are wired directly to HTML
`<form>` elements, no separate API layer needed.
