<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Before you say it works: `npm run verify`

`next dev` is not evidence. On 2026-09-21 the whole Suggest page shipped
broken by a change that passed `next build` and worked perfectly in dev — a
client component imported a module that imported the Anthropic SDK, which
throws on construction in a browser. Dev assembles the module graph
differently and never threw. Every check run that session was a dev check,
so nothing caught it until the owner opened the deployed app.

`npm run verify` is lint, then a production build, then `next start`, then
`scripts/smoke.mjs` opening all 12 pages in a real browser and failing on
any error boundary, page error or 5xx. It takes about a minute. Run it
before claiming a change works, and always after touching:

- **what a client component imports**, however many modules deep — this is
  the failure above, and `next build` alone will not catch it
- a layout, a provider, or anything wrapping a route
- a Prisma query on a page, where an empty table is a different path from a
  full one

Two things that are already mechanical, so you do not have to remember
them: `lib/anthropic.js` and `lib/prisma.js` carry `import "server-only"`,
which turns that import mistake into a failed build naming the chain; and
`.github/workflows/verify.yml` runs the whole thing on every push against
an empty database. CI is the net, not the plan — it tells you after the
push, so run it before.
