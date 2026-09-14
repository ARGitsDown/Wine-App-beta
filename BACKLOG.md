# Hygiene Backlog

Known data-model gaps and inconsistencies worth revisiting as the app
matures. These aren't new features — they're refinements to data we
already collect, where the current model is a working simplification
rather than a wrong one. Add to this list as new gaps surface; check items
off (or delete them) once addressed.

## ~~1. Standardized/canonical varietal name~~ — done

`variety`/`type` still store whatever name is printed or regionally
conventional, but filtering now also resolves a search term to a
canonical grape (via `lib/varietals.js`'s ~140-entry reference list and
`lib/varietal-match.js`) and matches any bottle logged under a synonym -
so "show me all my Grenache" also finds a bottle logged as Garnacha or
Cannonau, without changing what's actually printed in `variety`. Covers
all the synonym clusters originally called out here (Grenache/Garnacha/
Cannonau, Mourvèdre/Mataro/Monastrell, Pinot Noir/Pinot Nero/
Spätburgunder, Syrah/Shiraz, Zinfandel/Primitivo, Sauvignon Blanc/Fumé
Blanc) plus many more. A blend or an unrecognized/obscure grape
deliberately falls back to plain substring matching rather than a guess.

## ~~2. Regional hierarchy depth~~ — lightweight version done

Added one more flat, optional field - `subRegion` - alongside `region`
(e.g. "Margaux" under region "Bordeaux"), rather than the full Country/
Region/Sub-Region/Appellation depth CellarTracker tracks. Both scanning
and manual entry fill it in, and it's filterable like every other field.
A genuine multi-level hierarchy (Bordeaux → Médoc → Margaux, each with
its own identity rather than a string) is still open if `subRegion` alone
proves insufficient, but that's a bigger schema question than this was.

## ~~3. Wine color/category, distinct from `type`~~ — done

`wineColor` is a new field with a fixed vocabulary (Red/White/Rosé/
Orange/Sparkling/Dessert/Fortified - see `lib/wine-colors.js`), separate
from `type`/`variety`. The scan feature infers it from the label/photo;
manual entry is a plain dropdown rather than an auto-guess, since the
same grape can make wines of different colors (a Pinot Noir rosé, for
instance) and a text-only guess could confidently mislabel one. "Show me
all my whites" now works via the Color filter on Inventory/Wishlist/
History.

## ~~4. Drinking window~~ — done

`drinkFrom`/`drinkTo` (year, both independently optional) are now
captured - filled in by the scan feature when the label/sheet states one
or there's a genuinely confident basis to estimate it, otherwise left
null rather than guessed. The Suggest feature's `browse_cellar` tool now
returns each candidate's window and is told the current year, and is
steered toward a bottle that's actually ready over one that's too young
or past peak (falling back honestly rather than silently ignoring the
window when nothing ready fits). Shown on the bottle detail page as a
"ready / too young / past peak" badge.

## 10. Dates: when it was tasted, and when it arrived

Out of numeric order on purpose: section numbers are referenced from
README.md and from commit messages, so they stay put. This sits here
because it outranks #5 below. The app has one real date and two
implied ones, and can't distinguish them:

- ~~`TastingNote.tastedAt` exists and defaults to `now()`, but nothing in
  the UI ever sets it~~ — done. The add-note form has a "Tasted on" field
  defaulting to today (and capped at today), and the date on an existing
  note is editable in place, since every note written before this was
  stamped with whenever it got typed up. Dates are anchored at noon UTC
  and always formatted in UTC - see `lib/tasting-date.js` for why a
  date-only value in a DateTime column otherwise drifts a day each time
  it round-trips.
- `Bottle.createdAt` is "when this row was made", which the app quietly
  treats as "when it entered the cellar". For a bottle scanned off a shop
  shelf into the wishlist, or one scanned from a tasting sheet straight
  into History, that reading is wrong.
