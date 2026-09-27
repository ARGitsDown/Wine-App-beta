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
3. **Google OAuth, plus a password-free fallback for anyone without a
   Google account.** No passwords stored, no reset flow to own, no
   credential breach to worry about. **Library settled: Auth.js
   (`next-auth@5`) — see "The OAuth question, answered" below.** Built
   2026-09-21 with two independent sign-in doors: Google, and a magic-link
   email option (Auth.js's Resend provider) for anyone invited who has no
   Google account or doesn't want to use one. Either can run alone or both
   together; nothing downstream of "who is this person" - the invite
   check, the adapter's cellar-adoption logic, ownership - cares which
   door was used.
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
- ~~**Phase 1 — accounts and sessions.**~~ **Done 2026-09-21.** Google OAuth
  and magic-link email, invite-only, dormant until an owner sets the
  variables for at least one of them. Existing data maps to the owner's
  account via the adopt-not-create `createUser` override. The app stays
  single-user in practice; it just knows who you are now, and the front
  door closes.
- ~~**Phase 2 — scoping.**~~ **Done 2026-09-23.** The extension is
  `lib/scoped-prisma.js`, exporting `db` - `lib/prisma.js`'s client wrapped
  in a Prisma Client Extension that injects an owner filter into every
  read, update, delete and upsert-lookup on the eight models a cellar is
  made of, before the query reaches Postgres. Three of them carry `ownerId`
  directly (`Bottle`, `TastingFlight`, `SavedPairing`); five inherit it
  through a relation (`TastingNote`, `BottlePhoto`, `ResearchProposal` via
  their bottle; `FlightPick` via its flight; `PairingPick` via its
  pairing) - Prisma's "extended where unique input" support is what makes
  that work even for a lookup by id, not just a list. `create`/`createMany`
  are deliberately untouched: every root model's create site already sets
  `ownerId` itself (Phase 0's seam), and every child-model create site
  re-fetches the parent it's attaching to through this same client first,
  which a foreign id already fails.

  `/guest` keeps working, per the original plan, but not by accident: it
  has no session for the extension to read, so it was never going to be
  "keep working" for free. `guestOwnerId()` in `lib/owner.js` - the
  earliest-created owner, the same answer `currentOwnerId` gives before
  auth exists at all - is what it scopes to instead, applied to both its
  bottle listing and the guest favorite-toggle action (which took the same
  fix for the same reason: nothing was stopping a favorite from attaching
  to a bottle in a different owner's cellar before this).

  One path had no session to give the extension even from an owner's own
  request: the bulk research step (`app/api/research/step/route.js`) runs
  from a plain HTTP route hit by a server-to-server fetch with no cookies
  attached, by design (see that route's own comment). `ResearchJob` picked
  up its own `ownerId` column for exactly this - set once at job creation,
  read explicitly by the step that processes it, on the plain client, since
  routing it through the session-reading extension would just throw. This
  is also why `researchBottles` now narrows its input ids to bottles the
  caller actually owns before the job is even created, rather than trusting
  a client-supplied id list and finding out three layers down.

  `/export` was scoped in the same pass and is worth naming on its own:
  before this it returned every owner's entire cellar to whoever was
  signed in, the same category of bug BACKLOG's Phase-1 entry found in the
  route before accounts existed at all, just one layer deeper. Guest
  favorites in the export are narrowed to this owner's bottles rather than
  left out entirely or left global.

  **Not covered, and known rather than missed:** the invites admin screen
  (`/invites`) has no privilege check beyond "signed in" - any account that
  can sign in can see the full invite list and the full account list, and
  can invite or revoke anyone. There is no owner/admin role anywhere in
  this schema; every signed-in person is, today, equally an owner of their
  own cellar and equally an administrator of who else gets in. That was
  already true before this phase and this phase does not change it -
  fixing it means designing a role, which Phase 2 was scoped to be about
  *data*, not privilege. Worth deciding before inviting anyone who
  shouldn't also be trusted with the invite list.

  Verified: `npm run lint` and a production build both clean, and a grep
  sweep of every `prisma.<scopedModel>` call site in `app/` and `lib/`
  confirmed only the two deliberate exceptions above remain on the plain
  client. What is not yet verified from a live account: the thing this
  phase was built to prove, which is next.
- **Phase 3 — usage ledger and caps**, per the AI-cost section above.
  **Scoped 2026-09-27, not yet started** - see its own section below.
- **Phase 4 — what guests become.** Turns out to be the same open question
  as "Shared cellars," logged below - see that section rather than this
  one; the two entries existed separately only because they were raised
  eight days apart.

### Still open

- ~~Which OAuth library, and whether it's compatible with Next 16.~~
  **Verified 2026-09-21 against the live registry, not from memory.**
- What happens at the usage cap: hard block, or degrade to the
  non-AI features.
- Whether an owner/admin role is worth adding to gate `/invites` - see
  Phase 2's "not covered" note above.
- ~~Whether renamed/hand-built flights and kept pairings need anything
  beyond a plain `ownerId`.~~ **Confirmed by Phase 2: no.** They're roots
  like `Bottle`, and the extension scopes all three identically.

## Phase 3, scoped — usage ledger and caps — 2026-09-27

Scoped on request, deliberately not started: the owner wanted this planned
out while it's fresh, without picking it up yet. Builds on the AI-cost
section above ("Every account would spend the owner's API key"), which
already settled the shape - meter first, then cap, no billing, model
choice as the biggest lever. This turns that into an actual schema and
call graph.

**Every call site, found by grep rather than assumed.** Six places in
`app/actions.js` call `anthropic.messages.create` and get back a `usage`
object: `extractWinesFromPhoto` (Scan), `getSuggestions` (Suggest),
`runResearch` (Research), `estimateDrinkWindows` and
`estimateWindowForBottle` (the bulk and single drinking-window
estimators), and `extractBottlePhotoDetails` (reading an added photo).
Matches BACKLOG #20's "six AI calls (not five)" - the same six effort
already got wired through, so this reuses call sites already touched once
for a related reason rather than finding them cold.

**A ledger of individual rows, not a running counter.** The AI-cost
section already used the word "ledger," and a per-call row is the safer
shape: a running total updated in place would race under Research's own
bulk path (several steps writing concurrently via `after()`, see BACKLOG
#17's Research section), needs no lock or upsert-with-increment
gymnastics, and keeps a real audit trail (which feature, which model, when)
instead of only a number. The monthly total a cap check needs is a sum
over rows in a date range, not a stored running value.

```prisma
model UsageEvent {
  id                       Int      @id @default(autoincrement())
  ownerId                  String
  owner                    User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  feature                  String   // "suggest" | "scan" | "research" | "estimate-windows" | "photo-details"
  model                    String   // the exact model id the call actually ran on
  inputTokens              Int
  outputTokens             Int
  cacheCreationInputTokens Int
  cacheReadInputTokens     Int
  // Computed and stored at write time from the rate table in force that
  // day, not recomputed later from raw tokens - a rate change (Anthropic
  // repriced a model) must not silently rewrite last month's history.
  costCents                Int
  createdAt                DateTime @default(now())

  @@index([ownerId, createdAt])
}
```

**One helper, called from all six sites, that never breaks the feature it
instruments.** `lib/usage.js`'s `recordUsage({ ownerId, feature, model,
usage })` looks up that day's rate for `model` in a small rate-table
constant (mirroring how `lib/effort.js` centralizes effort mapping), computes
`costCents`, and writes the row - wrapped in its own try/catch that logs
and swallows rather than throws, the same reasoning `insertBottle`'s own
comment gives for why one scan card's database error can't take down the
batch. A Suggest result the owner is staring at must never fail because
the usage write behind it hiccuped. The rate table itself needs real,
current numbers pulled from Anthropic's pricing page at build time - not
invented here, since token prices drift and a wrong number baked into a
planning doc would be worse than no number.

**Attribution is just `currentOwnerId()` - already the account, no new
concept.** Every one of the six call sites already runs inside a request
that knows who's signed in (or, for the Research step route, already
carries `ResearchJob.ownerId` on the plain client for exactly this
reason - see Phase 2's writeup of that route above). Nothing here needs
"whose spend is this" to mean anything more complicated than it already
does elsewhere in the schema.

**`UsageEvent` reads go through the plain `prisma` client, not the scoped
`db` one - on purpose, and it inherits a gap Phase 2 already flagged.**
`lib/scoped-prisma.js`'s whole point is that a signed-in account only ever
sees its own rows; but the reason a cap system exists at all is so an
owner can see *other* accounts' spend, which the scoped client is built
to prevent. So this table is deliberately never wrapped in it, the same
way `DrinkWindowEstimate` deliberately isn't (for the opposite reason - one
is shared on purpose, this one is cross-account on purpose). That means
whatever renders an oversight view - "N invited accounts, here's what each
spent this month" - has to decide *who's allowed to open it*, and there is
no answer today: Phase 2's own "Not covered" note already says "any
account that can sign in can see the full invite list... There is no
owner/admin role anywhere in this schema." Phase 3 doesn't need to invent
a second version of that problem - it inherits Phase 2's, and both are
worth settling together rather than twice.

**Minimal UI, not a dashboard.** Two surfaces, both small: a line added to
`/invites`' existing per-account rows ("$0.42 this month"), and a banner
on Suggest/Scan/Research's own pages when the signed-in account is at or
near its cap - reusing `lib/ai-errors.js`'s existing pattern for "this
feature is unavailable right now," which every one of those pages already
renders around a missing `ANTHROPIC_API_KEY`. A cap with nothing that ever
shows anyone their own number is a surprise, not a limit.

**Reset boundary: calendar month, UTC.** Simplest rule that matches the
"monthly ceiling" language the AI-cost section already settled on; a
rolling 30-day window is more precise and meaningfully harder to explain
to the one person (an invited friend or family member) who'd ever ask why
Suggest stopped working.

**What this doesn't decide, on purpose - already flagged above under
"Still open" and unchanged by this scoping pass:**

- What happens at the cap itself: hard block, or degrade to the non-AI
  features. Shapes `recordUsage`'s sibling guard function's return
  contract (an error the caller shows, versus a quieter fallback), so
  it's worth answering before writing that function, not after.
- Whether the owner's own account is capped at all, or exempt by
  default - `User.monthlySpendCapCents Int?`, nullable, with `null`
  reading as "no cap," would let the owner stay unlimited without a
  special case in the check itself: it's just an account whose column is
  null.
- Who sets a non-owner account's cap, and what the default is for a
  newly-invited one - a per-invite field, or one global default applied
  to everyone but the owner.
- The owner/admin role question Phase 2 already raised, now shared by two
  features (`/invites`'s edit/revoke powers, and whichever screen shows
  cross-account spend) rather than one.

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

**Verified end to end 2026-09-22: a real Google sign-in, in production.**
Google OAuth client created, credentials set in Vercel, and the owner
signed in for real. The adopt-not-create adapter override worked exactly
as designed - the existing 123-bottle cellar was claimed by the sign-in
rather than a new empty one being created beside it.

One real bug surfaced by that test, not by code review: the very first
attempt came back `AccessDenied` even though the seeded row was still
unclaimed and `OWNER_EMAIL` looked right. Google's OAuth profile returned
`andrewrucker@gmail.com` - no dot - while `OWNER_EMAIL` had been set to
`andrew.rucker@gmail.com` - with one. Gmail ignores dots for routing mail,
so both spellings reach the same inbox, but the account has exactly one
canonical form, and that is what OAuth hands back. Diagnosed by adding a
temporary log line to `isAllowedToSignIn` (since removed) rather than
guessing, which printed the exact mismatch on the next attempt. Now
documented in `.env.example` next to `OWNER_EMAIL`.

## Multiple locations within one cellar

Wanted alongside the above, but explicitly **after** it: one owner whose
bottles live in more than one physical place (a fridge at home, a storage
unit, a second house). Much smaller than separate cellars per user — a
`location` on `Bottle` plus a filter, no accounts or ownership model
needed, since it's still one person's data. Genuinely easier once
ownership exists, and independent of it, so it isn't bundled into the
phases above.

Reiterated by the owner 2026-09-27, alongside the shared-cellars ask
below - explicitly the smaller and more independent of the two. Nothing
about the scoping above has changed since it was first written; still
just a column and a filter.

## Shared cellars — multiple users per cellar, with roles — raised 2026-09-27

Reopens a call this file made explicit above, in "Separate cellars per
user": *"Fully separate cellars... No household/shared-bottle concept."*
The owner now wants the opposite alongside it, not instead of it - framed
broadly, "Cellar" standing in for the app as a whole rather than one
specific list: several people with real accounts sharing access to the
*same* cellar, rather than each account only ever seeing its own. Two
roles were named, not one:

- **Full access ("managers")** - add, edit, scan, delete, run Suggest and
  Research, the works. Today's single owner, just more than one of them
  per cellar.
- **Guest-like** - browsing and favoriting, no editing. This already
  exists in spirit as the anonymous, cookie-based Guest feature at
  `/guest` (see `README.md`); what would be new is tying that same
  restricted view to a real invited account instead of a typed name, so
  it survives across devices and doesn't depend on a shared link.

**Why this doesn't fit today's ownership model as built.** Phases 0-2
above gave every ownership root - `Bottle`, `TastingFlight`,
`SavedPairing` - a single `ownerId: String` pointing straight at `User`,
and `lib/scoped-prisma.js` filters every query on that one column. That
design assumes one cellar has exactly one owner, because that was exactly
what it was asked to assume at the time. Several owners of the same
cellar needs a level of indirection that isn't there: something like a
`Cellar` entity that a `User` belongs to (possibly more than one, with a
role per membership - a `CellarMembership(userId, cellarId, role)` join
row), with `ownerId` on the three roots becoming `cellarId` rather than
pointing at a person directly. Not a small migration - every one of the
~100 scoped call sites inherits its correctness from `ownerId` meaning
"this exact person," and that assumption would need re-examining wherever
a role check (full access vs. guest-like) has to gate a *write*, not just
filter a *read*. The invite list (`Invite`, flat and global today - see
"Decided with the owner" point 1 above) would likely need to become
per-cellar too, which is its own small design question.

**Not scoped beyond this.** Logged because the owner asked for it to be
on record, not because a plan exists yet. Open questions worth settling
before this is picked up: how invites map to cellar membership (one
global list, or per cellar); whether a person can belong to more than one
cellar; and whether the guest role reuses `/guest`'s existing anonymous
UI as-is or gets a real, restricted, account-based sign-in instead.

**This is also "Phase 4" from the separate-cellars phasing above**,
originally worded as "what guests become... fold into accounts, or keep
as the deliberately-lighter 'browse someone else's cellar' mode" - the
same question this entry's own "guest-like" role restates almost exactly,
just eight days later and with a name (managers/guest-like) attached. The
phasing list now points here instead of carrying its own copy, so there's
one open write-up of this question, not two drifting independently.
