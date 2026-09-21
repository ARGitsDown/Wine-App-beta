# Future Capabilities Backlog

Bigger, architecturally significant features that are explicitly deferred —
not hygiene fixes to existing data (see [`BACKLOG.md`](./BACKLOG.md) for
those), but new capabilities that would reshape how the app is used. Add to
this list as new ones come up; move an item into an actual build (and
delete it from here) once it's picked up.

## Separate cellars per user — scoped 2026-09-20, not yet started

Today there's exactly one cellar, one inventory, one wishlist — the app
still assumes a single owner, per [`PROJECT.md`](./PROJECT.md)'s original
scope. [Guest favoriting](./README.md) (a friend/family member browsing
*your* inventory and shortlisting bottles for their next visit) is the
lightweight version of "other people use this app": no accounts, no
password, just a name — good enough for someone visiting your cellar, not
for someone who wants their own.

### Decided with the owner

1. **Invite-only.** A handful of specific people, no open registration.
   No email verification, no abuse surface, and API-key exposure stays
   bounded to people who are trusted anyway.
2. **Fully separate cellars.** Each account sees only its own bottles,
   flights and pairings. No household/shared-bottle concept. Sharing
   stays what it is today: the guest link, for letting someone browse
   yours.
3. **Google OAuth.** No passwords stored, no reset flow to own, no
   credential breach to worry about. **Library settled: Auth.js
   (`next-auth@5`) — see "The OAuth question, answered" below.**
4. **Per-account usage limits** on the AI features (see below).

### Two corrections to the original sketch

**The schema work is smaller than this entry used to claim.** It said
"`Bottle` and `TastingNote` would need an owner reference" and implied it
spread everywhere. In fact only **three models are ownership roots**:
`Bottle`, `TastingFlight`, `SavedPairing`. Everything else inherits
through an existing foreign key — `BottlePhoto`/`TastingNote`/
`ResearchProposal` hang off a bottle, `FlightPick` off a flight,
`PairingPick` off a pairing. Three columns, not eleven.

And one model must deliberately **stay shared**: `DrinkWindowEstimate` is
a cache keyed by wine identity (`key @unique`), not by person. When a 2019
Rochioli River Block is drinking is a fact about the wine, not about whose
rack it's in — scoping it per-account would mean paying for the same
estimate once per user.

**The query work is real: ~100 call sites.** 82 Prisma calls in
`app/actions.js`, 4 in `lib/bottles.js`, 1 in `lib/guest.js`, plus 11
pages that query directly. The original fear — "easy to get scoping wrong
once in a dozen call sites and leak one person's bottles into another's
view" — is the right fear, and it's the single biggest risk here.

**Mitigation, and the backbone of the whole plan: a Prisma Client
Extension.** This project's generated client ships `defineExtension` and
the full extension type machinery (verified in
`app/generated/prisma/internal/prismaNamespace.ts`). An extension can
inject `where: { ownerId }` into every query automatically, so scoping is
enforced in *one* place rather than correctly repeated in a hundred. That
turns a risky sweep into a contained change. The cache model above must be
explicitly exempt from it.

### Also true, and not previously noted

**There is no front door today.** No middleware, no session check, nothing
in `app/(owner)/layout.js` — `/inventory`, `/scan`, the delete buttons,
all of it is reachable by anyone who knows the URL. So "add accounts" is
also "close a door that is currently open," which is arguably the stronger
reason to do this at all.

**Every account would spend the owner's API key.** Suggest, Scan and
Research all run on one shared `ANTHROPIC_API_KEY`, and Research is by
some distance the most expensive call in the app — a live web search per
bottle, with a bulk button. The decided answer is per-account usage
limits, built in this order:

- **Meter first.** Every Claude response carries `usage` with four
  counters (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`,
  `cache_read_input_tokens`). Attribute each call to the signed-in account
  and sum it into a ledger: account, feature, model, the four counters,
  computed cost, timestamp. Anthropic's own usage reporting is org-wide
  and can't break spend down by this app's users, so the attribution has
  to happen at the call sites. `scripts/compare-suggest-models.mjs`
  already accumulates exactly these four counters and is the working
  reference for the shape.
- **Cost calculation needs all four counters, not just in/out**, because
  cached tokens price differently (reads ≈10% of input, writes ≈125%),
  and rates differ per model. Per-model rates belong in one config
  constant that can be updated when pricing changes — not inlined.
- **Then cap.** A monthly ceiling per account, with a decided behaviour at
  the cap (block, or degrade to cellar-only).
- **Billing is deliberately not in scope.** Anthropic has no pass-through
  mechanism to charge an app's end users; real as-you-go billing means
  Stripe plus stored payment methods, invoices, failed charges, refunds
  and sales tax. If money ever needs to move between a few friends,
  **prepaid credits** (they hand over $20, the ledger decrements) avoid
  all of that and structurally prevent a surprise bill. Revisit only if
  this stops being a personal app.
- **The biggest cost lever isn't billing, it's model choice.** Suggest
  runs on Opus; routing non-owner accounts to Sonnet cuts that call's
  cost substantially. `scripts/compare-suggest-models.mjs` exists to
  measure whether that's a quality downgrade at all before deciding.

### Phasing

Staged so nothing is a leap, and each phase is independently shippable:

- ~~**Phase 0 — ownership, still single-user.**~~ **Done 2026-09-21.**
  `ownerId` is on `Bottle`, `TastingFlight` and `SavedPairing`, NOT NULL,
  indexed, cascading from a `User` row. Nothing reads it yet.

  Two decisions worth carrying forward:

  **The owner table is Auth.js's `User`, not a throwaway `Owner`.** Phase 1
  hands this table to `@auth/prisma-adapter`, so shaping it right now means
  ownership never has to move between tables on live data later. The shape
  came from the adapter's own source rather than memory: `createUser`
  destructures the id away and lets the database generate one, so `id`
  needs a default (`cuid()`); `getUserByEmail` queries `where: { email }`,
  so email is unique, and nullable because not every provider returns one.

  **`currentOwnerId()` (`lib/owner.js`) is the whole seam.** Every create
  site calls it - five of them - so Phase 1's "whoever is signed in" is a
  change to that one function and nothing else. It is deliberately
  uncached: a module-scope cache becomes a landmine the moment it depends
  on a session, since a stale value would serve one person's identity into
  another person's request.

  Verified end to end: 71 existing bottles backfilled with zero orphans,
  both the NOT NULL and the foreign key confirmed to actually reject bad
  writes, and a bottle and a flight created through the real UI arriving
  with ownership attached. All 12 pages clean under `npm run verify`.

  **One thing Phase 1 must not miss.** The seeded owner row has
  `email = NULL`, because guessing which Google account will sign in would
  be worse than leaving it blank. Before the first real sign-in, that row's
  email has to be set to the owner's Google address *and* account linking
  arranged - Auth.js will not link an OAuth account to an existing user by
  email on its own, for good reasons. Get this wrong and the owner signs in
  to a brand-new empty cellar while their real one sits under `seed-owner`,
  which looks exactly like data loss even though nothing was lost.
- **Phase 1 — accounts and sessions.** Google OAuth, invite-only. Existing
  data maps to the owner's account. The app stays single-user in practice;
  it just knows who you are now, and the front door closes.
- **Phase 2 — scoping.** The extension goes in, queries filter by owner,
  `/guest` keeps working. This is where the leak risk lives, so it wants a
  deliberate test: a second account proving it cannot see the first's
  bottles.
- **Phase 3 — usage ledger and caps**, per the AI-cost section above.
- **Phase 4 — what guests become.** Fold into accounts, or keep as the
  deliberately-lighter "browse someone else's cellar" mode.

### Still open

- ~~Which OAuth library, and whether it's compatible with Next 16.~~
  **Verified 2026-09-21 against the live registry, not from memory.**
- What happens at the usage cap: hard block, or degrade to the
  non-AI features.
- Whether renamed/hand-built flights and kept pairings need anything
  beyond a plain `ownerId` (they shouldn't — they're roots like `Bottle`).

## The OAuth question, answered — 2026-09-21

Checked against the npm registry and the package's own source, because
"should be fine" is what this entry existed to avoid.

**Next 16 support is explicit, not inferred.** `next-auth@5.0.0-beta.32`
declares `next: "^14.0.0-0 || ^15.0.0 || ^16.0.0"`. The stable v4
(`4.24.15`) declares `^12.2.5 || ^13 || ^14 || ^15 || ^16`, so both lines
accept this project's Next 16.3.5 and React 19.2.8.

**Take v5 anyway, despite it being a beta.** v4 predates the App Router and
its session handling is built around the Pages Router; this app is App
Router throughout, with Server Actions doing the mutations. Adopting v4
would mean writing against the older shape and migrating later. v5 has been
in beta a long time (33 betas), which is the honest argument against it —
but "beta" here means API churn between betas, not instability, and the
alternative is knowingly starting on the wrong architecture. **Pin the
exact beta** rather than tracking `@beta`, so an upgrade is a deliberate
act.

**The real risk was never Next — it was Prisma 7, and it is not a risk.**
This project runs Prisma 7.10.0 with a driver adapter and a generated
client at a custom path (`app/generated/prisma`).
`@auth/prisma-adapter@2.11.3` declares `@prisma/client: ">=2.26.0 || >=3 ||
>=4 || >=5 || >=6"` - a range written before v7 existed, which npm accepts
only because `>=6` happens to match. That is permissiveness, not a tested
claim, so the package itself was read:

- It has **no runtime import of Prisma at all** - it takes a client
  instance you hand it, so the custom generated path is a non-issue.
- Its only `@prisma/client` reference is a **type-only import** in
  `index.d.ts`, which this JavaScript project never evaluates.
- It uses nothing but plain model CRUD (`create`, `findUnique`,
  `findFirst`, `findMany`, `update`, `delete`) - no `$transaction`, no
  `$extends`, no raw queries, no internals. All unchanged in Prisma 7.

**Installs clean.** `npm install --dry-run next-auth@beta
@auth/prisma-adapter` against this exact project resolves with no peer
conflicts and no ERESOLVE.

**What is still unverified, and deliberately so:** nobody has run a real
Google sign-in end to end here. What is established is that the libraries
are compatible with this stack - which is what Phase 1 needed to know
before committing. Two things to expect when it starts: the adapter needs
its own four models (`User`, `Account`, `Session`, `VerificationToken`,
plus `Authenticator` if WebAuthn is ever wanted), and `AUTH_SECRET` plus
the Google client id/secret become required environment variables - the
first env vars this app cannot start without, which is worth remembering
given how much of its graceful degradation assumes optional ones.

## Multiple locations within one cellar

Wanted alongside the above, but explicitly **after** it: one owner whose
bottles live in more than one physical place (a fridge at home, a storage
unit, a second house). Much smaller than separate cellars per user — a
`location` on `Bottle` plus a filter, no accounts or ownership model
needed, since it's still one person's data. Genuinely easier once
ownership exists, and independent of it, so it isn't bundled into the
phases above.