- ~~Nothing records **when a bottle was emptied**~~ — done. `emptiedAt`
  is stamped by whichever action moves a row into History (the "Tasted"
  buttons, a scan card set to History, a wine created straight into it)
  and cleared if it ever moves back out, so a bottle returned to
  Inventory can't keep claiming a date. Editable on the bottle's page,
  which also lets rows that reached History before the column existed be
  backfilled - they read "Emptied date unknown" rather than showing a
  wrong date. History gains a "Recently emptied" sort, which is the
  ordering that page actually wanted ("recently added" on a consumed
  bottle means when the row was typed in, which is close to meaningless
  there).

Only the middle item is left. The question it waited on - **what is the
app recording when a wine is added?** - is now answered: `/scan` asks
outright (see `lib/scan-intent.js`), so every batch declares whether it's
stocking the cellar, noting wines for later, or drinking them now. That
was the missing signal; the guessing it replaced is described there.

One smaller question remains before an acquired date can land:

- Does a bottle that goes straight to History need one at all? It never
  sat in the cellar, so arguably not - but a tasting sheet from a shop
  visit does have a real date worth keeping.

The other is settled: **acquired is a new nullable `acquiredAt` column**,
not a relabelled `createdAt`. Relabelling would assert that every row's
creation timestamp is its acquisition date, which is wrong for anything
scanned off a shop shelf or a tasting sheet; a separate column leaves
existing rows honestly null and keeps "when the row was typed in"
available as its own distinct fact.

With the intent picker in place, the shape is straightforward: a `cellar`
scan means acquired today, a `tasting` scan means emptied today (already
handled), and `wishlist` means neither.

## 5. Bottle size / format

`quantity` counts bottles but doesn't distinguish sizes (375ml half,
750ml standard, 1.5L magnum, etc.) — two half-bottles and two magnums
both just read "quantity: 2" today, which understates or overstates how
much wine you actually have.

## ~~6. Alcohol % (ABV)~~ — done

`abv` (a float, e.g. 14.5) is now captured - filled in by the scan
feature when printed on the label (nearly always), and editable manually
otherwise.

## 7. Drinking window: default to an estimate, never leave blank

Today's scan/Research only fill `drinkFrom`/`drinkTo` when there's a
stated date or a "genuinely confident" basis - otherwise both stay null,
which conveys nothing. For a cellar large enough that bottles are
actively passing their peak, a rough estimate you can refine beats a
blank you have to remember to fill in yourself. Plan:

- ~~**New field**: `drinkWindowEstimated` (bool)~~ — done. Distinguishes
  an AI guess from a confirmed window (label text, a real Research
  citation, or anything a person typed by hand) - shown as a distinct
  "· estimated" badge next to the drinking-window pill on the bottle
  detail page. A plain edit through the Details form clears it back to
  false when the years actually change, and leaves it alone otherwise
  (e.g. editing Notes doesn't clear it).
- ~~**A one-time bulk backfill action**~~ — done. `/estimate-windows`
  (linked from a banner on Inventory when any bottle qualifies) estimates
  every inventory bottle with no window at all (both `drinkFrom` and
  `drinkTo` null - a partial window left open-ended on purpose is never
  touched) and applies the results directly, not reviewed one-by-one,
  since that isn't practical at hundreds of bottles. Chunked client-side
  (20 bottles/request) so a single request never risks a serverless
  timeout across a large cellar.
- **Every add path fills it in, not just the one-time pass**: the scan
  tool's schema changes from "only if confident" to "always propose your
  best estimate," and Research's fallback (when its web search finds
  nothing stated) does the same instead of leaving the field untouched.
  A lightweight "Estimate" action (producer/variety/region/vintage only,
  no web search - cheaper and faster than full Research) covers manual
  entry.
