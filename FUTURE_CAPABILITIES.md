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
   credential breach to worry about. The library's Next 16 compatibility
   needs verifying before it's committed to.
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

- **Phase 0 — ownership, still single-user.** Add `ownerId` to the three
  root models (nullable → backfill everything to one seeded owner → NOT
  NULL). No auth, no behaviour change, fully reversible. The migration
  risk gets its own step, where nothing else can confuse it.
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

- Which OAuth library, and whether it's compatible with Next 16 — to be
  verified, not assumed, before Phase 1 starts.
- What happens at the usage cap: hard block, or degrade to the
  non-AI features.
- Whether renamed/hand-built flights and kept pairings need anything
  beyond a plain `ownerId` (they shouldn't — they're roots like `Bottle`).

## Multiple locations within one cellar

Wanted alongside the above, but explicitly **after** it: one owner whose
bottles live in more than one physical place (a fridge at home, a storage
unit, a second house). Much smaller than separate cellars per user — a
`location` on `Bottle` plus a filter, no accounts or ownership model
needed, since it's still one person's data. Genuinely easier once
ownership exists, and independent of it, so it isn't bundled into the
phases above.
