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

## Running it locally

```bash
npm install
npx prisma migrate dev   # creates/updates the local dev.db SQLite file
npm run dev
```

Then open <http://localhost:3000>.

Local development uses a SQLite file (`dev.db`, not committed to git) so
there's nothing to set up. Production will point at a hosted Postgres
database instead — see `PROJECT.md` section 7 for that plan.

## Tech stack

- [Next.js](https://nextjs.org) (App Router, JavaScript) — pages and backend
  logic in one project, deployed on [Vercel](https://vercel.com).
- [Prisma](https://www.prisma.io) — the database layer. Models live in
  [`prisma/schema.prisma`](./prisma/schema.prisma).
- [Tailwind CSS](https://tailwindcss.com) — styling.

Data mutations (adding a bottle, logging a tasting note, etc.) go through
Next.js Server Actions in [`app/actions.js`](./app/actions.js) — plain
`async` functions that run on the server and are wired directly to HTML
`<form>` elements, no separate API layer needed.