- ~~**A small cache**~~ — done. `DrinkWindowEstimate` stores each answer
  against a normalized producer/bottling/grape/region/vintage key (see
  `lib/drink-window-cache.js`), so the same wine is never asked about
  twice - whether it appears as two rows in one batch or comes back
  months later. Case and spacing are normalized, so "Domaine Tempier"
  and "domaine tempier " share an entry. An all-null answer is
  deliberately not cached: the model having nothing this time shouldn't
  permanently stop us asking again. The backfill panel reports how many
  were reused. Still not a hand-curated reference table - that would need
  the same domain judgment we're asking the model for, just harder to
  keep current.
- ~~**A "drink soon" sort/view**~~ — done as part of the sort control in
  #9 below. Orders by urgency (past peak -> ready -> too young -> no
  window on file), and within each group by whichever window closes
  soonest, so "ending soon" falls out without needing its own bucket.

This turns "estimate the backlog" from a one-time fix into how the field
behaves going forward.

## 8. Speed improvements that would add cost

From the app-wide speed review. Everything here would genuinely make the
app faster, but each one costs something per use, so all of it is parked
until that trade is worth making. The free speed work (client-side
filtering, `loading.js` skeletons, trimming over-fetched queries, DB
indexes) is tracked separately as ordinary work, not here.

- **Optimized label thumbnails.** Inventory rows and the bottle detail
  page render label photos through a plain `<img>` pointed straight at the
  full-size Blob upload, then scale it down to a ~64×80 thumbnail in CSS.
  A phone on cell data downloads every full-resolution photo to show a
  postage stamp. `next/image` fixes this automatically, but image
  optimization is metered on Vercel, so it trades bandwidth for billed
  transformations. The free alternative - generate and store a small
  thumbnail at upload time, since `lib/client-image.js` already downscales
  before upload - costs a second Blob object per photo instead, which is
  much cheaper but not nothing.
- **Re-scan existing bottles to fill gaps in bulk.** A pass like
  `/estimate-windows` but for every empty field (missing `wineColor`,
  `subRegion`, `abv`) across the whole cellar. Straightforward to build on
  the batching that's already there, but it's one AI call per batch over
  the entire inventory - the same shape of spend as the drinking-window
  backfill, repeated per field group.
- **Precomputed "drink soon" digest.** BACKLOG #7 already wants a
  drink-soon sort. Going further - a scheduled job that emails or pushes
  "these three are hitting their window this month" - needs a cron and a
  delivery channel, both recurring costs for something the sort itself
  mostly solves for free.

## 9. Usability gaps from the app-wide review

Loose ends from the same review that produced #8. None of these cost
anything to build - they're here because they were found in one pass and
shouldn't live only in a chat log. Roughly in order of how often they'd
bite someone actually using the app.

- ~~**Changing quantity takes a full page load and a form**, and **"Mark
  as finished" ignores quantity entirely**~~ — done. A row is the wine
  rather than an individual bottle, so "finished" only means anything
  once the last one is gone: `markOneTasted` decrements above one and
  moves the row to History only on the last, with "Tasted all N" kept
  alongside for retiring a whole lot at once. Tasting notes stay attached
  either way, and since each carries its own date they remain the record
  of when each bottle was actually drunk. Inventory and Wishlist rows
  also got an inline +/- stepper (floored at 1 - dropping to zero is what
  finishing is for), so correcting a count no longer means opening the
  bottle's page and saving a form.
- ~~**No sort control**~~ — done. A Sort control sits next to the filter
  panel (outside it, so reordering costs one click rather than two):
  producer A-Z, drink soon, recently added, vintage either direction, and
  highest rated. It sorts client-side alongside the filtering, syncs to
  the URL, and survives a Clear. A missing value always sorts last - an
  NV champagne belongs after every vintage, in both directions, not
  clumped at whichever end is numerically extreme. Options are trimmed
  where they don't apply: no drink-soon on History, and neither that nor
  rating for a guest. This also covers #7's "drink soon" bullet below.
