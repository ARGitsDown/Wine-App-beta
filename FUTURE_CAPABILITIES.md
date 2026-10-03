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
  **Scoped 2026-09-27, shape decided 2026-09-28, built 2026-10-02** -
  counted per Domaine, and a Domaine over its cap moves to cheaper
  models rather than being blocked. See its own section below, and
  "Built" within it for what was verified and what was not.
- **Phase 4 — what guests become.** **Decided 2026-09-28, not yet
  started:** a guest's access is chosen per section - Cellar, Tasting
  Notes, Flights, Pairings, Wish List - when they're invited. See "Phase
  4, decided" below.

### Still open

- ~~Which OAuth library, and whether it's compatible with Next 16.~~
  **Verified 2026-09-21 against the live registry, not from memory.**
- ~~What happens at the usage cap: hard block, or degrade to the
  non-AI features.~~ **Decided 2026-09-28: neither - it moves to cheaper
  models.** See Phase 3's own section.
- ~~Whether an owner/admin role is worth adding to gate `/invites`.~~
  **Answered by Shared cellars Phase 1:** only a Cellarmaster reaches
  `/invites`, and only for their own Domaine. What's still missing is one
  level up - an *operator* of the whole app, for setting other Domaines'
  caps (Phase 3, below).
- ~~Whether renamed/hand-built flights and kept pairings need anything
  beyond a plain `ownerId`.~~ **Confirmed by Phase 2: no.** They're roots
  like `Bottle`, and the extension scopes all three identically.

## Phase 3 — usage ledger and caps — scoped 2026-09-27, decided 2026-09-28, built 2026-10-02

### Built, 2026-10-02

Every Claude call is now recorded, summed per Domaine per calendar month
(UTC), and gated by two limits on the Domaine. Where the plan below says
what would be built, this is what was, and where it differs.

**The ledger.** `UsageEvent` (one row per call: Domaine, who pressed the
button, feature, the model that actually ran, token counts, web searches,
cost). `lib/usage.js` is the one door every call goes through:
`aiAccess()` reads the month once, then `ai.call({ feature, tier, effort,
request })` adds the model-dependent fields, sends the request and writes
the row. All six call sites use it - Scan, Suggest, Research (single and
bulk), the two drinking-window estimators, and photo-details - and
`app/actions.js` no longer imports the Anthropic client at all. The bulk
Research step has no session, so it passes the job's own `ownerId` and
`domaineId` - the reason `ResearchJob` has carried them since Phase 1.

**Differences from the plan:**

- **Cost is stored in micro-dollars, not cents** (`costMicros`). A
  drinking-window estimate costs about 0.3 of a cent, so rounding each row
  to whole cents would have summed to nothing. The *limits* stay in cents
  (`Domaine.monthlySpendCapCents`, `monthlyHardStopCents`), as planned.
- **The rates** (`lib/usage-pricing.js`, as of 2026-09-25: Opus 5 $5/$25,
  Sonnet 5 $2/$10, Haiku 4.5 $1/$5 per MTok, cache writes 1.25x/2x, reads
  0.1x, web search $10 per 1,000) were taken from the claude-api skill's
  model table, not from an invoice. A model it doesn't recognise is priced
  as the dearest one and logged, so a new model id over-counts rather than
  slips through free.
