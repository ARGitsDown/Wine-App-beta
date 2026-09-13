# Wine Tracker

A personal wine cellar tracker: inventory, wishlist, and tasting notes. See
[`PROJECT.md`](./PROJECT.md) for the full project spec and reasoning behind
the technical choices.

## What's here so far

- **Inventory** (`/inventory`) — bottles you own, with add/edit/remove and
  filtering by variety, region, vintage, and rating.
- **Wishlist** (`/wishlist`) — bottles to try or buy, same filtering. A
  "Bought it" button moves a bottle into inventory.
- **History** (`/consumed`) — bottles you've finished, kept around (with
  their tasting notes) via "Mark as finished" on an inventory bottle.
- **Tasting notes** — a note and a 1–5 rating logged against any bottle,
  regardless of its current status.
- **Scan a label** (`/scan`) — photograph a bottle and Claude reads the
  label, checks your own saved bottles for anything similar, and infers
  what it can (e.g. the grape variety for a Bordeaux or Burgundy labeled
  only by region) into an editable add-bottle form. Nothing saves until you
  confirm.

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
  reads wine labels for the scan feature. See `app/actions.js` for the
  `extractBottleFromLabel` action.

Data mutations (adding a bottle, logging a tasting note, etc.) go through
Next.js Server Actions in [`app/actions.js`](./app/actions.js) — plain
`async` functions that run on the server and are wired directly to HTML
`<form>` elements, no separate API layer needed.