- ~~**Deleting a bottle has no confirmation**~~ — done. Deleting a
  bottle, removing one of its photos, or deleting a saved flight now all
  take a second click, via a shared `ConfirmButton`. It's a two-step
  inline control rather than a native `confirm()` dialog specifically so
  it can name what's about to go with it ("Also deletes 2 tasting notes
  and 2 guest favorites") - "are you sure?" on its own tells you nothing
  you didn't already know. Scan's "Remove this one" is deliberately left
  alone: discarding cards you didn't want is the normal path through that
  review flow, not an accident worth interrupting.
- ~~**Sharing the guest link is manual**~~ — done. The `/guest` mention
  on Inventory is a button now: it opens the native share sheet where
  one exists (which is how you'd actually send this to someone from a
  phone) and otherwise copies the full URL, with a brief "Link copied"
  confirmation.
- ~~**Scanning a batch shows no overall progress**~~ — done. A bar above
  the photo list tracks the batch as a whole ("3 of 9 photos read…", with
  a running count of wines found), then settles into a summary once
  everything is in ("Read 9 photos — 12 wines saved", plus how many
  couldn't be read). It counts completions rather than naming a current
  photo, since three are processed at once, and it derives from the photo
  list itself - so picking more photos mid-run raises the total instead
  of starting a second, competing count.
- **`/estimate-windows` progress jumps around.** Batches run concurrently
  now, so the counter advances 20 at a time and out of order. Cosmetic,
  but it looks like a glitch.
- ~~**`getRegionOptions()` is uncached**~~ — done. Wrapped in
  `unstable_cache` behind a `region-options` tag, invalidated wherever a
  bottle is created or edited (the only way a new region name can
  appear), with an hourly revalidate as a backstop. Deliberately not
  invalidated on delete: a suggestion for a region you no longer own is
  harmless, and the backstop clears it eventually.
- **`thinking: adaptive` on the extraction calls is probably not earning
  its latency.** All five Claude calls set it; the four now on the
  lighter model are structured extraction ("read this back label, invent
  nothing"), where deliberation buys little. Worth measuring with it off
  for the added-photo read and the drinking-window estimates.
- **The lighter-model switch has not been checked against real bottles.**
  Scan, Research, window estimates and photo reads moved to a mid-tier
  model without a live API key available to test. Grape-from-appellation
  inference and the `bottling` field are where a regression would show up
  first.

## ~~11. Steering the character of a suggestion~~ — done

Suggest used to infer two things from one freeform box: pairing vs
tasting flight, and what "good" means. The second inference was the
shakier one - asked for something with roast chicken, a white Burgundy
(classic), a Jura Savagnin (exploratory) and a chilled Trousseau
(avant-garde) are all defensible, and which one you want depends on the
evening rather than the dish.

A **Character** control - Balanced / Classic / Exploratory / Avant-garde -
now sits next to the request box, beside the cellar/outside checkbox, and
shows only the selected option's hint so four explanations don't compete
with the request itself. The four questions this waited on, as answered:

- **Pairings, flights, or both?** Both, one control. A flight's theme box
  says what the theme is, not how far out on a limb to go for it.
- **Is "balanced" a fourth option or the default?** The default, and it
  contributes nothing to the prompt - it is the unset state with a
  visible name. The template gained exactly one empty-when-balanced
  splice point, so an unsteered request sends the same bytes it sent
  before the control existed.
- **Picks or only the ordering?** The picks. The steer says outright that
  it must change which wines are chosen, since an exploratory write-up of
  the obvious bottle isn't what was asked for.
- **How does it interact with the cellar/outside toggle?** The steer sits
  after that rule and refers back to it, so "avant-garde" against a
  conservative cellar means finding the boldest thing actually in it
  rather than quietly dropping the constraint.

The wording worry was real and is handled in the prompt rather than the
label: "avant-garde" is defined as a claim about the *choice*, not the
wine - a traditional bottle in an unexpected role counts, an orange wine
picked because it's the obvious match doesn't. Whether the four words
earn their keep against real menus is still worth watching; the rules
live in `lib/suggestion-character.js`, one string each.

## ~~12. Summarize a tasting: a title, not a paragraph~~ — done

`record_suggestions` now returns a short evocative `title` ("The Many
Faces of Pinot") alongside the `summary`, and the two are described to the
model as separate jobs so neither collapses into the other. The Suggest
result leads with the title under a small mode label and keeps the
summary behind a "Why these" disclosure - on a phone that lifts the first
wine 144px up the page, and further as the summary grows. A saved flight
shows its title as the heading in the list and on its own page, with the
summary spelled out beneath it there (you clicked through to that page, so
it isn't hidden behind a second disclosure).

The three open questions, as settled:

- **Disclosure, not a separate view** - there was no second thing to put
  on such a view, and the disclosure matches how the per-pick reasons
  already expand.
- **Flights saved earlier keep showing their summary** as the heading,
  because that is genuinely all they have. `title` is nullable and the
  fallback is one `||` in three render paths - no backfill, so no AI call
  per old flight and nothing in #8's cost-bearing bucket.
- **Pairings get a title too.** It replaces the static "Pairing
  suggestions" label, which said nothing about the actual answer. Only
  flights persist one.

The "log a tasting note" link now carries the flight id rather than its
text, so the prefill renders whichever of title/summary the flight
actually has instead of a copy frozen into the URL. Non-numeric values
still pass through, so older links and bookmarks keep working.

## 13. Scan straight into the wishlist

`/scan` already asks what a batch is for and `wishlist` is one of the three
answers (see `lib/scan-intent.js`), so the capability exists - it just
isn't reachable from the page where you'd want it. Standing in a shop
photographing shelf talkers, you go Home → Scan → pick "Noting for later",
when the obvious move is a Scan button on Wishlist itself.

The work is plumbing, not features:

- A **Scan bottles** control on `/wishlist`, linking to `/scan?intent=wishlist`.
- `/scan` reads that param as its initial intent. The page is currently one
  big client component, so this wants a thin server `page.js` that reads
  `searchParams` and passes `initialIntent` down - the same shape every
  other page in the app already uses, and it avoids `useSearchParams`
  forcing a Suspense boundary around the whole scanner.
- The intent picker stays visible and changeable. A link that silently
  locks the intent would be worse than the status quo, because the one
  thing the picker fixed was scans going somewhere you didn't choose.

No schema, no new AI calls. Worth doing the same for Inventory
(`?intent=cellar`) in the same pass, since it's the identical change and
the asymmetry would be odd.

**Size: small.** One file split, one param, two buttons.

## 14. Research: one click from the list, and a review queue

Today research is three clicks and a page change per bottle: open
`/research`, click into the wine, click Research, wait, review the
prefilled form, save. For a scan that flagged a dozen bottles that's a
dozen round trips, and `/research` itself is a list of links that can't
actually *do* anything.

Two changes, and the second is the one with teeth:

**One-click from the list.** Each row gets a Research button that runs the
call without leaving the page.

**A review queue.** This is the part that needs new storage. A research
result currently lives in React state on the bottle page and is gone if
you navigate away - there is nowhere for "researched, not yet approved" to
exist. A queue means persisting the proposal:

- A **`ResearchProposal`** row per bottle (unique on `bottleId`), holding
  the proposed values, the model's summary, and its source URLs.
- `/research` splits into two sections: **To research** (`needsResearch`,
  no proposal yet) and **Ready to review** (a proposal is waiting).
- Reviewing shows a real **diff** - current value beside proposed value,
  field by field. That is strictly better than today's prefilled form,
  which shows you the answer but never tells you what it changed.

Worth settling first:

- **How much does one click cost?** Research is the app's only web-search
  call and its most expensive by a distance. A per-row button is one
  bottle's worth of spend and is safe. A "Research all 12" button is
  twelve, in one tap, and belongs behind a count and a confirmation - or
  in #8 with the other cost-bearing work. The two aren't mutually
  exclusive; the question is whether the bulk button ships at all.
- **Approve whole, or field by field?** Research is routinely right about
  four fields and wrong about one, which argues for per-field checkboxes.
  Whole-proposal approval is much less work and can be edited before
  saving, which is what the current form does. This is the biggest fork in
  the build.
- **What happens to a stale proposal?** If the bottle is edited after
  research runs, the proposal was computed against values that no longer
  exist. Either store the "before" snapshot and flag the ones that moved,
  or drop proposals whenever their bottle is updated. The second is a line
  of code; the first is honest about what you're approving.
- **How is the proposal stored?** One `Json` column is flexible and never
  needs a migration when the research schema changes, but can't be queried
  or type-checked. Mirrored nullable columns (about twelve of them) are
  typed and diffable but duplicate the Bottle schema. For a personal app
  the Json column is probably right, with the shape documented next to
  `RESEARCH_TOOL`, which is already its single source of truth.

**Size: large.** Schema plus migration, new actions, `/research` rebuilt
into two sections, a diff review component, client-side batching if the
bulk button ships, and staleness handling.

## 15. Building a flight by hand

Flights only exist as Suggest output. There is no way to say "I want a
Barolo evening" and assemble it yourself, which is the more obvious way to
plan a tasting than asking for one and hoping.

Two entry points, and they want to agree with each other:

- **`/flights/new`** - a theme name, then search your inventory and add
  bottles in tasting order.
- **Add to a tasting** on each bottle card, so a flight can be built while
  browsing rather than only from a dedicated page.

Two schema facts make this more than a UI job. `TastingFlight.summary` is
**required** and `FlightPick.reason` is **required**, because every flight
so far came from a model that always wrote both. A hand-built flight has a
title and, often, nothing else to say - so both need to become nullable,
and the three places that render them need to stop assuming a string. The
`title || summary` fallback added in #12 also has to hold when `summary`
is null, which means guaranteeing at least one of the two is set at write
time rather than trusting the column.

Worth settling first:

- **Where does "add to a tasting" put the bottle?** Either a menu of
  existing unfinished flights plus "New flight…", which works immediately
  and needs no new state; or a draft you accumulate while browsing and
  name at the end, which is the nicer flow and needs somewhere to hold a
  draft (a `draft` flag on the flight, or browser storage that can't be
  read back by anything else).
- **Inventory only, or anything?** Suggest only ever saves owned bottles,
  on the reasoning that a flight is a queue to pull from. A hand-built
  flight might reasonably include a wishlist bottle you intend to buy for
  the occasion.
- **Does the order matter enough to edit?** A flight is a sequence and
  `FlightPick.order` already exists. Add-order alone is the cheap version;
  up/down controls are a small addition; drag is not.
- **Is a description optional or prompted?** Making `summary` nullable is
  the schema answer, but a flight with no description loses the "Why
  these" disclosure entirely. An optional field that most people skip is
  fine; the question is whether the flight page looks unfinished without
  it.

**Size: medium-large.** Two nullable migrations and their render sites, a
create page with an inventory picker (reusing `lib/filter-bottles.js`), a
per-card control on inventory and the bottle page, and one new action.
Guest views must not get any of it.

## Lower priority / optional

- **Price tracking** — what you paid, or current market value. Useful for
  cellar valuation, but a bigger feature than a hygiene fix. The
  tasting-sheet scan already sees "Regular $X / Sale $Y" pricing and
  currently just folds it into free-text notes.
- **Critic scores** — a wine's Wine Spectator/Parker/etc. score, distinct
  from your own personal rating. Nice-to-have, not urgent for a personal
  cellar app.

Sources consulted:
[CellarTracker's field model](https://support.cellartracker.com/article/19-adding-new-wines),
[Wine Spectator's drinking window](https://help.winespectator.com/support/solutions/articles/29642-what-is-a-drink-recommendation-or-drinking-window-),
[TTB label/ABV labeling rules](https://www.ttb.gov/regulated-commodities/beverage-alcohol/wine/labeling-wine/wine-labeling-alcohol-content).