- **The defaults are $5 a month with the hard stop at 3x ($15)**, in
  `lib/usage-policy.js`, overridable with `USAGE_DEFAULT_CAP_CENTS` and
  `USAGE_HARD_STOP_MULTIPLIER`. They are starting numbers chosen with no
  real spend to look at, exactly as the plan said they'd be. The
  migration gave every existing Domaine except the earliest account's
  (the app owner's, left unlimited) those values; a newly founded Domaine
  gets them in `createUser`. A Domaine that *joins* another keeps that
  one's.
- **The app owner** is the account whose email is `OWNER_EMAIL`, else any
  Cellarmaster of the original Domaine (`isAppOwner` in `lib/owner.js`).
  They alone see `/usage` (every Domaine's spend, per feature) and set its
  limits; the action behind the form makes the same check, which is the
  one that matters - replaying the owner's form from another Domaine's
  session changes nothing (tested).

**What the limits do.** Under the cap, nothing changes. At or over it,
features keep working one tier down: Suggest's "sommelier" runs on Sonnet
instead of Opus, and everything that ran on Sonnet runs on Haiku 4.5 -
**except Scan, which stays on Sonnet and is only ever paused at the hard
stop** (decided 2026-10-03; `holdTier` in `lib/usage.js`). Scan is the one
feature that saves what it reads straight into the cellar with nobody
reviewing it, so a cheaper, unmeasured model reading a label would cost
more in bad data than it saved in money; every other lighter-tier answer
is a suggestion or a proposal someone looks at. At or over the hard stop, AI features return a message saying they're
paused until the 1st and nothing is sent to Claude. Things that follow
from that, each handled and tested:

- Haiku 4.5 takes neither adaptive thinking nor an `effort` level, and
  only the basic `web_search_20250305` tool, so the model's request shape
  (`requestShape` in `lib/ai-models.js`) decides all three, and Research's
  tool version follows the model down.
- The month is read once per request, so a multi-turn loop (Scan, Suggest
  and Research all loop) stays on one model throughout and never changes
  the model under a cached prefix. A loop that crosses a limit midway
  finishes on the tier it started on: at most one call overshoots.
- **If the lighter model rejects a request outright (HTTP 400), that call
  is retried once on the normal model** and logged loudly. Haiku has never
  been run against these prompts and a feature that stops working is worse
  than one that costs a little over its cap. Anything else - a rate limit,
  an outage - is not retried on the dearer model.
- Reads of the usage total fail open (an unreadable month counts as an
  ordinary one) and writes of the ledger never throw: measuring must never
  break what it measures. The hard stop is the one deliberate refusal.
- A drinking-window answer already in the cache is served even when
  paused - it costs nothing - and a bulk Research run is refused up front
  with the reason rather than failing bottle by bottle.
- Guests can't spend: `aiAccess()` refuses a guest-role member the same
  way `lib/scoped-prisma.js` does.

**What people see.** Nothing while under the cap. Over it, an amber note
on Suggest, Scan, Research and Estimate-windows ("Running on lighter
models until 1 November"), red at the hard stop. The People page shows the
Domaine's own spend against its cap for every member of it - a cap nobody
can see is a surprise, not a limit - and `/usage` is the app owner's table
of every Domaine.

**Verified** against a stub of the Messages API (so costs could be checked
by hand) in a production build with accounts on, signing in through the
real email-link callback: the request each tier sends (model, thinking,
effort, web search version), exact ledger costs, the cap boundary (exactly
at the cap is over it), the hard stop sending nothing, last month's spend
not counting, the Haiku-rejection retry, the bulk step recording with no
session, the operator page and its refusals, and the defaults for a new
Domaine. 50 unit checks of the pricing and policy run in `npm run verify`.

**Not verified, and worth knowing:**

- **Nothing here has run against the live API.** The stub proves what this
  app *sends* and records, not that Anthropic accepts it. In particular,
  whether Haiku 4.5 accepts these prompts' `strict` tool schemas is
  unconfirmed - the 400 retry above is the safety net for exactly that.
- **Haiku's answer quality on label reading and Research is still
  unmeasured** (BACKLOG #23 measured Research effort on Sonnet only). A
  Domaine over its cap is the first place Haiku reads a label; a wrong
  vintage saved from a scan costs more to find than it saved. Measure one
  pass of each before relying on it.
- **Costs are estimates** from the rate table; the invoice is the
  authority. Calls made before this shipped aren't in the ledger.

**Still open:** the numbers themselves, after a month of the `/usage`
page. ~~Whether Scan should be held on Sonnet even over the cap~~ -
decided yes, 2026-10-03. One consequence worth watching: a Domaine's Scan
spend now keeps growing past the cap, bounded only by the hard stop, so
the hard stop is what actually limits it - keep it close enough to the
cap to mean something.

### The plan as scoped and decided

### Decided with the owner, 2026-09-28

1. **Counted per Domaine, not per person.** A Domaine's Cellarmasters
   share one cellar and now share one monthly allowance - the same unit
   everything else in the app is scoped by since Shared cellars Phase 1.
   Guest members can't make AI calls at all (lib/scoped-prisma.js and the
   up-front checks in Scan and Suggest refuse them), so there is nothing
   of theirs to count.
2. **Over the cap, a Domaine moves to cheaper models - it is never
   blocked.** Every AI feature keeps working, one rung down. Today's two
   tiers are `REASONING_MODEL` (`claude-opus-5`: Suggest's "sommelier"
   depth) and `EXTRACTION_MODEL` (`claude-sonnet-5`: Scan, Research,
   drinking windows, photo details, Suggest's "standard" depth), both in
   `lib/anthropic.js`. Over the cap, each drops one tier: Opus work runs
   on Sonnet, and Sonnet work runs on Haiku 4.5
   (`claude-haiku-4-5-20251001`). The swap belongs in one function next to
   those constants (`modelFor(tier, overCap)`), not repeated at the six
   call sites.

**What that decision changes in the plan below:**

- `UsageEvent` gains `domaineId` (the cap is summed over it) and keeps
  `ownerId` as attribution, nullable with `SET NULL` exactly like
  `Bottle.ownerId`, so removing a member doesn't erase the Domaine's
  history of what it spent. The index becomes `@@index([domaineId,
  createdAt])`. The Research step route already has `ResearchJob.domaineId`
  for this, since Phase 1.
- The cap lives on the Domaine: `Domaine.monthlySpendCapCents Int?`,
  where `null` means no cap. Not on `User`, as the section below first
  sketched.
- The guard function's contract is now settled: it never throws or
  refuses, it only returns which tier to use. The "banner when you're at
  the cap" surface becomes a quieter note - "running on lighter models
  until the 1st" - on Suggest, Scan and Research, rather than an
  unavailable state.

**Checks this decision creates, to make at build time rather than
assume now:**

- **Haiku's quality on Scan and Research has never been measured.**
  BACKLOG #23 measured Research's effort levels on Sonnet, and #9 already
  flagged the earlier lighter-model switch as not rigorously compared. A
  Domaine over its cap would be the first place Haiku reads a label or
  runs research. Worth one measured pass of each before it ships -
  a wrong vintage saved from a scan costs more to find than it saved.
- **Research's web search tool version has to follow the model down.**
  Research sends `web_search_20260318` (`WEB_SEARCH_TOOL` in
  app/actions.js); Haiku 4.5 only takes the basic `web_search_20250305`.
  The downgraded Research call has to send the older tool version as
  well, or it fails outright instead of getting cheaper - so the tool
  version belongs in `modelFor`'s answer, not just the model id.
- **Downgrading alone doesn't bound the spend** - Haiku is cheaper, not
  free - which is why decision 4 below adds a hard stop.

3. **The app owner sets every other Domaine's cap** (decided
   2026-09-28). Not a Domaine's own Cellarmasters, who would be raising
   their own limit on the owner's API key. "The app owner" is the account
   whose email is `OWNER_EMAIL` (lib/auth.js), falling back to the
   original Domaine's Cellarmasters when that isn't set. Their own
   Domaine is uncapped (`null`); they alone see every Domaine's spend and
   set its cap. A "separate" invite founds a Domaine with a default cap
   rather than none.
4. **A hard stop above the downgrade** (decided 2026-09-28). A second,
   much higher ceiling - `Domaine.monthlyHardStopCents Int?` - past which
   AI features for that Domaine stop until the month resets, for the
   runaway cases (a loop, a leaked session) that a cheaper model only
   slows down. Past the first cap, lighter models; past the second,
   nothing, with the same "unavailable right now" state these pages
   already show without an API key. It only matters when something is
   wrong, so it should sit far enough above the first cap that normal use
   never reaches it.

**Still open:** the actual numbers - the default monthly cap for a new
Domaine and how far above it the hard stop sits (for example, three
times the cap) - best chosen once the ledger has a month of real spend
to look at, rather than guessed now. *(Built with $5 and 3x as starting
values - see "Built" above.)*

### The original scoping, 2026-09-27

Kept as written; where it says `ownerId` for the cap, or "hard block,
or degrade," the decisions above replace it.

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

## Shared cellars, a.k.a. "Domaine" — multiple Users per account, with roles — raised 2026-09-27, Phases 0 and 1 done 2026-09-28

Reopens a call this file made explicit above, in "Separate cellars per
user": *"Fully separate cellars... No household/shared-bottle concept."*
The owner now wants the opposite alongside it, not instead of it - framed
broadly, "Cellar" standing in for the app as a whole rather than one
specific list: several people with real accounts sharing access to the
*same* account, rather than each account only ever seeing its own. Two
roles were named, not one:

- **Full access ("managers")** - add, edit, scan, delete, run Suggest and
  Research, the works. Today's single owner, just more than one of them
  per account.
- **Guest-like** - browsing and favoriting, no editing. This already
  exists in spirit as the anonymous, cookie-based Guest feature at
  `/guest` (see `README.md`); what would be new is tying that same
  restricted view to a real invited account instead of a typed name, so
  it survives across devices and doesn't depend on a shared link.

**Nomenclature, decided 2026-09-27: this account-level container is
called a "Domaine."** Deliberately not "Cellar" - a domaine, in the wine
sense, is the whole estate (vineyards, the winery, the cellar, everything
under one producer's name), which is exactly the right scope here: a
Domaine holds the cellar, but also the Flights, Tasting Notes, Wishlist
and Pairings hanging off it - the entire footprint one wine collector's
data occupies in this app, not one list within it. The word also does
double duty in the software sense (a tenant, a workspace, a distinct
"domain" of data within the app), which is the exact concept this section
was already reaching for with the placeholder name `Cellar` entity below.
A person who belongs to a Domaine is a **User**; a User with the "full
access" role above is styled a **Cellarmaster** of that Domaine - the
app's own name, applied to the human role it was always implicitly
describing rather than the generic "manager." Today's shipped
model (Phases 0-2, `User`/`ownerId`) is unaffected by this - it remains
exactly what it is, a Domaine of one Cellarmaster, with no separate
Domaine row yet because nothing has needed to distinguish "the account"
from "the person" until now. This naming applies going forward, to this
entry and the one below it, not retroactively to shipped schema.

**Why this doesn't fit today's ownership model as built.** Phases 0-2
above gave every ownership root - `Bottle`, `TastingFlight`,
`SavedPairing` - a single `ownerId: String` pointing straight at `User`,
and `lib/scoped-prisma.js` filters every query on that one column. That
design assumes one Domaine has exactly one Cellarmaster, because that was
exactly what it was asked to assume at the time. Several Cellarmasters of
the same Domaine needs a level of indirection that isn't there: a
`Domaine` entity that a `User` belongs to (possibly more than one, with a
role per membership - a `DomaineMembership(userId, domaineId, role)` join
row), with `ownerId` on the three roots becoming `domaineId` rather than
pointing at a person directly. Not a small migration - every one of the
~100 scoped call sites inherits its correctness from `ownerId` meaning
"this exact person," and that assumption would need re-examining wherever
a role check (Cellarmaster vs. guest-like) has to gate a *write*, not just
filter a *read*. The invite list (`Invite`, flat and global today - see
"Decided with the owner" point 1 above) would likely need to become
per-Domaine too, which is its own small design question.

**This is also "Phase 4" from the separate-cellars phasing above**,
originally worded as "what guests become... fold into accounts, or keep
as the deliberately-lighter 'browse someone else's cellar' mode" - the
same question this entry's own "guest-like" role restates almost exactly,
just eight days later and with a name (Cellarmaster/guest-like) attached.
The phasing list now points here instead of carrying its own copy, so
there's one open write-up of this question, not two drifting
independently.

### Decided with the owner, 2026-09-28

Three of the open questions above, settled before picking this up rather
than guessed at in a migration:

1. **One Domaine per User, not several.** No `DomaineMembership` join
   table, no "which Domaine is active" switcher to build anywhere -
   `domaineId` (and `role`) live directly on `User`. Simplest shape for
   the actual ask (a family/friends cellar, a couple of full-access
   people and some guest-like ones); a person who somehow needed a second
   Domaine would need a second account.
2. **The anonymous `/guest` link stays exactly as it is, alongside the
   new Guest-like role** - not replaced by it. `/guest` is still the
   zero-friction way to share with a stranger or a one-off visitor; the
   new role is for someone invited as a real member of the Domaine, tied
   to their own sign-in. **Reversed 2026-09-28: the anonymous link was
   retired** (BACKLOG #51) once invited Guests existed and Phase 4's
   per-section access was decided for them - `/guest` is now for Guest
   members only.
3. **This session builds Phase 0 only** - schema and membership, nothing
   wired up yet - mirroring how "Separate cellars per user" itself was
   staged, rather than sweeping the ~100 already-scoped call sites and
   building role-gated writes and the invite-role UI in one pass.

### Phase 0 — schema and membership. Done 2026-09-28.

A real `Domaine` model, and `User.domaineId` (`onDelete: Cascade`) +
`User.role` (`"cellarmaster"` | `"guest"`), both NOT NULL. Nothing reads
either column yet - the ownership roots (`Bottle.ownerId` etc.) and
`lib/scoped-prisma.js` are untouched on purpose, the same way the
original Phase 0 added `ownerId` "backfilled with zero orphans... nothing
reads it yet."

**The backfill this time: one new Domaine per existing User, never
merged.** Every User today is already its own fully separate cellar (the
original "Separate cellars per user" decision), so the migration creates
one `Domaine` row per existing `User`, sets that User's `domaineId` to
point at it and `role` to `"cellarmaster"` - and never consolidates two
existing Users into one shared Domaine. Silently merging two people's
previously-separate cellars would be exactly the kind of leak this
schema's own scoping exists to prevent; giving each of them their own new
Domaine to invite someone else into later is the only backfill that
can't do that by construction.

**`domaineName`/`domaineMotto` moved off `User` onto `Domaine.name`/
`motto`** in the same migration - the move both fields' own schema
comments already said would happen "if Shared Cellars is ever built."
Renamed without the redundant `domaine` prefix now that they live on a
model already called `Domaine`. The four places that read/wrote them
(`/invites`' own form and Accounts list, both Guest screens,
`setDomaineDetails`) now go through the `domaine` relation instead -
required to keep the app buildable, not scope creep, since leaving them
pointed at dropped columns would have broken the very features built two
sessions ago.

`currentDomaineId()` (`lib/owner.js`) is the new seam this phase adds,
matching `currentOwnerId()`'s own reasoning for staying uncached (a
stale value here would serve one person's identity, or one Domaine's
data, into another's request) - a one-line lookup from `currentOwnerId()`
to that User's `domaineId`, used today only for account-level Domaine
settings, not yet for scoping any bottle/flight/pairing.

Verified against a real backfill, not an empty database: seeded a
pre-existing named Domaine ("Rucker Family Cellar," with a motto) the way
an already-migrated production database would have it, ran this migration
against that data, and confirmed the name/motto survived onto the new
`Domaine` row, `domaineId`/`role` backfilled correctly, the scratch
correlation column the migration uses internally was gone afterward, and
every page that reads Domaine data (`/invites`, `/guest`) rendered
exactly as before. `Bottle`/`TastingFlight`/`SavedPairing`'s own foreign
keys confirmed untouched.

### Phase 1 — the Domaine owns the cellar; invites say how you join. Done 2026-09-28.

**Ownership moved.** `Bottle`, `TastingFlight`, `SavedPairing` and
`ResearchJob` each gained a NOT NULL `domaineId` (backfilled from the
row's existing owner's Domaine, so nothing separate before is shared
after), and `lib/scoped-prisma.js` now scopes by it - so every member of
a Domaine sees one cellar. The same file stamps `domaineId` onto every
root-model create (refusing one naming another Domaine), and refuses any
operation on a scoped model it doesn't explicitly handle rather than
passing it through unscoped. `ownerId` on the three roots stays as
attribution - who added it - now nullable with `ON DELETE SET NULL`, so
removing one member can never cascade away the cellar everyone else uses.
None of the ~100 already-scoped call sites had to change; the region
cache, the research job/step, `/research`'s running-job lookup and the
export's favorites filter - the explicit, plain-client filters - moved
from `ownerId` to `domaineId` by hand.

**Roles are enforced where the data is.** `lib/owner.js` has
`currentMember()` (`{ id, domaineId, role }`, off the session - the
session callback fills both from the User row the adapter already read)
and `currentCellarmaster()`, which refuses a guest-role member.
`lib/scoped-prisma.js` calls the latter for *every* scoped query, reads
included, since a guest member browses through `/guest`'s own view and
never needs that client. Scan and Suggest, the two actions that call
Claude before touching the database, check it up front so a refusal
comes before the spend. The owner layout redirects a guest member to
`/guest`; `/export` returns 403 for them.

**Invites say how you join.** `Invite` gained `domaineId` (the Domaine
that sent it - whose list it shows on, who can revoke it) and `access`:
`cellarmaster` or `guest` join that Domaine; `separate` founds a new,
empty one (what every invite meant before, and what existing ones were
backfilled to - apart from each founder's own bootstrap invite, recorded
as `cellarmaster`). `createUser` in `lib/auth.js` reads it once, at
account creation. That also fixed a real bug Phase 0 introduced: the
stock-adapter create path set neither `domaineId` nor `role`, both NOT
NULL, so every invited sign-in since Phase 0 would have failed at the
database. `/invites` now shows only this Domaine's invites and members
(with roles), picks the access per invite, and won't revoke your own.

**Guest members.** A guest-role member's favorites go through a `Guest`
row linked by the new `Guest.userId`, created on their first `/guest`
visit and named from their account - no name form, and "Sign out"
instead of "Not you?". A Cellarmaster visiting `/guest` previews their
own Domaine; anyone without a session still gets the original cellar.
All three are resolved in one place, `resolveGuestView` in
`lib/guest.js`, which `toggleFavorite` uses too.

**Verified** against a pre-existing two-account database (the backfill
kept both cellars separate, zero mismatched rows), then end to end with
accounts switched on, signing people in through Auth.js's real email-link
callback: an invited Cellarmaster joined the owner's Domaine and saw and
added to the shared cellar; an invited guest was redirected to `/guest`,
favorited, and got 403 from `/export`; a "separate" invite got a new
empty Domaine; the pre-existing second account stayed separate. `npm run
verify` clean with accounts on and off, and the full migration chain
matches the schema from an empty database.

**Changing a role and removing a member - done 2026-09-28**, same day, on
the Members list. Both only reach members of your own Domaine and never
your own row (enforced in the query, not just by the missing button),
which is also what guarantees a Domaine always keeps a Cellarmaster: the
person acting. A role change takes effect on the member's next request
and keeps their invite's `access` in step, so the Invited list stays
truthful. Removing someone deletes their account (one Domaine per User,
so there's nowhere else for it to go) together with their invite in one
transaction - otherwise their next sign-in would recreate the account -
which also drops their sessions, so they're signed out immediately.
What they added stays; its `ownerId` clears. Verified end to end:
demote -> bounced to `/guest` on their next request, promote -> back in,
remove -> account/invite/sessions/Guest row gone and a fresh sign-in
refused, and a removed Cellarmaster's flight still in the cellar.

**Still open:** inviting an address that already has an account into a
different Domaine (it would need to leave its own - one Domaine per
User). ~~The anonymous `/guest` link is still the original cellar's
only.~~ Moot - the anonymous link was retired 2026-09-28 (BACKLOG #51).

## Phase 4, decided — a guest's access, section by section — 2026-09-28

**Decided with the owner:** inviting someone as a Guest offers a
checkbox for each part of the Domaine they can see - **Cellar**,
**Tasting Notes**, **Flights**, **Pairings** and **Wish List** - instead
of today's fixed "browse the Cellar and favorite." Not yet started;
recorded so building it starts from the decision rather than from
scratch.

**What each section maps to in the schema:**

| Section | Rows it shows | Owner page it mirrors |
|---|---|---|
| Cellar | `Bottle` with status `inventory`, plus favoriting (today's `/guest`) | `/inventory` |
| Tasting Notes | `Bottle` with status `consumed`, and its `TastingNote`s | `/consumed` |
| Flights | `TastingFlight` + its `FlightPick`s | `/flights` |
| Pairings | kept `SavedPairing`s + their `PairingPick`s | `/pairings` |
| Wish List | `Bottle` with status `wishlist` | `/wishlist` |

**The shape this points to, to confirm at build time:**

- **Stored on the invite, copied to the member.** `Invite.guestSections
  String[]` is chosen on the form, and `createUser` (lib/auth.js) copies
  it to `User.guestSections`, the same way `access` becomes `role` today.
  The member's own copy is what's enforced, so the Members list can
  change it later without a new invite - the same place #49 put role
  changes. Empty for Cellarmasters, who see everything.
- **Every section read-only.** A Guest still never adds, edits, scans or
  runs Suggest - that's the line between Guest and Cellarmaster, and it
  also means a guest never triggers an AI call, which is what keeps
  Phase 3's "guests have nothing to count" true.
- **Read-only guest pages, not the owner pages with the buttons hidden.**
  The owner pages are full of edit controls and Server Actions; hiding
  them per role would put "is this person allowed to press this?" in
  every component. Instead the `(guest)` route group grows a page per
  section, each querying explicitly - the same way `/guest` already does
  - and `lib/scoped-prisma.js` stays Cellarmaster-only. A section left
  unticked is simply not linked, and its page refuses to render.
- **Flights and Pairings reach into the Cellar.** A flight's picks are
  bottles, and possibly bottles from a section the guest wasn't given.
  The simplest honest rule: a pick shows the wine's name either way (it
  is part of the flight), but only links through to the bottle when the
  guest can see the section that bottle is in.

**Still open:**

- ~~**Defaults.**~~ **Decided 2026-09-28: Cellar only**, matching
  today's behaviour; the other four are opt-in per invite.
- ~~**The anonymous `/guest` link.**~~ **Decided 2026-09-28: retired**
  (BACKLOG #51), so per-section access only ever applies to invited
  Guest members - there is no second kind of guest to design for.
- **Existing guest members** would be backfilled to Cellar only, which
  is exactly what they can see today.

## Sharing a single Flight or Tasting Notes — raised 2026-09-27

Narrower than either multi-person idea already above. Both of those are
about several people all seeing (or co-owning) the *whole* Domaine; this
is about handing one specific thing - a saved Flight, or a bottle's
Tasting Notes - to someone else's view, named for two different
audiences: other people who have their own Cellarmaster account
("members" - a User of some Domaine, their own or another's), and people
who don't ("non-members").

**Closest existing precedent: the Guest link** - retired 2026-09-28
(BACKLOG #51), so this is history now, but the question it raised still
stands for sharing a single thing with a non-member. `/guest` did the
"non-member, no login, a link" half of this, but for the *whole* cellar
(browsing plus favoriting), not one flight or one bottle's notes. Whether
this is a scoped variant of that same mechanism (a Flight-shaped or
Notes-shaped guest link) or a genuinely separate share primitive is the
first thing to settle.

**Decided 2026-09-27: copying a shared Flight or Tasting Notes into one's
own Domaine is itself a feature, not just a possibility to weigh.** A
member who receives a shared Flight can copy it in as a new
`TastingFlight` (and its picks) of their own; shared Tasting Notes copy in
onto the recipient's own matching bottle if they own one, or otherwise
land as freestanding notes not yet attached to any bottle they hold. A
snapshot at the moment of copying, not a live link back to the sender's
original - the same reasoning `PairingPick.wineLabel` already uses
elsewhere in this schema (a snapshot so the copy doesn't move or vanish
if the original does). This answers what was previously the first open
question below; what's still open is *how* the recipient reaches that
copy action (reviewing a share before accepting it, versus one tap that
copies immediately).

**Not scoped beyond this.** Logged because the owner asked for it to be on
record, not because a plan exists yet. Open questions worth settling
before it's picked up:

- Whether copying is reviewed first (see a preview, then choose to copy)
  or happens the moment a share is opened - and, for a bottle a Tasting
  Note is copied onto, what happens when the recipient doesn't already
  own a matching bottle (create a new wishlist/flight-status bottle for
  it, or hold the note unattached until they do)?
- Whether "share" also grants read-only viewing or commenting without
  copying, alongside the copy action, or whether copying *is* the whole
  mechanism - no separate "just look at this" mode.
- For a member recipient specifically: does this mean an in-app
  notification or inbox ("X shared a flight with you")? That's a
  member-to-member social feature with no analog today - every other
  feature in this app is one person's private tool, even Shared cellars
  above is one Domaine shared among trusted Cellarmasters, not sharing
  *out* to an arbitrary other member.
- For a non-member: a link like the guest link, scoped to one flight or
  one bottle's notes - does it ask for a name the way guest favoriting
  does, or stay fully anonymous? And can a non-member copy at all, or is
  copying a members-only capability since it needs a Domaine to copy
  *into*?
- The actual data boundary of a shared Flight: its picks name real
  bottles (producer, region, vintage) - does sharing the flight reveal
  those bottles' details to someone who otherwise can't browse the rest
  of the cellar at all?
- Whether "Tasting Notes" means one note, every note on one bottle, or
  that bottle's whole tasting history - both "Flight" and "Tasting Notes"
  are already real pages in this app (`/flights/[id]`, `/consumed`), so
  this may mean sharing a page's worth of content rather than one row.
