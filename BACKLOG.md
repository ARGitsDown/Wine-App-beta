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

## ~~10. Dates: when it was tasted, and when it arrived~~ — done

Out of numeric order on purpose: section numbers are referenced from
README.md and from commit messages, so they stay put.

The app had one real date and two implied ones. All three are now
distinct:

- **`TastingNote.tastedAt`** — the add-note form has a "Tasted on" field
  defaulting to today (and capped at today), and the date on an existing
  note is editable in place, since every note written before this was
  stamped with whenever it got typed up.
- **`Bottle.emptiedAt`** — stamped by whichever action moves a row into
  History, cleared if it ever moves back out. History gained a "Recently
  emptied" sort.
- **`Bottle.acquiredAt`** — when the wine entered the cellar, as opposed
  to `createdAt`'s "when the row was typed in". The Cellar and Tasting
  notes gained a "Recently acquired" sort.

Dates are anchored at noon UTC and always formatted in UTC — see
`lib/tasting-date.js` for why a date-only value in a DateTime column
otherwise drifts a day each time it round-trips.

`acquiredAt` is a **new nullable column**, not a relabelled `createdAt`.
Relabelling would have asserted that every row's creation timestamp is its
acquisition date, which is wrong for anything scanned off a shop shelf or
a tasting sheet; a separate column leaves existing rows honestly null and
keeps "when the row was typed in" as its own distinct fact.

It's derived from the status a row moves to, not set independently, so no
caller can forget it — the same shape as `emptiedAt`, but deliberately not
a mirror image of it, because owning a bottle and having drunk it aren't
opposites:

| moving to | acquiredAt |
| --- | --- |
| wishlist | cleared — you don't own it, so any date it carried stopped being true |
| cellar | stamped on arrival, never overwritten — "Bought it" is the real acquisition event, and a bottle back from History keeps its original |
| History | left exactly as it was |

The open question — **does a bottle that goes straight to History need
one?** — is answered no: it never sat in the cellar, so none is invented.
That falls out of the table's last row rather than needing a rule of its
own, and it's why the paths that only ever move a bottle into History
(`markOneTasted`) don't consult the rule at all. The payoff is the other
half of that row: a wine bought in 2019 and drunk in 2026 shows both
dates, which is the fact the column exists for.

Both rules live in `lib/bottle-dates.js` rather than `app/actions.js`,
because that file is `"use server"` and every export there has to be an
async Server Action — which would have left the most interesting logic in
this change untestable.

Two deliberate omissions. **No field on the add-bottle form**: the date is
stamped and then correctable on the bottle's page, exactly how `emptiedAt`
already worked, rather than adding a field to a form that was only just
grouped (#13). And **one case guesses**: switching a just-scanned card
from Cellar to Tasting notes leaves today's acquisition date on it, since
status alone can't tell "I mis-scanned this" from "I bought it today and
drank it tonight". It's visible on the bottle's page and clearable there —
the acquired-date editor takes an empty submission, because a wrong date
is worse than none.

## 5. Bottle size / format

`quantity` counts bottles but doesn't distinguish sizes (375ml half,
750ml standard, 1.5L magnum, etc.) — two half-bottles and two magnums
both just read "quantity: 2" today, which understates or overstates how
much wine you actually have.

## ~~6. Alcohol % (ABV)~~ — done

`abv` (a float, e.g. 14.5) is now captured - filled in by the scan
feature when printed on the label (nearly always), and editable manually
otherwise.

## ~~7. Drinking window: default to an estimate, never leave blank~~ — done

Scan and Research used to fill `drinkFrom`/`drinkTo` only when there was
a stated date or a "genuinely confident" basis - otherwise both stayed
null, which conveys nothing. For a cellar large enough that bottles are
actively passing their peak, a rough estimate you can refine beats a
blank you have to remember to fill in yourself. What that took:

- ~~**New field**: `drinkWindowEstimated` (bool)~~ — done. Distinguishes
  an AI guess from a confirmed window (label text, a real Research
  citation, or anything a person typed by hand) - shown as a distinct
  "· estimated" badge next to the drinking-window pill on the bottle
  detail page. A plain edit through the Details form clears it back to
  false when the years actually change, and leaves it alone otherwise
  (e.g. editing Notes doesn't clear it).
- ~~**A one-time bulk backfill action**~~ — done. `/estimate-windows`
  (linked from a banner on the Cellar when any bottle qualifies) estimates
  every bottle you own with no window at all (both `drinkFrom` and
  `drinkTo` null - a partial window left open-ended on purpose is never
  touched) and applies the results directly, not reviewed one-by-one,
  since that isn't practical at hundreds of bottles. Chunked client-side
  (20 bottles/request) so a single request never risks a serverless
  timeout across a large cellar.
- ~~**Every add path fills it in, not just the one-time pass**~~ — done.
  The scan tool went from "null rather than a speculative guess - most
  wines shouldn't get one" to "always give your best estimate", and
  Research's schema from "only if genuinely well-supported" to "prefer one
  your sources state; where they don't, still estimate". Manual entry gets
  an **Estimate drinking window** button on the bottle's page - the same
  tool, prompt and cache as the bulk pass, no web search, so a wine
  estimated here costs nothing when the backfill later meets it.

  Both tools now also return **`drinkWindowEstimated`** themselves, which
  is what makes the change safe: a model told to always guess will, so
  something has to carry whether the answer was read off a label, found in
  a source, or invented. Without it the "· estimated" badge would quietly
  become a lie, and the badge is the only reason always-guessing is
  acceptable at all.

  The accept paths had to learn the same distinction. Accepting a proposal
  wholesale carries the proposal's own flag; editing its years first is
  the human taking the call and clears it. The old rule - "the years
  changed, so a person must have decided" - was right for the Details form
  and wrong here, where the years always change relative to a blank field.

  Deliberately **not** changed: the photo-details reader. Its prompt is
  "read what is actually visible, don't invent" - telling its tool to
  always guess would have it contradict itself.
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

- **Optimized label thumbnails.** Cellar rows and the bottle detail
  page render label photos through a plain `<img>` pointed straight at the
  full-size Blob upload, then scale it down to a ~64×80 thumbnail in CSS.
  A phone on cell data downloads every full-resolution photo to show a
  postage stamp. `next/image` fixes this automatically, but image
  optimization is metered on Vercel, so it trades bandwidth for billed
  transformations. The free alternative - generate and store a small
  thumbnail at upload time, since `lib/client-image.js` already downscales
  before upload - costs a second Blob object per photo instead, which is
  much cheaper but not nothing. (`sharp`, which `next/image` would use, is
  now excluded from every server bundle - see #52 - so this option would
  also mean putting it back.)
- **Re-scan existing bottles to fill gaps in bulk.** A pass like
  `/estimate-windows` but for every empty field (missing `wineColor`,
  `subRegion`, `abv`) across the whole cellar. Straightforward to build on
  the batching that's already there, but it's one AI call per batch over
  the entire inventory - the same shape of spend as the drinking-window
  backfill, repeated per field group.
- **Precomputed "drink soon" digest.** BACKLOG #7 already has a
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
  of when each bottle was actually drunk. Cellar and Wishlist rows
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
  on the Cellar is a button now: it opens the native share sheet where
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
- ~~**`/estimate-windows` progress jumps around**~~ — done. The count was
  never wrong: twenty bottles land at once and three batches are in
  flight, so it sits still and then leaps. Beside a bare spinner that read
  as a stall. It now has the same progress bar a batch of scanned photos
  gets - the jumps read as progress against a filling bar - plus a line
  saying it advances in steps, shown only when there is more than one
  batch, since a cellar smaller than twenty goes 0 to done in one move and
  the explanation would be noise.
- ~~**`getRegionOptions()` is uncached**~~ — done. Wrapped in
  `unstable_cache` behind a `region-options` tag, invalidated wherever a
  bottle is created or edited (the only way a new region name can
  appear), with an hourly revalidate as a backstop. Deliberately not
  invalidated on delete: a suggestion for a region you no longer own is
  harmless, and the backstop clears it eventually.
- **`thinking: adaptive` on the extraction calls is probably not earning
  its latency.** All the Claude calls set it (six now, all through `ai.call()`; the lighter
  tier, Haiku 4.5, takes no thinking at all - see #54); the four on the
  extraction model are structured extraction ("read this back label, invent
  nothing"), where deliberation buys little. Worth measuring with it off
  for the added-photo read and the drinking-window estimates.

  Still open, and deliberately: this needs a measurement, and no live API
  key has been available in the dev sandbox. Turning it off unmeasured
  would be the same move as the untested model switch above, which is
  exactly the kind of change that is invisible until it is expensive. Two
  ways to close it - a key in the sandbox for a side-by-side, or timing
  logged around the calls so ordinary use answers it. One caveat on the
  framing above: the drinking-window estimate is not extraction. Judging
  when a wine will peak is the one call here that genuinely reasons, so
  it is the least likely of the four to be paying for nothing.
- **The lighter-model switch has not been rigorously compared.** Scan,
  Research, window estimates and photo reads moved to a mid-tier model
  without a live API key available to test. The owner's read after real
  use is that it "seems to be working okay", which retires this as an
  active worry - but it is a judgment from ordinary use, not a measured
  comparison. If scan quality ever feels off, grape-from-appellation
  inference and the `bottling` field are where a regression would show
  first, and a side-by-side against the heavier model is the check.

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

## ~~13. Scan straight into the wishlist~~ — done

`/scan` already asked what a batch was for, and `wishlist` was one of the
three answers - it just wasn't reachable from the page where you'd want
it. Both Wishlist and Inventory now carry a **Scan a label or shelf**
link, sitting with the by-hand add form rather than somewhere else, since
they're the two ways to add a bottle. The intent travels in the link
(`?intent=wishlist`, `?intent=cellar`), so the scanner opens already
pointed at the right place instead of defaulting to the cellar and needing
correcting.

The scanner moved to `app/components/ScanPanel.js` behind a thin server
`page.js` that awaits `searchParams` - the same shape every other page
uses, and it avoids `useSearchParams()` wrapping the whole scanner in a
Suspense boundary for one string. An unknown, empty or missing value falls
back to the cellar (`normalizeScanIntent`), so a stale link can't land on
an invented selection.

The picker stays visible and editable after arriving through a link. A
link that silently locked the destination would undo the thing the picker
was added to fix.

## ~~14. Research: one click from the list, and a review queue~~ — done

`/research` was a list of links that couldn't do anything: researching a
bottle meant opening it, clicking through, and reviewing a prefilled form
that never told you what it had changed. And a research result lived in
React state, so navigating away threw it out - "researched, not yet
approved" had nowhere to exist.

It exists now. **`ResearchProposal`** holds one pending answer per bottle,
so `/research` splits into **Ready to review** and **To research**. Each
row in the second gets a **Research** button; above them, **Research all
N** sits behind a confirmation that names how many live web searches it is
about to run, then works through the queue in small batches so no single
request carries the lot.

Reviewing shows a **diff** - current beside proposed, field by field, with
everything the model repeated back unchanged dropped - which the prefilled
form never did. From there: **Accept** applies it in one click,
**Edit first** opens the form prefilled for the case where research is
right about four fields and wrong about one, and **Keep as is** settles it
without changing anything. All three clear the proposal; the first two
also clear `needsResearch`.

The bottle page now runs through the same component rather than its own
flow, so there is one review UI rather than two that could drift.

As decided:

- **Approval is whole-proposal and editable**, not per-field.
- **Both buttons shipped.** The bulk one names the cost because research
  is the app's only web-search call and by far the most expensive.
- **Staleness is flagged, not prevented.** A proposal whose bottle has
  been edited since (`bottle.updatedAt > proposal.createdAt`) shows a
  warning and stays acceptable - the diff's "now" column is current, so
  you can see what moved underneath it.
- **One `Json` column**, with its shape documented beside `RESEARCH_TOOL`,
  which is the schema it mirrors. `lib/research-fields.js` is what reads
  it, and applying a proposal copies only the fields on that list rather
  than spreading the blob into the bottle row.

One bug worth recording, because it was invisible until the database was
checked: a nested `deleteMany` on a one-to-one relation is not valid
Prisma, so the first version of "keep as is" threw and silently did
nothing. The same defect was sitting unnoticed in the accept path, where
it would have left a bottle updated with its proposal still pending; it
surfaced only once the tests started reading rows back. All three settle
paths - accept, edit-then-save, keep as is - now delete through the model
inside a transaction with the bottle update.

## ~~15. Building a flight by hand~~ — done

Flights no longer only come out of Suggest. **Start a flight yourself** on
`/flights` takes a theme name (and an optional description), then drops you
on the flight's own page, where a search over your inventory adds bottles
in the order you'd pour them. Each pick gains ↑/↓ and **Remove from
flight**, so the running order is editable rather than fixed at add-time.

**Add to a tasting** sits on every inventory bottle - on the card once
expanded, and on the bottle's own page - listing the flights still on the
go plus a box to start a new one. Every choice saves immediately. A flight
whose picks are all drunk drops off that list: it's a record now, not a
queue.

Two schema columns became nullable, because every flight until now came
from a model that always wrote both. `TastingFlight.summary` is null for a
hand-built flight with nothing more to say than its name, and
`FlightPick.reason` is null for a bottle you added yourself, which has a
place in the running order but no argument attached. Neither column can be
NOT NULL on its own, so "at least one of title/summary" is guaranteed where
flights are written and read through one `flightName()` helper rather than
trusted from the schema.

The open questions, as settled by building it:

- **Inventory only**, matching what Suggest saves. A flight is a queue of
  things you can actually open.
- **Order is editable** - ↑/↓ per pick, swapping positions in a
  transaction rather than doing arithmetic on `order`, which is only
  guaranteed to increase (a removal leaves a gap and nothing renumbers).
- **The description is optional and not prompted for.** A flight with only
  a name reads fine: the page simply has no theme paragraph under the
  heading.

Duplicates are refused in `addBottleToFlight` rather than by a unique
constraint on (flightId, bottleId). Flights saved from Suggest before this
existed could already contain a repeat, and a migration that fails on live
data is a worse trade than a guard in the one function that adds picks.

## 16. The scan flow, reviewed end to end

A UX pass over the whole scan flow - picking a destination, reading a
batch, and reviewing what came back. Two of its findings were real bugs
and are fixed; one was declined on the owner's read of how the app is
actually used. The rest are listed here rather than in a chat log.

- ~~**Removing a photo left its bottles in the cellar.**~~ — fixed. The
  control says it removes "all its wines from the batch" and only dropped
  the cards; anything already saved stayed, with nothing on screen still
  pointing at it. It deletes them now, which makes a previously harmless
  control destructive, so it asks first and names the count. A photo that
  only left drafts behind has nothing to lose and stays a plain link.

  The delete is one action over the whole set rather than a loop of
  `removeScannedBottle`. Each of those revalidates, and the router refresh
  that follows cancels the calls still in flight - a five-bottle removal
  reliably left the last one behind. Worth remembering anywhere else a
  client awaits several Server Actions in a row.
- ~~**The batch summary counted cards, not saves.**~~ — fixed. A wine
  whose save fails falls back to an unsaved draft card, which the count
  still reported as saved. It counts saves now, says how many are still to
  save, and the card itself says its save failed rather than looking like
  any other draft.
- ~~**Every card was a full 14-field form.**~~ — fixed. Six wines off one
  shelf photo made a 7,000px page, so the one thing you came to do - check
  what was found - was the one thing you could not do. A saved card now
  leads with the wine in a line ("Ridge "Lytton Springs" 2021", then
  variety and region, the same shape the cellar list uses), keeps its
  destination radios and any tasting note read from the photo, and folds
  the form behind "Edit details". The form is still in the DOM, so nothing
  about saving or updating changes. Drafts stay open: they have not been
  saved, so their Save button has to be in reach. Same batch, 3,200px, and
  most of what is left is the one failed card.
- **Duplicate detection on scan** — declined, not deferred. The reasoning:
  two entries for the same wine are nearly always a real variant, most
  often a different vintage even when the scan misses it, and they will
  have different acquisition dates regardless. The one true duplicate is a
  case, and that is already one bottle scan plus a quantity adjustment at
  entry. Worth revisiting only if repeats show up in practice that are
  neither of those.
- ~~**Editing a saved card gave no confirmation, and unsaved edits were
  lost.**~~ — fixed. Update now says "Changes saved" and refreshes the
  card's heading from the row the action returns, so an edited producer or
  region shows what was actually saved rather than what the photo first
  read. Typing marks the card "unsaved": that badge sits on the Edit
  details summary, the whole-photo remove names it before discarding it,
  and the browser's own leave prompt is armed while it stands. The marker
  clears on a successful save.
- ~~**A failed photo could not be retried.**~~ — fixed. A failed read now
  offers "Read this photo again" beside the manual fallback; the file is
  already in hand, so a rate limit or a timeout costs a click instead of a
  hunt through the camera roll. Each photo remembers the destination it was
  chosen for, so a retry lands where it was always going to, even if the
  picker has moved on since.
- ~~**Accessibility.**~~ — fixed. The destination cards draw a focus
  outline (their radio is `sr-only`, so there was nothing for the ring to
  land on), the batch has an `sr-only` status region that announces the
  finished summary - deliberately its own region with two states rather
  than `role="status"` on the running text, which would interrupt once per
  completed photo to say the same thing - and body text at `text-zinc-400`
  (about 2.5:1 on white) moved to `text-zinc-500`/`600`. The idle
  destination icons moved too: they were at 2.5:1 against a 3:1 minimum for
  non-text.
- ~~**"Delete this wine" was a plain text link with a small tap target and
  no confirmation.**~~ — fixed. It asks first, naming the wine, and the
  small underlined controls on this page (delete, discard, Edit details,
  remove photo) now carry real padding instead of being 16px-tall text.
- ~~**A shop's blurb could become your tasting note.**~~ — fixed. The scan
  tool now has a `criticNotes` field for words printed by somebody else - a
  shelf talker, a back label, a menu write-up - and `note` is reserved for
  something the owner wrote themselves. Only `note` becomes a `TastingNote`,
  so a shelf talker no longer counts toward "Wines tasted". The saved card
  shows both, labelled by whose words they are and clamped to three lines,
  since the full text is one click away in the form.

  This adds a field to the extraction, against the owner's steer that
  identification is what the scan's time should go to. It is the cheap kind
  of addition - one more optional property on a tool call that was already
  being made, no extra round trip - and the alternative was a field that
  silently mis-files what it reads.

## 17. Design review: the rest of the app

A companion to #16. That one reviewed the scan flow end to end; this is a
pass over every other screen, plus the parts of scan that its rework left
untouched. Grouped by what each would cost rather than by screen, since
that is the order they are worth doing in.

Everything listed here was checked against the current code, not against
the review that produced it - three items provisionally on this list were
dropped because #16 had already closed them: the empty critic-notes box
on a scan card (the card now folds its form behind "Edit details", so the
box is no longer on screen), the batch summary counting cards rather than
saves, and the photo-removal control leaving its bottles behind. That
last one was resolved the opposite way from the first proposal - it
deletes now rather than being relabelled as a hide - and #16's reasoning
supersedes it.

One recommendation was withdrawn rather than logged: a "needs attention"
strip on the home screen, collecting bottles missing a drinking window
and bottles needing research. The first count is self-liquidating, since
every add path now fills a window in and `/estimate-windows` clears the
backlog; the second already has the nav badge, and a second copy of a
number only drifts from the first. What remains of it is the badge bug
below, which is a fix rather than a feature. Recorded so it is not
reintroduced later as a fresh idea.

### Cheap, and independent of any redesign

- ~~**The whole app rendered in Arial.**~~ — fixed. The create-next-app
  line is gone and `<body>` carries `font-sans`, so Geist finally applies
  and the two downloaded fonts are the ones on screen. Done first, because
  every judgment about spacing and weight is a judgment about whichever
  font is actually rendering. Original finding: `app/layout.js:1-12` loads Geist and
  Geist Mono and puts their variables on `<html>`; `app/globals.css:8-14`
  maps `--font-sans` to Geist. Then `app/globals.css:25` sets
  `body { font-family: Arial, Helvetica, sans-serif; }` and `<body>`
  carries no `font-sans` class, so Arial wins everywhere. Two Google fonts
  are downloaded on every visit and neither is used. This is
  `create-next-app` boilerplate that outlived everything built on top of
  it. Deleting that one line is the whole fix, and it is worth doing
  before any other visual work, because it changes how every later
  judgment about spacing and weight reads.
- ~~**There was no error boundary anywhere in `app/`.**~~ — fixed, with
  two rather than one. A boundary replaces everything it wraps, and a root
  one wraps the owner group's layout, so a single failed page took the
  whole nav with it and left one link as the only way anywhere. There is
  now `app/(owner)/error.js` for the common case, keeping the nav and
  confining the failure to `<main>`, and `app/error.js` as the outer net -
  a segment's error.js does not wrap the layout beside it, so the root one
  is what catches a failure in the group layout itself, the research
  badge's query included. Both render `ErrorScreen`, which offers `retry()`
  and shows `error.digest`, the only thread back to a server error whose
  real message never reaches the browser. Note for anyone writing another:
  the prop is `retry`, not `reset`, in this version of Next. Original
  finding: No `error.js`, no
  `global-error.js`. Most server actions catch deliberately - the comment
  at `insertBottle` explains that one scan card's database error must not
  take down the batch - but any action that does not catch throws to
  Next's root boundary and blanks the page. A dozen-line `app/error.js` is
  the difference between "that didn't work, try again" and losing a screen
  of unreviewed scan cards.
- ~~**Region could imply country, from data already in the file.**~~ —
  done (see #39). `lib/regions.js`'s comment groupings (`// France`,
  `// Italy`) are now data (`REGIONS_BY_COUNTRY`), and `BottleForm` auto-
  fills Country from a known Region (only while Country is still blank -
  never overwriting a choice already made) and shows a soft mismatch note
  otherwise. Two comment-headed groups genuinely mixed countries and were
  split rather than grouped by the loose heading a human would reach for:
  Wachau/Kamptal/Kremstal/Burgenland are Austria and Tokaj is Hungary, not
  all "Germany"; Mendoza/Uco Valley/Salta are Argentina, not Chile.
  Narrowing the Region suggestions once a country is chosen, and the full
  hierarchy (Bordeaux → Médoc → Margaux as related records rather than
  three strings, #2), remain open.

### Scan: what #16's rework did not reach

All three verified still open against the current scan code.

- ~~**Deleting one scanned wine was unguarded.**~~ — fixed, and
  `removeScannedBottles` with it, which had the same gap. Both return
  `{ ok }` / `{ error }`, and the card or photo is dropped only once the
  row is actually gone. Original finding: #16 replaced the
  whole-photo path with `removeScannedBottles`, for good reasons about
  revalidation cancelling in-flight calls - but the single-card delete
  still goes through `removeScannedBottle` (`app/actions.js:365-368`),
  which has no try/catch. It is the only action on the scan path without
  one, so a transient database or network failure throws out of the server
  action and - with no error boundary, above - takes every unreviewed card
  with it. Wants a try/catch returning `{ error }`, and the card's removal
  only on success.
- ~~**Correcting a flagged wine never cleared its flag.**~~ — fixed. The
  card's amber banner now carries a "Looks right — clear the flag" button
  calling the existing `dismissResearch`, deliberately a control rather
  than a side effect of saving.

  It later gained the other answer too, which the first version was missing:
  the flag asks a question, and only one reply was offered. "Not right —
  look it up" runs the same `researchBottle` the bottle page does, files a
  proposal, and swaps the banner for a link to review it. Both buttons then
  withdraw, because clearing the flag would delete the proposal the search
  had just paid a web search for. A search that changes nothing says so and
  leaves both answers available. The flag itself stays set either way:
  research proposes, you confirm. Original finding: `updateBottle`
  deliberately does not touch `needsResearch` - right when the bottle page
  was the only place to edit, since a plain edit should not silently
  resolve a research question. But a scan card is now a full editor too,
  and there is no control anywhere on it to say "this looks right". So a
  wine can be corrected by hand and still sit in `/research` waiting for a
  web lookup that does not know a human already fixed it, while the amber
  banner and the batch's flagged count both keep reporting it. The fix is
  a control, not a silent clear: a "Looks right, clear the flag" button
  calling the existing `dismissResearch`, so one field corrected without
  checking the rest does not resolve the whole question by accident.
- ~~**Changing a card's destination could silently lie.**~~ — fixed.
  `setBottleStatus` returns `{ ok }` / `{ error }`, and the card puts the
  radio back where it was and says why when the write doesn't land.
  Original finding: Tapping Cellar /
  Wishlist / Tasted updates the radio immediately and fires
  `setBottleStatus`, which returns nothing on success and returns silently
  when the row is gone (`app/actions.js:240-245`). If it fails, the radio
  stays where it was put and the bottle stays where it was - the card says
  Wishlist, the database says Cellar, and nothing on screen disagrees.
  Wants an `{ ok }` / `{ error }` return and a revert of the optimistic
  update on failure.
- ~~**The per-card destination control was a 20px target beside a 44px
  one.**~~ — fixed. Both cards use one segmented control borrowing the page
  picker's icons and accents, measured at 44px with no overflow at 375px.
  Original finding:
  The destination picker is `h-11` and tints only its selection. The
  control making the same decision per wine - the "Saved to" / "Save to"
  fieldsets - is three browser-default radios with `text-sm` labels,
  roughly 20px tall, in a form thumbed through one-handed while holding a
  bottle. Rendering them as the same segmented control would make one
  decision look like one decision wherever it is made.

### Scan: finishing a batch

- ~~**Nothing closed a reviewed card.**~~ — fixed. Scan saves each wine as
  it reads it, so by the time you have checked a batch every card on screen
  is already stored - and yet every control that emptied the page deleted
  bottles. The only way to get a clean screen after a good scan was to
  reload. Two controls now do the tidying the deletes were being misused
  for: a per-card **Done** that collapses a finished card to its own name
  and destination (with Reopen, and the research flag carried along so a
  collapsed card can't look settled when it isn't), and a batch-level
  **Done — clear the screen** that empties the workspace and keeps every
  wine, then says what landed where with a link into each list. It asks
  first only when clearing would actually cost something: a wine read but
  not saved, or a card with unsaved edits. A dirty card hides its own Done,
  since collapsing it would tuck the edit out of sight.

  This gap was made by #16's fix, and is worth remembering as a shape:
  removing a dishonest affordance ("remove from the batch", which left the
  bottles) removed a *use* people had for it (getting the screen clean)
  along with the dishonesty. The fix was right and the replacement should
  have shipped with it.
- ~~**The photo-level control still read like tidying.**~~ — fixed. "Remove
  this photo and all its wines from the batch" is now "Delete these 5
  wines", or "Remove this photo" when that photo saved nothing. With Done
  next to it doing the non-destructive job, the words have to tell them
  apart.

### Research

- ~~**The nav badge undercounted, so work could wait with nothing saying
  so.**~~ — fixed. It counts bottles flagged *or* carrying a proposal, so
  it now counts the same work `/research` will show. Whether `/research`
  deserves a permanent nav entry is still open, and still the wider
  question underneath. Original finding:
  The badge counts bottles with `needsResearch: true`
  (`app/(owner)/layout.js`), but the Research page's "Ready to review"
  list is driven by the `ResearchProposal` table
  (`app/(owner)/research/page.js`). Those are not the same set. Research a
  bottle from its own page that scanning never flagged, and a proposal
  waits for review while the badge stays at zero - and since `/research`
  is not in `NAV_LINKS` and the badge only renders above zero, there is no
  route to it and no hint it exists. Counting bottles flagged *or*
  carrying a proposal fixes the number; whether `/research` deserves a
  permanent nav entry is the wider question underneath.
- ~~**"Research all" stops if you navigate away.**~~ — done (2026-09-18,
  also BACKLOG #29). One at a time was already safe: `researchBottle`
  upserts its proposal as the last thing it does, so once the server
  finishes the answer is durable whether or not the browser is listening.
  The bulk path wasn't - `ResearchQueue.researchAll` chunked the ids and
  awaited each batch *in the browser*, so leaving the page stopped it
  after the batch in flight. Thirty flagged bottles got you three.

  The chunking itself was right - it's what keeps one request from
  hitting a serverless execution limit - so the fix moved the loop
  server-side instead of removing it. `researchBottles` in `app/actions.js`
  now processes one small step (`RESEARCH_STEP_SIZE`, still 3) and, if
  more ids remain, schedules the next step itself via `after()` (`next/
  server`, stable since Next 15.1) - which keeps the invocation running
  past the point where the response has already gone back to the client,
  so the chain finishes whether or not the tab that started it is still
  open. A step failing outright still hands off to the next one (a
  `try/finally` around the scheduling), so one bad step can't stall
  everything queued behind it.

  `ResearchQueue.js` calls it once now instead of looping - it gets back
  only the first step's own tally, and the UI says so honestly ("N more
  are still queued and will keep going even if you leave this page")
  rather than faking a live counter it no longer has the data to drive.

  Verified against a 7-bottle queue (3 steps: 3+3+1) with a stubbed
  `lib/anthropic.js`: the first step's result showed in the UI, then the
  test navigated away immediately - and all 7 proposals were confirmed
  in the database afterward, sequential and distinct, proving the chain
  kept running server-side with nothing left connected to it.

  **Finished properly on 2026-09-21**, because the version above was only
  two thirds of the answer and the owner could feel the missing third:
  "multiple bottles can be researched, but I believe navigating away
  breaks it." It didn't - what broke it was the ceiling that fix had
  quietly introduced. `after()` runs past the response but still inside
  the invocation that scheduled it, so the whole chain shared one timeout.
  The browser loop never had that limit: each batch was its own request
  and got its own budget. So a long queue now stopped partway, which from
  the outside looks exactly like the navigate-away bug it replaced.

  The root fault was the same in both versions: the queue only ever
  existed in memory, tied to something that dies. It's a row now -
  `ResearchJob` (`bottleIds`, `pendingIds`, `researched`, `failed`,
  `status`, plus a per-job `token`). Each step reads what's left, does
  what it can afford, writes back, and POSTs to `/api/research/step` to
  ask for a *fresh invocation* to run the next one. The route answers 202
  before doing any work and does the step inside its own `after()`, so
  steps hand off rather than nest: the total run is bounded by nothing.

  How much a step takes on is decided by the clock, not a count -
  `STEP_BUDGET_MS` (20s against the route's 60s `maxDuration`), checked
  *before* each question rather than during one, since a live web search
  can't usefully be interrupted halfway. The first question always runs,
  so a step can never consume nothing and chain forever.

  Security, since the step route is plain HTTP and the app still has no
  auth in front of it (`FUTURE_CAPABILITIES.md`): the guard is the job's
  own token, generated server-side and never sent to a browser. A
  per-job random rather than a shared env secret deliberately - a secret
  has to be *configured* to be correct, and "the research queue silently
  stopped because a variable wasn't set" is the exact class of failure
  this whole item is about. If the handoff can't be made at all, the run
  falls back to finishing inside one invocation the old way: worse, but
  far better than a button that does nothing.

  The double-queue gap noted above closed as a side effect. `/research`
  now finds a running job on load, so returning mid-run shows the run
  rather than an idle button, and the button is hidden while one is live.

  **A third cause, found 2026-09-21 with a real key, and the one that was
  actually breaking it in production.** Both rewrites above assumed a
  research question takes 20-40s. Measured, at the effort it was running
  at, one took **59.9s and another 160.5s**. The step route's `maxDuration`
  is 60s. So a single question did not fit in the invocation meant to run
  it: killed mid-search, no proposal written, no handoff, run dead partway
  through - indistinguishable from the navigate-away bug, and untouched by
  either rewrite, because the fault was never in the chaining. Fixed by
  running bulk research at `low` effort (20-29s, and no worse an answer -
  see #23 for the numbers and the quality check) and setting
  `STEP_BUDGET_MS` to 0 so a step begins exactly one question and gives it
  the full 60s. On a hosting plan allowing 300s this would be a different
  calculation; on a 60s ceiling it is the only one that works.

  Verified at 375px against a 10-bottle queue with a stubbed
  `lib/anthropic.js` (8s per call): the test started the run, navigated
  to `/inventory`, waited 45s, and came back to find the bar at 3 of 10 -
  work that happened with nothing connected. Final state in the database:
  `status=done`, 10 researched, 0 failed, `pendingIds` empty, 10
  proposals. Three separate `POST /api/research/step` invocations, and
  **72s elapsed** - longer than any single invocation could have run,
  which is the property the whole rewrite exists for. Seven stub calls
  for ten bottles, so the duplicate-wine grouping survived the rewrite.
  The starting Server Action returned in 2.3s of that 72s; handoffs cost
  7-10ms each.
- ~~**Research has no progress bar, though scanning does.**~~ — done
  (2026-09-21), and only possible because of the rewrite above: a bar
  needs something true to read, and until the job was a row there was
  nothing to read. It polls `getResearchJob` every 3s, so it shows real
  server state and survives leaving the page and coming back, which the
  old browser-side counter never could.

  Three states, because "finished" and "stopped partway" are different
  news and a bar sitting at 40% tells you neither. A run whose chain
  broke - a deploy mid-queue, a lost handoff - leaves a row saying
  "running" forever; nothing distinguishes that from a step mid-search
  except elapsed time, so after `STALLED_AFTER_MS` (3 min) the panel says
  so plainly and offers the button back rather than spinning indefinitely.

  One thing this got wrong first and worth remembering: the panel
  originally lived inside `ResearchQueue`, at the bottom of the page. The
  further a run got, the further its own bar was pushed down by the
  proposals it was producing - six bottles in, ~5,000px of results at
  375px. Watching a run and reading its results are different jobs, so
  the run's state moved up to page level (`ResearchRun.js`) with the bar
  under the heading.

  That move surfaced a genuine Next 16 trap, recorded because it cost
  real time and will recur: a client module a **Server Component**
  imports becomes a *client entry*, and another client module importing
  that same path gets the generated reference, not the module - so
  `createContext` evaluates twice and the provider fills a different
  context than the reader reads. The symptom is a provider that
  demonstrably renders beside a child one element deeper insisting there
  isn't one. The context now lives in `research-run-context.js`, which no
  Server Component imports.

  ~~Scanning and `/estimate-windows` still have their own bars; lifting
  one into a shared component would settle all three.~~ — done (see #39).
  `ProgressBar.js` covers all three now - height, fill color and
  transition speed are props, since Research's stalled/running/done
  coloring is a real difference from the other two's fixed color, not
  drift to erase.
- ~~**Research names destinations in text where the rest of the app uses an
  icon and a colour.**~~ — done (see #39). `lib/status-look.js` +
  `StatusBadge.js` are that one source now, used by both of Research's
  lists and the bottle page - the three places that were still bare text.

### Cellar: order and proportion

The most-used screen, and the one that scales worst. The modules on it are
distinct enough; what is off is which comes first and how much room each
gets.

- ~~**Adding outranked browsing on a page that exists for browsing.**~~ —
  fixed. The guest paragraph became a chip in the heading row, hand entry
  became a line instead of a boxed disclosure, and the page's own gaps
  tightened. Measured at 375px on a 117-bottle cellar, the first bottle
  moved from 605px down the page to 441px — the Cellar is now slightly
  tighter than the Wishlist despite carrying the drinking-window banner as
  well. Scanning stays a full-width button: it is the fast way in and the
  one you reach for at the rack. The Wishlist is deliberately untouched,
  and the test asserts its list sits exactly where it did. Original
  finding: Before
  a single bottle there is a title, a two-line paragraph about the guest
  link, a "Scan a label or shelf" button, an "Add a bottle" disclosure, a
  conditional drinking-window banner, and the filter panel. Three of those
  are ways to put wine *in*. The page comment says adding comes before
  browsing, which is right for the Wishlist and inverted here: a wishlist
  is added to constantly and browsed rarely, a cellar of hundreds is the
  reverse. Collapsing the two add controls into one and letting the list
  start near the top is the change.
- ~~**Collapsed filters were invisible.**~~ — fixed. A row of chips names
  each active filter and removes it on tap, next to a "Clear all" once
  there is more than one. Deliberately its own row rather than inside
  `<summary>`, which is already a button and makes a mess of the keyboard
  order once more buttons go in it. The "12 of 247 shown" count stays — the
  chips replace the mystery, not the count. `FilterBar` is shared, so this
  lands on Cellar, Wishlist, Tasting notes and the guest view at once.
  Original finding: The panel summary shows "12 of
  247 shown" but not *which* filters are on, so a collapsed panel leaves a
  narrowed list with no visible reason. Filter chips in the summary row
  would say what is active without reopening it.
- ~~**The guest-link paragraph sat above the bottles.**~~ — fixed. It is
  "Guest link" plus the `/guest` chip in the heading row now. The ❤️ the
  prose explained is visible in the list itself. Original finding: Two lines of prose
  about a feature used a few times a year, above the most-used list in the
  app. It belongs behind the `/guest` chip.

Any list work here belongs in `FilterBar` / `BottleList` rather than in
the pages: Cellar, Wishlist and Tasting notes all render the same
`FilterableBottleList`, so the shared components carry one change to all
three.

### Bigger questions, worth a branch

- ~~**The nav spends vertical space on every screen.**~~ — done. The owner
  layout was a `flex-wrap` row of seven text links plus a conditional
  Research badge; at 375px it wrapped to two lines above every page,
  permanently, on the device the app was built for. It was a desktop nav on
  a phone-first app.

  Both open questions were answered from a contact sheet of the options
  (`tab-bar-sheet.html`), and the answers were:

  1. **Four tabs — Home, Scan, Cellar, Suggest.** The two things you do, the
     one list you live in, and the way back to everything else. Research did
     not earn a slot, being empty most of the time.
  2. **The top row returns above 640px.** Owner's default rather than an
     explicit choice, so it is a one-line flip: a bar pinned to the bottom of
     a laptop screen is a long way from the mouse, and the wrapping this
     replaces only ever happened on a phone.

  Measured: the cellar's first bottle moved from 441px to 372px on a 375x800
  screen, which is the whole 69px back.

  Two things the choice forced, both of which were latent problems anyway.
  **Research needed somewhere else to be seen**: its count was a nav link
  that only existed above zero, and with four tabs there is no nav on a
  phone. It is now a dot on the Home tab (with the count in its aria-label,
  since on a phone the dot is the only thing saying so) plus a real home
  card carrying the number. **Kept pairings needed a card too** - it was
  reachable only from Suggest, which was a holding position from #20 and is
  now resolved: home is the way to everything not in the bar, so everything
  not in the bar is on home.

  Three icons were drawn for it - Home, Research, Pairings - and none is
  built from the set's shared bottle-and-glass geometry. The reasoning is
  in `icons.js`: a house because the thematic choice (a cellar arch) is
  already Cellar two slots along, a lens over text because a bottle inside
  a 14px lens is mud at 20px, and a fork because a pairing is the only
  thing here that needed something from the table.
- ~~**A Suggest result is lost on navigation, with no warning.**~~ — done
  in #20. A pairing you want is kept deliberately and survives everything;
  "Ask again, with changes" reloads a kept one's request and all three
  settings so the Character control can be changed without retyping. Two
  claims in the original entry were wrong and are worth recording as
  corrections: refining never required retyping even before this (the form
  stays rendered above the result and `request` is never cleared - the
  friction was scrolling), and the answer was not to warn about the loss
  but to stop losing the ones you care about.
- **The Tasting notes page showed no tasting notes.** — narrow fix done;
  the wider question below is still open. An expanded row on `/consumed`
  now carries the most recent note, its date, and "most recent of 3" when
  there are more. `getBottles` deliberately strips note text off every row,
  so this is an opt-in `withLatestNote` rather than a wider select: the
  reason the text is trimmed everywhere else still holds, and only one note
  per bottle is ever serialized to the browser. One claim in the first
  version of this entry was wrong, and is worth recording as a correction:
  the query does *not* return one row per bottle from the database. Prisma
  applies `distinct` in the client, so Postgres hands back every note for
  those bottles, text and all, and the client keeps the newest per bottle.
  Caught by reading the SQL Postgres actually received rather than trusting
  the API's name. Fine at this size; the bound that matters is the browser
  payload. Verified against the RSC payload,
  not just the rendered page - `latestNote` is absent from `/inventory`'s
  payload entirely, so the guard is that the server never sends it. Whether
  `distinct` + `orderBy` really returns the *newest* note was the part
  worth proving rather than assuming: two bottles were seeded where id
  order and date order disagree in opposite directions, and picking by id
  either way would fail one of them. That test was still not enough on its
  own: it used notes with *different* dates, so it never produced a tie -
  and `tastedAt` is date-only at noon UTC, so two notes on one day are
  exactly equal. Without a tiebreaker the winner was whatever Postgres'
  sort happened to produce, and could contradict the bottle's own page.
  `{ id: "desc" }` is now the third order key, matching how the detail page
  settles the same tie. Original finding, and the branch question that
  remains: `/consumed` renders
  the same `FilterableBottleList` as the Cellar with two flags flipped,
  and `BottleList` has no note rendering at all - an expanded row shows
  the photo, variety/region/country, favourites, quantity and a link. So
  on the one page named after them, a note cannot be read without opening
  the bottle's own page, while the page's own subtitle promises "bottles
  you've finished, with their tasting notes". The narrow fix is to put the
  most recent note, or a count and an excerpt, into the expanded row on
  this page. ~~The wider question, if that does not settle it, is whether
  `/consumed` should be a list of wines with notes attached or a list of
  notes with wines attached~~ - **decided, see #40: wines with notes
  attached.** Chosen over the note-first rebuild specifically to keep this
  page's list on the same instant, client-side filtering every other list
  uses (BACKLOG #19) rather than giving it its own model.

  ~~A second reason to settle it, found once the note rendering landed:
  **search on this page cannot find the text the page now shows.**~~ —
  done (see #40), and settled without the branch question above: rather
  than a server round-trip per keystroke, or restructuring the page,
  `getBottles`'s `withLatestNote` option now also ships every note's text
  for this page's bottles, search-only (`noteSearchText`, never
  rendered - the row still shows just the latest note) - a bounded,
  page-specific exception to the trimmed select, the same shape the
  latest-note column itself already was.

## ~~18. The export doesn't export everything~~ — done

Flights with their picks, research proposals and photo rows are all in the
file now. `DrinkWindowEstimate` is still left out on purpose - it's a cache
keyed on the wine, so losing it costs money to refill rather than
information - and the route says so, along with the rule for deciding where
a new model belongs.


`/export` is described as a full backup and reads like one, but it covers
`Bottle` (with `tastingNotes`) and `Guest` (with `favorites`) only. Saved
flights and their picks, research proposals waiting for review, and the
`BottlePhoto` rows added after scanning are all left out - the bottle's own
`photoUrl` comes along, the later photos don't. Flights are the real loss:
they're hand-curated and exist nowhere else. Either include them or say in
the README what the file actually holds, because a backup you trust wrongly
is worse than one you know the limits of.

## ~~19. What the AI review turned up, beyond the two fixed~~ — done

All four shipped. The first two turned out to need a different fix than
drafted here, and the notes below say how - worth reading before trusting a
drafted fix in this file again.


From the first run of the `ai-reviewer` agent. The two findings that could
write a wrong answer into the cellar - scanning inventing a `bottling` it
couldn't see, and the add-photo path stripping the "estimated" marker off a
model-guessed drinking window - are fixed, as is the unchecked `stop_reason`
that reported a refusal or a truncated answer as a bad photo. These four are
real but none of them corrupts data, so they wait.

- **Research can overwrite a window you typed yourself.** `RESEARCH_TOOL`'s
  own `drinkFrom` description says to "still give your best estimate ...
  rather than leaving it blank", while the system prompt above it says to
  "keep a field as its current value rather than guess at a replacement".
  The field description is the one the model reads while filling the field,
  so it wins. For an obscure wine with no window published anywhere, research
  comes back proposing its own guess over years you entered by hand, shown in
  the diff as something research "found". It is recoverable - the diff shows
  it and the proposal is correctly marked estimated - but Apply is one click
  and the diff gives no sign the current value was yours. The fix is to make
  the field description name the two cases: estimate freely when there is no
  window on file, repeat the existing years back unchanged when there is -
  but *only* when those years were sourced or typed by hand. Applied to a
  window the app guessed, "repeat it unchanged" would freeze that guess in
  place and stop research ever improving it, which is the same guess/fact
  confusion pointing the other way. `describeBottleForResearch` now labels
  the window as estimated or sourced on the way in, so the model can tell
  the two apart - that half is done; what remains is the field description
  itself.

- **`browse_cellar` hands Suggest a slice of the cellar without saying so.**
  `browseCellar` returns `matches.slice(0, 40)` ordered by producer name, and
  the result gives the model no way to know a cap was hit. On a 300-bottle
  cellar an unfiltered browse returns producers A through roughly C; the
  model then recommends the best of those forty and writes a confident
  summary about why they suit the meal. Nothing about the answer looks wrong.
  The fix is small - return `totalMatching` and `truncated` alongside the
  bottles, and say in both the tool description and the system prompt that a
  truncated browse means narrow and look again, never decide from what came
  back.

- **The scan and Suggest prompts aren't cached.** Both resend a large static
  prefix on every call and again on every turn of their tool loop: roughly
  2,300 tokens of tools plus system for scan (plus the photo, ~1,500 image
  tokens, re-sent each turn), about 1,550 for Suggest, which is told to browse
  repeatedly so three or four turns is normal. One `cache_control` breakpoint
  each would cover it - on the last block of scan's first user message, on
  Suggest's system block. Worth checking the other three stay uncached: the
  drink-window and photo-details prefixes are under the model's minimum
  cacheable size, where marking a prefix is silently ignored, and research
  sits barely over it.

- **Research asks the web the same question twice for two rows of the same
  wine.** `researchBottles` maps ids to `researchBottle` one at a time, and
  web search is comfortably the most expensive call in the app. A case split
  across two rows, or a wine re-added after being drunk, pays for two
  identical passes. The drink-window path already solved this - it groups by
  `drinkWindowCacheKey` so one question serves every row sharing a wine. Same
  trick here, with one wrinkle: a proposal is a diff against a specific row's
  current values, so the search is shared but `researchChanges` still has to
  be computed per bottle.

## 20. Suggest: keep what you asked for

Scoped with the owner rather than drafted from a review, so the decisions
below are settled unless noted.

### What is already true

A **tasting flight** is already persisted - `TastingFlight` + `FlightPick`
hold a title, a summary and ordered picks each with a reason. A **pairing**
has the same shape at runtime and no storage at all: `result` is
`useState` in `app/(owner)/suggest/page.js`, so following any pick's own
link destroys the other picks. That is the sharper version of "lost on
navigation": the page's primary affordance is what throws the answer away.

One correction to #17's entry, which is wrong: refining does **not** require
retyping. `request` is never cleared and the form stays rendered above the
result, so changing Character and re-running already works. The friction is
scrolling, not typing.

### Why pairings get their own table rather than joining flights

Three differences, and the first is the one that decides it:

- **Origin.** Flights have two - `createFlight` is reachable from
  `NewFlightForm` and from `AddToFlight` on any Cellar row, and
  `FlightPick.reason` is nullable "for a pick added by hand". A pairing only
  ever comes from Suggest. A combined table's natural name is "suggestions",
  which would be a small lie about half its rows.
- **Lifecycle.** `isOpenFlight` says it plainly: a flight is a queue while
  any pick is undrunk and "a record now, not a queue" once they are all
  done. It has live state and the Cellar wires into it. A pairing has none -
  it is a decision you recorded, and "Log this pairing" already writes the
  tasting note.
- **Owned vs not.** `FlightPick.bottleId` is correctly NOT NULL: you cannot
  open a wine you do not have. A pairing is the opposite - "buy this for
  that dish" is the entire point of the include-outside toggle.

Sharing one table would make `order` and `consumed` meaningless for half the
rows, putting "null means not applicable" in the same column as "null means
unknown" - the distinction the rest of this schema works to keep.

### ~~Proposed shape~~ — built

```
SavedPairing
  id, createdAt
  title      String?   -- defaults to the model's own title, renameable
  request    String    -- the original text, verbatim
  character  String
  includeOutside Boolean
  summary    String?   -- the model's "why these"
  picks      PairingPick[]

PairingPick
  id, pairingId, order
  dish       String?   -- pairingContext; null on a whole-menu pick
  reason     String
  bottleId   Int?      -- the wine owned, null for a gap
  wineLabel  String    -- how it read when saved
  gap        Json?     -- the not-in-cellar wine's fields
```

Three of those earn their place deliberately:

- **`request`/`character`/`includeOutside` are what make refining cheap** -
  reload the form from a saved pairing, change one control, re-run. Without
  them, iteration is a second feature rather than three columns.
- **`gap` is Json** for the same reason `ResearchProposal.proposed` is: it is
  only ever rendered as a unit. It also means saving never quietly creates a
  wishlist bottle nobody asked for.
- **`wineLabel` is a snapshot, and `bottleId` sets null on delete.**
  `FlightPick` cascades, which is right for a queue - a bottle you no longer
  have cannot be in one. A pairing is a record of a decision made in June and
  should not lose a wine because the cellar was tidied in October.

Only pairings deliberately kept are persisted. The consequence, worth stating:
comparing two attempts means keeping both on purpose, so the refine control
has to make keeping cheap and obvious or the preferred version is lost.

Four things came out differently from the sketch above, each for a reason:

- **`title` is NOT NULL**, unlike `TastingFlight.title`. Every pairing is born
  from a Suggest result where the title is a required tool field, so there is
  no such thing as a pairing without one and no reader that has to cope with
  the absence. Renaming is on the detail page; the request, the settings and
  the wines are the record and stay as they were.
- **`effort` joined `character` and `includeOutside`.** The sketch predates the
  effort control. "Which one was the Thorough one" is a real question a month
  later, so it is stored and shown, not just replayed.
- **`wineLabel` is written server-side** from the bottle row at save time,
  rather than taken from what the browser sent. It is a snapshot either way,
  but this way it is a snapshot of the database.
- **Refining reloads the request and the settings, not the wines.** The point
  of asking again is to get different ones; restoring the old picks would just
  be the old answer with a new form around it.

Kept pairings are in `/export` too, by the rule that file's own comment sets:
a model holding something the owner curated belongs in the backup.

### The index — still open

*(Updated 2026-10-03: Pairings has since gained its own nav link and tab,
and Home links to it - see #28 - so the holding position described here no
longer holds. The one-screen idea below is still open.)*

Pairings lived at `/pairings`, reached from Suggest rather than from the nav,
because the nav was at seven links and where the eighth went was the parked
question in #17. That was a holding position, not the answer.

The answer is still one screen listing both kinds, rows expanding in place,
flights keeping `/flights/[id]` and their queue behaviour untouched. A flight
row expands to progress and a link; a pairing row expands fully. Naming is the
open wrinkle - with hand-built flights in it, the honest heading is "Saved"
rather than "Suggestions". It costs a nav slot either way, so it stays
tangled with the tab bar in #17.

### ~~Two bugs, independent of all of the above~~ — done

- ~~**`savedGapIds` is keyed by array index and never reset**~~ Reset
  alongside the result it describes. Save a gap to the wishlist, run a
  different search, and pick #1 of the new result used to claim it was on
  your wishlist already, with no way to add it.
- ~~**"Save this flight" drops the wines you do not own, silently**~~ The
  exclusion was correct - a flight is a queue of bottles you can open - so
  the fix was to say it: the button now counts what it will actually save, a
  line names what it will not, and saving opens the wishlist forms for
  exactly those wines.

### ~~Effort, not model~~ — done

The owner's interest is speed and thoroughness, and effort is the lever, not
model choice - prompt caches are model-scoped, so routing some calls to a
cheaper model would forfeit the cache hit and eat the per-token saving.

`output_config` was set nowhere, so all six AI calls (not five) ran at the
API's default `high`. All six now set it explicitly through `lib/effort.js`,
and two of them - Suggest and Research, the pair the owner named - take it
from the person asking: Quick / Standard / Thorough, mapping to `low` / `high`
/ `xhigh`. Standard is what every call did before, so the default option is
the status quo and neither of the others is a silent change to it.

`medium` and `max` are deliberately not offered. The useful question is
"faster, same, or more careful", and a fourth option makes that harder to
answer; nothing in a wine recommendation has a correctness bar that justifies
`max`.

If latency specifically is the complaint, fast mode runs the same model faster
at a price premium, which trades money rather than quality.

## ~~21. The wine card's three kinds of note, and two of its dates~~ — done

Raised by the owner looking at a bottle page; settled with them and shipped.

- **Two notes boxes, one explanation.** `Bottle.notes`, `Bottle.criticNotes`
  and `TastingNote.note` are a real three-way split - your standing notes
  about the wine, somebody else's published notes, and your dated tasting
  entries - but only the second two said so on screen. `Bottle.notes` is now
  labelled "Your notes", named for whose words it holds, with a line saying
  what belongs in it and a placeholder showing it. The schema comment it
  never had is written.
- **Acquisition source stays free text.** The owner's call: it goes in the
  notes box rather than getting a column of its own, so the label above had
  to say so. The alternatives considered were autocomplete over sources
  already used (the `getRegionOptions` pattern) and a fixed vocabulary like
  `wineColor`; neither earns its keep for a field never filtered on.
- **The acquired date was too loud, not too quiet.** It was always rendered -
  the reason it went unnoticed is that "date unknown" reads as an absence.
  When a bottle was bought is occasionally interesting and almost never why
  you opened the page, so it now sits in the meta row with the status and the
  drinking window, a size smaller, instead of owning a line under the wine's
  name.
- **Two dates on a drunk bottle, not three.** "Tasted is synonymous with
  emptied", so the card no longer shows both: the tasting note carries the
  date, and the header row appears only for a bottle with no note, where
  there would otherwise be nowhere to see or correct it. The two values are
  now kept in step in the data as well (`syncEmptiedToLatestNote`), because
  `Bottle.emptiedAt` is what History sorts by - leaving them free to diverge
  would have put History in an order the dates on screen denied.

## ~~22. Region and country in the Cellar's wine titles~~ — done

Raised by the owner: a Cellar row named the producer, bottling and vintage
and said the type, but not where the wine was from - so scanning the list for
"something from the Loire" meant opening rows one at a time. The origin was
always there, one tap inside the row; the fix was to put it on the face of it,
in small grey under the name, following the shape the scan cards already used.

The three decisions, as made:

- **Which fields: region, sub-region and country** - one more than was asked
  for. Whether a wine's sub-region is set at all depends on how the bottle
  happened to be entered ("Margaux" as the region, or Bordeaux plus Margaux as
  the sub-region), so leaving it out would have shown the same wine two
  different ways depending on which route it came in by. At `text-xs`,
  "Bordeaux · Margaux · France" costs nothing at 375px.
- **Where the room comes from: a second line**, and the disclosure marker
  moved out of the name into its own column. Indenting a second line to clear
  a triangle and a colour dot of different widths is a guess that goes wrong
  on half the rows.
- **The other lists followed** - and one of them was already ahead. History
  and the wishlist share `BottleList`, so they came along for free. The guest
  list had carried an origin line all along and was quietly dropping the
  sub-region.

The real finding was underneath the question. The same line existed in four
places, written four ways: the scan card had
`(variety || type) · region · subRegion · country`, the cellar's expanded
panel had `variety · region · subRegion · country`, the guest list had
`variety · region · country`, and the collapsed row had nothing. That is
drift, not design, so all four now read from `lib/wine-origin.js`. A fifth
case fell out of it: with the grape falling back to the type, a bottle with
a type but no variety and no region would have shown its type twice instead
of saying nothing was recorded, so `wineDetailOrNone` draws that line
explicitly.

## 23. Measure before turning the mechanical calls down

**Measured 2026-09-21** against a real key, on a seeded 69-bottle cellar.
Everything below the divider was written before those numbers existed and is
kept because the reasoning still stands for the call sites that remain
untested.

### What the measurements said

**Research effort — measured, and acted on.** Two bottles at each level,
real web search, Sonnet:

| effort | latency | searches | output tokens | cost/bottle |
|---|---|---|---|---|
| `high` | 59.9s, 160.5s | 5 | 3,634 / 6,511 | **$0.184** |
| `low` | 28.6s, 19.9s | 2 | 1,687 / 1,474 | **$0.073** |

The cost was the less important half. The latency was a live bug: the step
route's `maxDuration` is 60s, and at `high` a single question does not
reliably fit inside the invocation meant to run it - one took nearly three
minutes. In production that invocation is killed mid-search, the proposal is
never written, the handoff never happens, and the run dies partway through.
That is the symptom "Research all" had been reported with twice (see #17),
and neither rewrite could have fixed it, because the fault was never in the
chaining. Bulk research now runs at `low` and `STEP_BUDGET_MS` is 0, so a
step begins exactly one question and gives it the whole 60s.

Quality was checked by reading the output, not assumed: `low` returned 4 and
7 attributed sources, blend composition, fermentation and ageing detail,
named critic scores, and a correctly labelled estimated window. It buys
fewer searches and a quarter of the thinking tokens. It did not buy a worse
answer.

**Prompt caching — confirmed working.** Suggest, one query, three turns:
prefix 3,062 tokens, turn 1 writes 2,987, turns 2 and 3 each *read* 2,987
with zero re-write. The breakpoint placement (tools render before system, so
one breakpoint covers both) does what #23 assumed it would. Research's
prefix could not be measured the same way - `count_tokens` rejects server
tools outright ("Server tools are not supported in the count_tokens
endpoint") - but its `usage` shows enormous cache traffic regardless
(168,255 read against 31,967 written on one call), because the API caches
the accumulating web-search results inside a single call on its own. On a
web-search call the prefix is a rounding error next to that.

**Opus vs Sonnet on Suggest.** Five queries, one run each,
`scripts/compare-suggest-models.mjs`:

| | cost/query | avg latency | turns |
|---|---|---|---|
| Sonnet 5 | **$0.0315** | 23.7s | 2-3 |
| Opus 5 | **$0.1911** | 44.4s | 3-5 |

**Opus costs 6.1x and takes 1.9x as long.** It is also consistently better,
but not uniformly, and where it is better is the useful finding: on direct
pairings both led with the same correct bottle and the gap was breadth
(Opus offered a third option and used quantity - "you have two bottles of
it, so it's easier to justify on a weeknight"). On the open-ended cases the
gap was real. Asked for Thanksgiving with an `avant-garde` steer, Sonnet
proposed an orange wine as centrepiece - a good answer. Opus proposed a
Bandol rosé, oxidative white Rioja, Musar and a Mosel Spätlese, named the
*risk* of each unconventional choice, and noticed the rosé's window closes
in 2026 so these are the last bottles to drink. That query cost Opus $0.40
and 74.6s, against Sonnet's $0.05 and 37.6s.

Sonnet was never *wrong* - every pick was defensible and factually sound.

**Acted on the same day: Suggest's dial is now a model choice.** The effort
dial and a model dial were competing to express one intent - how much do I
want spent on this answer - and only one of them had ever been measured, so
the measured one won. `lib/suggest-depth.js` replaces `EFFORT_LEVELS` on
Suggest with two rungs: **Standard** (Sonnet, the default) and **Master
Sommelier** (Opus). The labels are the owner's.

Two rungs rather than three, deliberately. The two things measured *are* the
two models; a third rung would have been the same model with a thinking
tweak, making the control read as three equal steps when it would really be
one large step and one small one. `xhigh` is no longer reachable from
Suggest - a removal, not just a non-addition - on the grounds that the
hardest query in the set already took Opus 74.6s at default effort, and the
wait is what the owner actually pays standing in the kitchen. Adding it back
is one entry in one array if a reason ever appears.

**Sonnet is the default, and that changed behaviour** - Suggest previously
always ran Opus. Justified by the measurement above: on direct "this dish,
what wine" pairings the two led with the same bottle every time. The cost is
that an open-ended request gets the narrower answer unless the owner
escalates, which is one tap. This also gives the multi-user plan its cost
control for free: non-owner accounts pinned to Standard is a setting that
now exists rather than a special case to build.

`SavedPairing.effort` became `SavedPairing.depth`, with every existing row
set to `sommelier` - all of them ran on Opus, because that was the only
model Suggest ever used. Mapping by the old *labels* instead (the level
called "Quick" becoming the rung called "Standard") would have looked
tidier and recorded a falsehood: that a pairing was answered by Sonnet when
it was not, so refining it would quietly run a different model than the one
whose answer is on the page.

One casualty worth noting: `lib/effort.js` used to argue against model
routing on the grounds that prompt caches are keyed per model, so switching
would forfeit the hit. True, and measured at $0.019 (Opus) or $0.008
(Sonnet) per switch against query costs of $0.03-$0.19 - an order of
magnitude too small to decide anything. That comment is corrected rather
than left standing.

**For the usage ledger (`FUTURE_CAPABILITIES.md`), the unit costs are:**
Suggest $0.03 (Sonnet) / $0.19 (Opus); research $0.073/bottle at `low`,
$0.184 at `high`. A "Research all" over 30 bottles is $2.20, and is by some
distance the most expensive thing a user can tap.

**One cost lever found, and taken the same day.** `browse_cellar` returned
at most 40 bottles, so on a 69-bottle cellar an unfiltered browse came back
truncated and the model re-browsed - Opus's worst query spent 48,246 input
tokens across 8 browse calls.

The cap was the visible half and the smaller one. What makes repeated
browsing expensive is that **every turn of a tool loop re-sends every
previous tool result**, so eight capped browses cost far more than the
whole cellar sent once. Measured: the entire 69-bottle cellar is ~4,200
tokens in a single result, against 48,246 spent not seeing all of it.

Both halves changed, and the second matters more:

1. `CELLAR_BROWSE_CAP` is 250, not a target but a guard - high enough that
   a personal cellar arrives whole (117 bottles is ~7,200 tokens), low
   enough that an implausible one can't blow up a request. Truncation is
   untouched for anything past it.
2. **The tool description was the actual cause.** It said "Call this one or
   more times with different filters to explore what's actually available
   (e.g. once for reds, once for whites)" - which was correct advice when
   40 was binding, and is exactly what produced 8 calls. It now says one
   unfiltered call returns the whole cellar and that filters are for
   narrowing something already seen, not for discovering it. Raising the
   cap without this would have changed nothing.

Nulls are also dropped from the payload (9%, free), and
`drinkWindowEstimated` is only sent where a window exists to describe -
the column defaults to false, so every windowless bottle was carrying
"this absent window is not an estimate".

**Re-measured against a real key the same day, same five queries, same
cellar.** The first thing it caught was that
`scripts/compare-suggest-models.mjs` keeps its *own hand-synced copy* of
`BROWSE_CELLAR_TOOL` and `browseCellar` - exactly as its header warns - so
it was still running the 40-cap and the old description. Measuring before
syncing it would have reported "no change" and been believed. Synced, then
run.

**browse_cellar calls across the ten runs: 57 -> 13.** Opus dropped to
exactly one unfiltered call on all five queries.

| | before | after |
|---|---|---|
| Opus, per query | $0.1911 | **$0.1044** (-45%) |
| Sonnet, per query | $0.0315 | **$0.0380** (+21%) |
| whole 5-query set | $1.113 | $0.712 |

The worst query - Thanksgiving, avant-garde - went from 8 browse calls,
48,246 input tokens, 74.6s and $0.40 to **1 call, 8,929 tokens, 57.7s and
$0.16**. Opus got faster on every single query.

**Sonnet got slightly worse, and that is worth saying plainly** given it is
now the default. It was already being frugal - guessing narrow filters and
pulling back a handful of bottles - so replacing four cheap targeted
browses with one whole-cellar read costs it tokens rather than saving them.
The absolute number is sub-cent ($0.0065 a query) and n=1 per cell, so this
is within what a single run can resolve; it is not a reason to undo
anything, but it is not a win either. Sonnet kept its good instinct where
it mattered, still filtering to `type=Pinot Noir` for the flight query (6
matched, the cheapest run in the set) and across sparkling categories for
the rosé one.

**A correction to the estimate above:** the char/4 heuristic used to size
the payload was roughly half the real cost. The cellar measures ~123 tokens
a bottle, not ~58 - so 69 bottles is ~8,500 tokens, not 4,200, and a
117-bottle cellar is ~14,400, not ~7,200. The direction of the change holds
and the cap is still sized sensibly, but JSON of this shape tokenizes at
about 2 characters per token and should be estimated that way in future.

Quality did not suffer and reads better: Opus's ribeye answer now names the
peppery-Syrah mechanism outright and offers an everyday bottle against a
splurge, and Sonnet's Thanksgiving picks became risk-aware in the way only
Opus's were before.

---

### The mechanical calls, measured at last — 2026-09-21

The hold below can be lifted, and the answer is to change nothing - but now
for a reason rather than out of caution. Each call was run twice against a
real key, at `high` and at `low`, with a wrapper forcing the level so the
same code path ran both times.

| call | effort | latency | input | output | cost |
|---|---|---|---|---|---|
| Scan a label (2 turns) | high | 4.8s | 2 + 151 | 55 + 201 | **$0.015** |
| Scan a label (2 turns) | low | 4.8s | 2 + 238 | 55 + 201 | **$0.015** |
| Drink windows, 6 bottles | high | 3.9s | 1,269 | 219 | **$0.005** |
| Drink windows, 6 bottles | low | 3.0s | 1,269 | 219 | **$0.005** |

**The token counts are byte-identical at both levels.** Not close - the
same numbers. Latency differs by less than the run-to-run noise, and both
scans read the label correctly; both window passes produced sensible
ranges (Lynch-Bages 2015 as 2025-2045).

**Why, and why it is the opposite of research.** These calls are
schema-constrained extraction with `thinking: adaptive`, which had already
decided almost no thinking was needed. The effort dial sets a *ceiling* on
thinking, and these calls were nowhere near it - so lowering the ceiling
changed nothing. Research is the opposite: open-ended, with a live web
search, where the model genuinely spends the budget. That is why the same
dial was worth 2.5x the cost and 4.5x the latency there (see #17) and is
worth exactly nothing here.

**So: leave all four at `high`.** Not as a deferral - as a finding. There
is no saving available on this path, and the honest conclusion of "measure
before turning them down" is that turning them down does nothing.

**Unit costs for the usage ledger** (`FUTURE_CAPABILITIES.md`): a scanned
photo is **$0.015**, a drinking-window estimate is **$0.0008 per bottle**
(and cached by wine identity, so a repeat is free). Against Suggest at
$0.03-$0.19 and research at $0.073 a bottle, these two are rounding errors
- a cap should be built around Suggest and Research and can essentially
ignore scanning.

**Caveat worth keeping:** the scan was measured on a clean, synthetic,
single-wine label. A real photo - bigger, noisier, or a tasting sheet with
eight wines on it - costs more, mostly in image tokens. The figure is a
floor, not an average.

---

Effort is now explicit at every call site, but only the two the owner steers
actually move. The other four - reading a label, reading a photo, and the two
drinking-window estimates - are all still at `high`, and that is a deliberate
hold rather than an oversight: stepping one of them down trades accuracy for
speed on the owner's behalf, and this session had no API key, so the trade
could not be measured.

The drinking-window calls are the strongest candidate. The task is bounded
and schema-constrained, the answer is cached by wine so it runs once per
distinct bottling, and the result is already labelled "· estimated" on screen
- so a window that is a year out is visible as a guess rather than passed off
as fact. The experiment: take ~20 bottles spanning cheap-and-early through
age-worthy, run each at `low` and at `high`, and compare the windows. If they
agree within a year, `low` is free.

Reading a label and reading a photo are the weakest candidates and probably
should not move at all: a producer read wrong is a wrong bottle saved to the
cellar, and a scan runs unattended across a batch where nobody is watching for
it.

### ~~The caching win, measured~~ — done 2026-09-20 (one of three)

The free win to take before spending anything on effort was a
`cache_control` breakpoint on the prompts that lacked one. Measured
first, as this entry said to, because below a model's minimum cacheable
prefix a breakpoint silently does nothing - and that check is what
decided it.

The minimums, worth keeping written down: **Claude Opus 5 caches from 512
tokens, Claude Sonnet 5 from 1024.** Both mechanical prompts run on
`EXTRACTION_MODEL` (Sonnet 5), so 1024 is the bar. Tools render before
system, so a prefix is tools *plus* system, not system alone:

| Call | Prefix | vs 1024 | Outcome |
|---|---|---|---|
| Research (`runResearch`) | ~1,580 tok | clears it | **breakpoint added** |
| Photo details | ~1,055 tok | on the line | left alone - too close to call without `count_tokens` |
| Drinking windows | ~600 tok | ~40% under | left alone - would cache nothing |

Drinking windows fails twice over: under the minimum, and it's a single
batched request for every wine at once, so there is barely a repeated
prefix to reuse in the first place. Photo details is a one-off per photo,
with no back-to-back pattern even if it did cache.

So only Research got one, and what earns it is the traffic shape rather
than the prefix size: the loop re-sends the prefix up to four times per
bottle, and the bulk queue now runs step after step server-side (see
#17's `after()` rewrite), so one cache entry serves a whole run.

**Honest about the size of the prize:** the money is pennies - roughly
$0.30 per 30-bottle bulk run. The better argument is throughput. A cache
read skips reprocessing the prefix, and since that bulk chain now runs
inside a single invocation's execution budget, faster prefix handling
means more bottles finish before the ceiling. It also compounds under
[`FUTURE_CAPABILITIES.md`](./FUTURE_CAPABILITIES.md)'s multi-user plan,
where several accounts share one cached prefix.

Verified by capturing the actual outgoing request: `system` arrives as a
single text block carrying `cache_control: {type: "ephemeral"}`, with
`web_search` and `record_research` ahead of it.

**Still to confirm with a real key:** that the cache is actually being
hit - `usage.cache_read_input_tokens` should be non-zero on the second
and later calls of a bulk run, and zero would mean something in the
prefix is varying. The same check is worth running against the two
prefixes that were already cached (scan, Suggest), which have never been
measured. `scripts/compare-suggest-models.mjs` already reports all four
usage counters and is the readiest place to do it. Photo details needs a
`count_tokens` measurement before anyone decides about it either way.

## ~~24. Suggest: "Keep" vs. "Log", and a page that is doing a lot at once~~ — done

Raised by the owner using the Suggest screen after pairing persistence
(#20) and the effort control (#20) both landed on it.

### "Keep this pairing" vs. "Log this pairing" - what each one actually does

Two different verbs on the same screen, and they are not close to being the
same action, which is exactly why the wording needs to say so:

- **"Keep this pairing"** (`SuggestForm.js` `handleKeepPairing`) calls
  `savePairing` - it writes a `SavedPairing` + `PairingPick` row for the
  *whole* result, owned wines and gap suggestions together. It is a record
  of the recommendation itself: what was asked, the settings, every pick and
  its reason. Nothing about any bottle changes - not its status, not its
  tasting notes.
- **"Log this pairing"** (`SuggestForm.js:415`, only shown on an *owned*
  pick that has a `pairingContext`) is a `Link` to
  `/bottles/{id}?pairedWith={dish}` - the bottle's own page, with its
  tasting-note textarea pre-filled `Paired with: {dish}` (`bottles/[id]/
  page.js:349`). It logs nothing by itself. It is one click short of
  logging: the owner still has to fill in the rest of the note (or just the
  rating) and press "Add tasting note", which calls `addTastingNote`. That
  action does **not** touch `Bottle.status` - a bottle stays `inventory`
  until something else marks it `consumed`. So logging a pairing is not
  "marking it Tasted" in the status sense; it is writing one tasting note,
  pre-addressed to the right dish, on a bottle that may or may not ever get
  marked consumed as a separate act.

So the two verbs are: *keep* = save the suggestion as a record; *log* =
jump to one wine's own page to write about drinking it. They operate on
different things (the pairing as a whole vs. one bottle) and neither implies
the other - keeping a pairing doesn't log anything, and logging a note
doesn't keep the pairing that led to it. The current names don't carry any
of that distinction; both read as "save this."

### The page is content-heavy

Per screen, in the order they appear: the request textarea, an
include-outside checkbox with two lines of explanation, the Character
fieldset (radios + hint), the Effort fieldset (radios + hint), the submit
button - and only after all of that, a result with a mode label, a title, a
"Why these" `<details>` that is easy to miss sitting under a heading with a
save button beside it, then one card per pick. Two controls
(`fieldset`s for Character and Effort) are visually the loudest things on
the page and are usually left on their defaults - the same shape problem
`characterRule` already reasons about ("Balanced ... is the same answer as
never touching the control").

The `SuggestPage` server wrapper (`app/(owner)/suggest/page.js`) adds one
more thing above all of it: a "Kept pairings →" link in the heading row on
every visit, whether or not a pairing exists yet, and whether or not this is
a refine-from-a-kept-pairing visit. Why it is there at all: with the tab bar
landing at four tabs (#17), Suggest has no other way back to `/pairings` -
Home has a card for it, but the nav bar doesn't. Pulled from the top of
every visit and put somewhere lower-traffic (or made conditional), that
navigational need still has to go somewhere.

### Refining already exists, in a different place

The specific ask - "is there a way to iterate/refine suggestions on this
page" - is partly already answered, from a different starting point than
"this page": a **kept** pairing's own page offers "Ask again, with changes"
(`pairings/[id]/page.js:57`), which reloads `/suggest?from={id}` with the
request and all three settings restored, ready to change one and resubmit.
That only helps once a pairing has been kept, though - a first attempt you
don't like yet, and haven't kept, has no such shortcut: `character` and
`effort` do stay in component state after a search (nothing resets them but
a fresh submit), so changing Character and pressing "Get suggestions" again
already re-runs against the same typed request without retyping it - the
friction there is scrolling past the result to reach the controls, not
retyping. Whether that in-place case wants its own explicit "refine" action
(e.g. a button that scrolls back up and/or collapses the result) is open.

### Decided, and built

Scoped with the owner; four questions, four answers, all shipped as
described below. "Save this pairing" / "Add a tasting note" replace
"Keep"/"Log" everywhere on the Suggest screen, including the success
message ("Saved, with the wines...") and the internal handler name
(`handleSavePairing`). Character, Effort and the include-outside checkbox
now live behind one `<details>`, closed unless the loaded settings already
differ from default (`optionsOpen`, seeded once - same rule as
`FilterBar`'s `hasAnyFilter`), with a live summary line ("Balanced ·
Standard effort · cellar only") so the values stay legible while closed.
"Kept pairings →" is now conditional on `prisma.savedPairing.count() > 0`.

1. **Naming.** ~~"Keep this pairing" / "Log this pairing"~~ →
   **"Save this pairing"** (matches Flights' "Save this flight" - one save
   verb across the app, instead of two that sound alike and aren't) and
   **"Add a tasting note"** (says exactly what the link does, since it
   doesn't log anything by itself - see the write-up above).
2. **Character, Effort and include-outside collapse behind one
   disclosure**, closed by default - the same rule `FilterBar` already uses
   (`hasAnyFilter`, `FilterBar.js:41`): open automatically when the loaded
   state isn't all defaults. That covers both a mid-session non-default
   choice and a `?from=` refine load - a kept pairing's settings are rarely
   all-default, so refining opens the panel instead of hiding what was just
   restored.
3. **"Kept pairings →" becomes conditional** on at least one pairing
   existing (one more cheap count alongside what the page already queries),
   and stays where it is at the top. The empty-state link was the actual
   clutter - nothing to compare against yet - not its position.
4. **No dedicated "refine" control for a first, unsaved attempt.**
   Collapsing the options panel (item 2) already shortens the page enough
   that the remaining friction is scrolling past picks, not past controls.
   Revisit only if that's still a complaint once item 2 ships.

## ~~25. Home page: a stated ordering principle, not just this reordering~~ — done

Raised by the owner: they like the home screen, want it ordered by how often
each destination is actually used, and gave a concrete layout - Suggest,
then (their words) "Pairings and Tastings," then Tasting notes, filling the
left column top to bottom; Scan, Research, Wishlist, Cellar filling the
right column top to bottom.

### What is already true

`app/(owner)/page.js` renders eight cards from a single array into
`grid grid-cols-2 gap-3 lg:grid-cols-3` (`page.js:165`). The array is already
ordered by a stated rule - "Actions first: ... scanning a label or asking
what to open is more often why you opened the app than reading a count is"
(`page.js:82-84`) - which put Scan and Suggest first, ahead of every list.
That rule is about action-vs-collection, not about usage frequency within
each group, and it's one card short of the owner's list: Flights has no
home in either the owner's left or right column as given.

**The layout mechanic matters here.** `grid-cols-2` fills row-major - item
0 and item 1 share row 1, item 2 and 3 share row 2, and so on. Simply
reordering the array to `[Suggest, Pairings, ..., Tasting notes, Scan,
Research, Wishlist, Cellar]` would *not* produce "Suggest, Pairings, ...
top-to-bottom on the left" - it would pair Suggest with Pairings in row 1,
Scan with Research... reading left-to-right, not down-a-column. Getting a
true two-column, column-major reading order needs either two separate
`flex-col` stacks side by side, or CSS grid with `grid-auto-flow: column`
and an explicit row count (`grid-rows-4` or similar) - a real structural
change, not a one-line array reorder.

### Decided, and built

1. **Four items.** Left column, top to bottom: Suggest, Pairings, Flights,
   Tasting notes. Right column: Scan, Research, Wishlist, Cellar. All eight
   existing home cards accounted for - "Tastings" means Flights
   (`/flights`), not a second mention of Tasting notes.
2. **The heuristic, written down** rather than left implicit in array
   order: (a) actions before collections - a thing you *do* (Scan, Suggest)
   outranks a thing you *browse*, because doing it is more often why the app
   was opened than checking a count; (b) within each group, order by how
   often it's actually reached for; (c) a pair that feeds into each other
   (Suggest → Pairings) stays adjacent when that doesn't conflict with (a)
   or (b). This replaces the current one-clause comment above the `cards`
   array.
3. **Frequency source: the owner's own sense**, revisited by asking again
   later if it stops matching reality. No `lastVisitedAt` tracking -
   overkill for eight cards in a single-user app, and a five-minute
   conversation is cheaper than building a usage log to justify itself.
4. ~~Two independent `flex flex-col` stacks side by side~~ - built that
   way first, and wrong. A real grid keeps every row's height in sync
   across both columns automatically; two independent flex-col stacks
   don't, so a card whose description wraps to a second line in one
   column (Research, Tasting notes) pulls only its own column down with
   it. Caught by measuring rather than eyeballing it: rows drifted a real
   12px apart by the last one. Shipped instead:
   `grid grid-cols-2 grid-flow-col grid-rows-4` - `grid-auto-flow: column`
   fills one column completely before moving to the next, in DOM order,
   so the exact same flat, left-column-then-right-column array reads as
   the two stacks that were asked for, while staying a true grid where
   every row's height still matches across both columns, the way plain
   `grid-cols-2` always did. The `lg:grid-cols-3` step-up is still
   dropped: a three-column split has to decide where an eight-card,
   two-column usage order breaks into three, which nothing here
   specifies, and the app is phone-first enough that losing a desktop
   third column is a minor, reversible trade - worth a second pass later
   if wide screens turn out to matter, not a guess now.

## ~~26. Cellar and Wishlist: Scan and hand-entry on one line~~ — done

Raised by the owner: put "Scan" and "Add a bottle..." on one line on both
the Cellar and the Wishlist page.

### What is already true

Both pages already offer exactly these two ways in, stacked vertically in a
`flex-col` (`inventory/page.js:59`, `wishlist/page.js:30`), and the two
pages treat them with *different* emphasis on purpose, per their own
comments:

- **Cellar** (`inventory/page.js:40-45`): "Browsing comes before adding
  here ... a cellar of hundreds is the reverse [of the wishlist]." Scan is a
  full bordered button; "Add a bottle by hand" is a plain underlined text
  line below it, deliberately de-emphasized - "no longer a boxed block
  competing with the wine" (a comment describing a past change made for
  that exact reason).
- **Wishlist** (`wishlist/page.js:24-29`): "Adding comes before browsing:
  the two ways in sit at the top." Scan is the same bordered button; "Add a
  bottle to your wishlist" is a bordered box (`<details>` with its own
  border), closer in visual weight to Scan than Cellar's version is.

So the two pages don't currently match each other, and that's on purpose -
different relationship to how often each list gets added to by hand.

### Decided, and built

A shared `ScanAndAddRow` component now renders the row on both pages,
matching each other for the first time: Scan stays the flex-1 bordered
button, "Add by hand" is a small text trigger beside it that opens a
full-width form panel below the row (not squeezed into its own half - a
plain button-and-state disclosure, not `<details>`/`<summary>`, since
`<summary>` only behaves as the toggle when it is a direct child of
`<details>`, which it can't be while also sitting in a flex row next to
Scan). Both labels shortened to fit two-up at 375px ("Scan", "Add by
hand").

1. **Scan stays primary on both pages.** The bordered button keeps its
   prominence; "Add a bottle by hand" becomes a smaller link/toggle beside
   it - same relative hierarchy as today, just horizontal instead of
   stacked. Cellar's existing call to de-emphasize hand entry survives.
2. **Cellar and Wishlist end up matching.** With (1) decided, there's no
   reason left for them to differ: Wishlist's current bordered-box treatment
   of hand entry becomes the same de-emphasized link Cellar already uses, so
   both pages read the same way for the first time.
3. **Labels shorten to fit.** The primary button drops to "Scan" (icon
   still present) at this narrower width - "Scan a label or shelf" doesn't
   fit two-up at 375px. Verified in the browser once built, the way every
   other change this session has been.
4. **The form expands full-width below the row** when opened - trigger row
   stays compact, `BottleForm` renders underneath spanning the full
   container, unchanged from today's behavior.

## ~~27. Search: typo tolerance, and a general box that expands to specifics~~ — done

Raised by the owner: are search boxes exact-match only today, is low-cost
typo tolerance possible, and should a search start as one general box that
expands to the specific filters.

### What is already true

Matching is **substring, not exact** - `filterBottles` (`lib/filter-
bottles.js:199-229`) uses case-insensitive `.includes()` on a concatenation
of every bottle field (`searchableText`, same file, line 6) for the free-text
Search box, and the same `includesInsensitive` per-field for Variety,
Region, Sub-region and Country. "rochioli" matches "Rochioli", "margaux"
matches inside "Château Margaux" - so the premise that only exact matches
are captured isn't quite right, but there genuinely is **no typo
tolerance**: "Rochiolli" or "Rochioly" would not match "Rochioli", and there
is no diacritic folding either - a search for "chateau" (no accent) would
not match "Château" stored with one, since `.includes()` is a literal
codepoint comparison.

One precedent for fuzzy-ish matching already exists and is worth knowing
about before reaching for something new: `canonicalizeVarietal`
(`lib/varietal-match.js`) resolves a searched grape name through a curated
alias table (~140 entries) so "Grenache" also finds bottles logged as
"Garnacha" or "Cannonau" - but it's an exact lookup against known aliases,
not edit-distance/typo tolerance, and it only applies to the Variety field.

On the second half of the ask - the panel's shape - `FilterBar` currently
puts the free-text Search box and every specific field (Variety, Region,
Sub-region, Country, Color, Vintage, Rating) **inside the same single
`<details>`** (`FilterBar.js:56-185`), which is itself collapsed by default
unless a filter is already active (`hasAnyFilter`, seeded once on mount).
Opening the panel reveals everything at once - there's no separate "just the
general box" state today, only "collapsed" and "everything open."

### Decided, and built

1. **Diacritic folding now; true typo tolerance deferred.** Folding
   (`.normalize("NFD")` + stripping combining marks, applied to both the
   stored text and the typed term before comparing) ships as part of this -
   unambiguous, a few lines, no dependency, and it fixes a real, common case
   for this data (Château, Côtes, Occitanie, a Riesling producer with an
   umlaut). Edit-distance typo tolerance is a real feature but changes match
   *behavior*, not just normalization - a short producer name can
   false-positive against an unrelated one at distance 1-2 - so it's worth
   living with diacritic folding first and coming back to typo tolerance as
   its own follow-up if misspellings are still a live complaint once that's
   shipped.
2. **Diacritic folding applies everywhere text is compared** - the Search
   box and the per-field Variety/Region/Sub-region/Country inputs alike. The
   same "Château" problem exists whichever box it's typed into; no reason to
   special-case it to Search.
3. **The Search input moves out of the `<details>`, always visible.** The
   collapsed panel keeps Variety/Region/Sub-region/Country/Color/Vintage/
   Rating behind it, its summary line reads "More filters" instead of
   "Search & filter", and the seeded-open check (`hasAnyPanelFilter`, a new
   export alongside `hasAnyFilter`) now looks only at the fields still
   inside the panel - Search, being always visible, has nothing there to
   seed. One thing not explicitly scoped, settled the same way while
   building it: the panel's own "Clear" button used to sit inside a box
   that held Search too, so clearing everything from in there read as
   local. It doesn't anymore - Search lives outside the panel now - so it's
   relabelled "Clear all" rather than quietly changed to leave Search
   alone; it's still the one `onClear` the chip row's own "Clear all"
   already used; `fold()` lives in `lib/filter-bottles.js`, unexported,
   next to the other string helpers it joins (`searchableText`,
   `includesInsensitive`).

## ~~28. Pairings: tighter summaries and "Drink tonight"~~ — both done

Raised by the owner, looking at both the pairings list and a kept pairing's
detail page.

### What is already true

The **list** (`app/(owner)/pairings/page.js`) already shows a compact line
per pairing via `pairingSummaryLine` (`lib/pairings.js:47-52`) - dishes
first, then a wine count ("the roast chicken, the halibut · 3 wines") - and
below that, the request text itself, clamped to two lines. It does **not**
name which wines were picked in that summary line, only how many.

The **detail page** (`pairings/[id]/page.js`) shows every pick fully
expanded, always - dish badge, wine name (linked if still owned), region/
gap badge, and the full reason text, all visible at once with no collapse.
For a pairing with several picks this is the same "everything at once"
shape as `FilterBar`'s panel before it had a summary line, and it's exactly
the pattern `BottleList.js` already solves elsewhere in the app: a
one-line, tappable row (`bottle.producer` + vintage + type, `BottleList.js:
95-110`) that expands on tap to the fuller detail (region, notes, actions).
Nothing here currently reuses that pattern.

### "Drink tonight" - what it would need that doesn't exist yet

`SavedPairing`/`PairingPick` (`prisma/schema.prisma`) record what was
recommended and, per pick, whether a `bottleId` still resolves to an owned
bottle - nothing about *when* you plan to open it, or whether you have.
There is no "drinking this tonight" state anywhere in the schema, and
`Bottle.status` (`inventory`/`wishlist`/`consumed`) is the only lifecycle
signal that exists, tracked per bottle, not per pairing. Two different
things could be meant by "Drink tonight," with different costs:

- **A pure navigation shortcut, no new data**: a card at the top of
  `/consumed` (or its own small section) surfacing kept pairings - most
  recent, or all of them - each linking straight to its wines' `?pairedWith=`
  pre-filled note forms, the same links `SuggestForm`'s "Log this pairing"
  already produces per-pick (#24 above). Zero schema change, but it's a
  static list, not something you "start" or "finish" - every kept pairing
  would show there permanently, or by recency, not because you're
  drinking it tonight specifically.
- **An actual planned/in-progress state**: marking a specific kept pairing
  (or one bottle within it) as the one being opened tonight, so it surfaces
  prominently and clears afterward. This needs new state - at minimum a
  timestamp or boolean on `SavedPairing` or `PairingPick`, plus a decision
  about what clears it (all notes logged? a manual dismiss? time-based?) and
  whether it's one pairing at a time or several.

### ~~Decided, before building~~ — decided and built

1. ~~**The list summary names the wines, short form.**~~ Producer only -
   not the full `wineLabelForBottle` heading (producer + bottling + vintage
   + type) - so it doesn't crowd out the dish names it sits beside: "the
   roast chicken, the halibut, the lamb · Rochioli, Dr. Loosen, Envinate".

   One thing this needed that wasn't in the plan: there was no clean way to
   get "producer alone" back out of the stored `wineLabel` snapshot without
   parsing a formatted string (which quoted segment is a bottling name,
   which 4-digit number is a vintage and not part of the producer) - the
   kind of fragile guessing this schema avoids everywhere else. Added
   `PairingPick.wineName`, written alongside `wineLabel` at save time
   (`wineNameForBottle`/`wineNameForGap` in `lib/pairings.js`, called from
   `savePairing`) rather than derived from it. A migration backfills
   existing rows with their full `wineLabel` as a safe, honest stand-in
   (longer than ideal, never wrong) until each is refined and re-saved.
2. ~~**The detail page adopts `BottleList`'s collapsed-row pattern.**~~
   Collapsed: dish badge (if any) + the full heading (`wineLabel` - this
   row isn't sharing space with other picks' dish names, so it keeps the
   fuller one) + the owned/gap/no-longer-owned badge, the same minimum
   identifying line `BottleList` already uses for variety/region. Expanded:
   region/gap detail and the full reason text, plus a "View full details →"
   link when a bottle still exists - moved out of the collapsed row rather
   than left as a link inside it, since an `<a>` nested inside the row's
   own toggle `<button>` is invalid HTML and an ambiguous tap target; the
   same reason `BottleList`'s own version of that link lives in its
   expanded content, not its collapsed row. A new `PairingPicksList`
   component, not a reuse of `BottleList` itself - a pick isn't a bottle
   (it may have none at all, and carries a dish and a reason `BottleList`
   knows nothing about), so this is the same pattern built again rather
   than one component stretched to cover both.

### Decided and built - see #40

3. ~~**"Drink tonight" is deferred**, on the owner's call.~~ Decided: a
   real planned/in-progress state, not the pure navigation shortcut, and
   not the wider wine-tagging idea raised as an alternative (still
   possible later, as its own separate feature - the tagging idea was
   never specific to Pairings, so this doesn't close it off). Resolves
   `PairingPick`'s open question too: the whole pairing, not one wine
   within it - a multi-course menu is "tonight's" as a unit, and #24's
   rename of "Log this pairing" to **"Add a tasting note"** is what each
   wine in it still uses individually once you're actually pouring.
4. ~~Where it surfaces stays open along with it~~. `/pairings` (badge, and
   sorted first), the pairing's own page (the toggle itself), and the
   home page's Pairings card (its description swaps from "Kept" to
   "N tonight") - see #40.

## 29. UX critic findings (2026-09-18): drinking window visibility, irreversible research decisions, and more

Raised by the owner: run the read-only `ux-critic` agent
(`.claude/agents/ux-critic.md`) against the current app and record what it
found, for later scoping/prioritization - not yet decided or built.
Session context: this immediately followed the Flights/Pairings collapse
redesign, the tab bar reorder (Pairings added), and the new
`BackButton`/`NavigationDepthTracker`; the agent was pointed at those three
specifically, on top of its own standing judgment of what most needs
attention.

Three of its more specific claims were spot-checked against the code
before trusting them, and all three held up exactly as described:

- `adjustBottleQuantity` really does floor at `Math.max(1, ...)`
  (`app/actions.js:403`) - the quantity stepper can never take a bottle to
  zero.
- `app/(owner)/pairings/page.js:7`'s `// Not in the nav, deliberately`
  comment is still there, and is now stale - Pairings is in the tab bar as
  of this session's tab-bar reorder.
- `app/components/NavLinks.js` (the desktop nav) really doesn't match the
  new phone tab bar's order, and doesn't include Pairings at all.

The last two are worth noting on their own: the agent is read-only and has
no memory of this session, but it reads the live files each run, so it
caught a real gap the tab-bar change left behind without needing to be
told anything happened.


### Status, reconciled 2026-09-21

Findings **1, 2, 4 and 7 were built during the 2026-09-20/21 sessions** and
this list was never updated to say so - the backlog was claiming open work
that had shipped, which is the kind of drift that makes a backlog stop
being worth reading. Struck through above, with what landed:

- **1** - `lib/drink-window.js` puts one short phrase on the cellar row and
  the bottle page, "estimated" at the same weight as the rest of the line.
- **2** - `ResearchProposalCard` wraps Accept in `ConfirmButton` naming the
  fields it will change, and "Keep as is" became "Discard this research"
  with its own confirm.
- **4** - `undoOneTasted` / `unmarkFlightPickConsumed`, surfaced through
  `TastedControls` so the Undo survives the status flip.
- **7** - `FlightPicksList`: number and title collapsed, reason and
  controls on expand.

~~**Still open: 3, 5, 8**~~ - all done, see #39.

**6 is done (2026-09-21).** One root cause under both halves:
`createBottleWithNote` returned `{ success: true }` without the bottle, so
the card had nothing to become a saved card *with*, and its `onResult` set
`status: "saved"` while every reader in the file keys off `kind`. Returning
the bottle and setting `kind: "saved"` fixes the collapsed state and the
counter together, and deletes the parallel `status === "saved"` state
rather than leaving two ways to say the same thing.

Reproduced before and after against a production build, using a photo that
reads but whose save fails - the case the counter actually counts. Before:
"1 still to save" with a bare "✓ Saved" card. After: the count is gone, the
card carries the wine's name, destination and a Reopen, and the bottle is
in the database.

### Breaks the task

1. ~~**The drinking window is invisible everywhere except one bottle's own
   page**, and hard to read even there. `BottleList.js` shows
   producer/bottling/vintage/type/region on a cellar row but never the
   window, even though "Drink soon" is the app's own sort. The one place it
   appears (`bottles/[id]/page.js:151-164`) draws "estimated" in
   low-contrast `italic text-zinc-400` on `bg-zinc-100` (worse in dark
   mode) - the label carrying the most weight on the page is the hardest to
   read. Flight picks, pairing picks, and Suggest cards all name wines
   without ever saying when to drink them. Proposed fix: put the window on
   the collapsed cellar row as one of four short phrases (`Past peak (to
   2019)` / `Drink by 2027` / `Ready 2028` / `No window`), keep "estimated"
   the same weight as the rest of the line rather than lighter, and reuse
   the same string everywhere a wine's name appears.
   **Open question:** how much cellar-row space this earns next to
   region/country (#22, already on the row) - may need its own
   visual-priority pass rather than just appending a fifth fact to an
   already-busy line.
2. ~~**Research accept/dismiss is one irreversible tap, unconfirmed**, unlike
   every other destructive action in the app. `ResearchProposalCard.js:
   145-172` - "Accept N changes" overwrites fields and deletes the proposal
   in one transaction (`app/actions.js:1520-1533`); "Keep as is" also
   deletes the proposal (`app/actions.js:1593`) despite reading like the
   safe no-op. `ConfirmButton` already exists and is used everywhere else
   destructive (bottle delete, photo delete, flight delete, scanned-wine
   delete) except here, the one place a wrong tap silently rewrites several
   fields and throws away the app's most expensive call.
   **Open question:** whether Accept should gain a `ConfirmButton` at all
   (adds a tap to the *common* path, not just the mistake), or just get
   more separation from "Keep as is" plus a rename of the latter to
   something honest ("Discard this research").
3. ~~**The cellar row's quantity stepper isn't what "I drank one" should
   use, but reads like it.**~~ — done (see #39). The expanded row now
   renders `TastedControls` (the exact component the bottle's own page
   uses, not a second implementation) whenever status is `inventory`, and
   the stepper is relabelled "Correct the count" so the two read as
   different questions.
4. ~~**"Mark as tasted" in a flight can't be undone, and the app is unsure
   what it should even mean.** Marking a `FlightPick` consumed
   (`app/actions.js:2303`) only flips a boolean - the cellar's own quantity
   is untouched, so "tasted" means something different here than it does on
   the bottle page's `Tasted one` button. Once marked, both "Mark as
   tasted" and "Log a tasting note →" disappear (`FlightPicksList.js:112`)
   with no way back short of removing the pick entirely.
   **Open question, flagged by the agent itself as one it wasn't sure
   about:** should marking a flight pick tasted decrement the bottle's
   count (matching the bottle page's meaning), or stay a pure checklist
   tick independent of inventory (defensible for a flight poured from a
   single already-open bottle)? An owner call, not an engineering one - a
   flight poured at one dinner and a flight worked through over months
   probably want different answers.

### Costs the user

5. ~~**The research diff table scrolls sideways at 375px.**~~ — done (see
   #39). Stacked per field (label, then "Now: …" / "Proposed: …") below
   `sm:`; the original three-column table is unchanged at `sm:` and up.
6. ~~**A manually-typed Scan card collapses to a bare "✓ Saved" with no
   name, no link, no way to edit** (`ScanPanel.js:1156-1159`), unlike a
   normally-scanned card's collapsed state, which keeps the name,
   destination, research flag, and a Reopen button. Paired with an actual
   counting bug: `batchProgress` keys off `entry.kind === "saved"`
   (`ScanPanel.js:67-75`), but the manual-save path only sets `status:
   "saved"` and leaves `kind: "draft"`, so the batch summary keeps calling
   a wine you already saved "still to save."
7. ~~**The Flights collapse (this session's own change) doesn't save as much
   space as intended, and two controls inside it are worth a second look
   regardless of the collapse.** A collapsed pick is still ~130px because
   the Order/Remove strip and the Mark-as-tasted/Log-a-note row both render
   outside the `expanded &&` block (`FlightPicksList.js:83-129`) - six
   picks still don't fit on a phone screen. Independent of that: the
   reorder arrows are 24px (`h-6 w-6`, `FlightPicksList.js:9-10`) against
   the app's own "thumb-sized or it's decoration" standard
   (`TabBarLinks.js:44`), and "Remove from flight" is a bare unconfirmed
   text link 8px from them - the one destructive action among the four
   flight controls that skips `ConfirmButton`.
   **This is a direct second opinion on a call made this session** (keeping
   those controls always-visible below the collapse rather than moving them
   inside it) - worth weighing deliberately, not just filing.
8. ~~**The guest heart gives no feedback, and the sign-in copy doesn't say
   whose cellar this is or that picks are visible to the owner.**~~ —
   done (see #39). The heart is a real button now (`useTransition`,
   disabled + dimmed while in flight, a 44px target), and both guest
   screens name the owner and say they'll see the guest's name next to
   what they favorite.

### Polish — all done, see #39

- ~~Desktop `NavLinks.js`'s order and set no longer match the phone tab
  bar~~ - reordered to match the tab bar's first five exactly
  (Home/Suggest/Pairings/Scan/Cellar), then the three desktop-only extras
  the phone bar has no room for. The stale "Not in the nav, deliberately"
  comment on `pairings/page.js:7` is rewritten.
- ~~No pending/loading state on the bottle page's `Tasted one`, `Tasted all
  N`, `Bought it` buttons~~ - `Bought it` moved into `TastedControls`
  (it was the one status button still a plain form, outside the component
  every other one already got `isPending` from for free), and a shared
  `Spinner` now shows on all of them while in flight.
- ~~`/research` queue's per-row buttons are ~20px tall with an unconfirmed
  "Dismiss"~~ - both are real 44px targets now (`min-h-11`); left
  `Dismiss` unconfirmed on purpose, since at this stage (before any search
  has run) there's no proposal yet to lose - `ResearchProposalCard`'s own
  "Discard this research" already confirms the one that does risk that.
- ~~README/PROJECT.md drift~~ - README's card count corrected to eight (+
  the export link, not a ninth card) and its counted-card list updated to
  include Pairings and Research; both files' "pairings are ephemeral, not
  saved" claims corrected to describe `/pairings` and "Save this pairing".

### Decided, and built (2026-09-18) — findings 4 and 7

Both of the questions this entry left open for the owner were answered and
built the same day:

- **Finding 4 (what "Mark as tasted" should mean): option B.** A flight
  pick's "tasted" button now calls the exact same decrement path as the
  bottle page's own "Tasted one" button (`markOneTasted`, reused directly
  rather than duplicated) - `markFlightPickConsumed` in `app/actions.js`
  decrements `Bottle.quantity`, or on the last one flips it to `consumed`
  with `emptiedAt` stamped, before flipping the pick's own `consumed` flag.
  Guarded on `pick.consumed` so a resubmitted form (a double-tap before the
  page revalidates) can't decrement twice. The button's label now matches
  the bottle page's wording exactly - `Tasted one — N left`, or plain
  `Tasted` on the last one - since it's doing the same thing.

  The undo-ability half of finding 4 followed once that made a mis-tap
  consequential: a consumed pick's expanded panel now shows **Undo** where
  the Tasted button was, calling `unmarkFlightPickConsumed`. It reverses
  `markFlightPickConsumed` exactly rather than approximating it - restores
  the quantity it decremented, or (on the last-bottle case) puts the bottle
  back in `inventory` and clears `emptiedAt` via `setBottleStatus`, the
  same function "Bought it" already uses for the equivalent forward move.
  Guarded on `pick.consumed` the same way its counterpart is. Both paths
  verified against the database directly, not just the screen: quantity
  restored correctly, and the last-bottle case correctly reversed both the
  status flip and the `emptiedAt` stamp.

  Extended past the flight, on the owner's follow-up ask: the bottle
  page's own Tasted one / Tasted / Tasted all N buttons got the same Undo,
  reusing `undoOneTasted` directly rather than a second implementation -
  it decides which reversal applies from the bottle's current status, so
  the one function already covers all three buttons correctly. Now a
  `TastedControls` client component instead of plain `<form>` actions,
  since Undo has to survive the exact moment it exists for: tasting the
  last bottle (or "Tasted all") moves `status` away from `"inventory"`,
  which used to be what gated whether the buttons rendered at all - a
  component gated the same way would have unmounted right as Undo needed
  to appear, taking its own `useState` flag with it. The page now renders
  `TastedControls` unconditionally (past the wishlist stage) so the
  component instance survives that status flip. All three paths -
  decrementing, the last bottle, and "Tasted all" - verified against the
  database directly, undoing back to their exact starting state.
- **Finding 7 (control placement): option C.** Everything below a flight
  pick's collapsed identity line - the reason, the "View full details"
  link, the Order/Remove row, and the Tasted/Log-a-note row - now lives
  inside the expanded panel, matching `PairingPicksList`/`BottleList`'s own
  row shape exactly. A collapsed pick is one line tall. The two
  regardless-of-placement fixes the same finding named came along with it:
  the reorder arrows are 44px (`h-11 w-11`, were `h-6 w-6`), and "Remove
  from flight" is wrapped in `ConfirmButton` with a warning, rather than a
  bare unconfirmed text link.

`app/components/FlightPicksList.js`, `app/actions.js:markFlightPickConsumed`.

### Endorsed as-is (from the same review - not findings, don't re-litigate)

The collapsed filter panel on Cellar, saving scan results before review,
the destination-first Scan flow, `ConfirmButton` as a pattern (just
under-used in the spots above), and this session's own
`BackButton`/`NavigationDepthTracker` - called out by name as "the
deep-link-vs-click-through distinction is subtle and handled correctly."

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

## 30. Model text can leak tool syntax into a field meant for prose

Found 2026-09-21 while re-measuring #23, in 1 of 20 real Suggest runs.
Sonnet ended a pairing summary mid-sentence and then wrote, *inside the
string*:

```
...to the richest and sweetest.</summary>
<parameter name="picks">[{"bottleId":51,"pairingContext":...
```

The tool call itself parsed perfectly - the picks came through, every
bottle resolved, nothing downstream had any reason to suspect a problem.
Only the prose was contaminated. That prose is written straight to
`SavedPairing.summary` and rendered on the pairing page, so a kept pairing
would have sat in the cellar with a page of raw JSON in the middle of it,
and no error anywhere to explain why.

Guarded rather than fixed, because it cannot be fixed where it happens: no
prompt makes a model perfectly incapable of this, and a rare fault that
corrupts *stored* data is worse than a common one that merely looks wrong
once. `cleanModelText` (`lib/model-text.js`) cuts at the first marker and
keeps everything before it - the prose up to that point was real. It is
applied twice on purpose: in `getSuggestions`, where the model's answer
enters the app, and inside `trimmedOrNull`, which every model-written
string passes through on its way into a pairing row. Every caller of that
helper is model text; owner-typed text (renaming a pairing) has its own
path and is untouched.

Deliberately narrow: a summary may legitimately contain `<` (a score, "<5%
ABV"), so `<` alone is not a marker - only a closing tag for one of the
tool's own field names, or the opening of a parameter block.

Verified by reproducing the exact observed string through the full flow:
not rendered on screen, and the row that reached the database held
`"Move from brightest to richest."` with the junk removed and the real
sentence intact.

**Closed 2026-09-21.** All four boundaries where a model writes prose this
app stores are now guarded, via `cleanModelFields` for the tool-result
cases:

- **Suggest** - title, summary, and each pick's reason and dish.
- **Research** - `summary` and `criticNotes`, the two longest free-text
  fields in the app, both persisted (criticNotes onto the bottle itself
  once a proposal is accepted).
- **Scan** - each wine's `note` and `criticNotes`, cleaned before the save
  loop, since a scan writes straight through with no review step.
- **Photo details** - `criticNotes`. Reading a back label is a lot of text
  to transcribe, which is the condition a run-on comes out of.
- **`trimmedOrNull`**, the last gate before a pairing row.

Only prose fields are named, deliberately: a leak is a run-on, so it lands
in whatever long field the model was writing when it went wrong. Running
this over a vintage integer would be noise, and over every string would
eventually trim a producer whose name legitimately contains an angle
bracket.

## 31. A client component imported the Anthropic SDK, and Suggest went down

Shipped 2026-09-21 and caught by the owner, not by any check here: the
whole `/suggest` page rendered its error boundary in production.

`SuggestForm.js` is a client component. It imported `lib/suggest-depth.js`
for the dial's labels, and that file imported `lib/anthropic.js` for the
two model ids - which constructs the SDK at module scope. So the SDK was
bundled into the browser and evaluated there, where it throws outright:

```
It looks like you're running in a browser-like environment.
This is disabled by default, as it risks exposing your secret
API credentials to attackers.
```

A throw at module evaluation takes the whole client chunk with it, which
is why the entire page failed rather than just the control.

**Why every local check passed.** `next build` succeeds - the import is
perfectly legal, it just has a fatal runtime consequence. `next dev` served
the page fine. Every Playwright run had been against `next dev`, where the
module graph is assembled differently, so the browser-side throw never
happened. The gap was never having loaded the app the way Vercel runs it:
`next build` followed by `next start`.

**Why this file and not the one it replaced.** `lib/effort.js`, which the
depth dial replaced, has no imports at all - its own header says it lives
apart from `app/actions.js` precisely so it can be read from anywhere. The
new file quietly gave up that property to pick up two constants, and
nothing said so.

### Fixed, and made unrepeatable

1. `lib/suggest-depth.js` is pure again - labels, hints, default,
   normalizer, no imports. The depth-to-model mapping moved to
   `lib/suggest-model.js`, which only the server reads. Same split as
   `research-job.js` / `research-dispatch.js`, for the same reason.
2. **`import "server-only"` at the top of `lib/anthropic.js` and
   `lib/prisma.js`.** This is the part that matters. It turns the mistake
   into a failed build that names the chain:
   ```
   ./lib/anthropic.js [Client Component Browser]
   ./lib/suggest-depth.js [Client Component Browser]
   ./app/components/SuggestForm.js [Client Component Browser]
   ```
   Verified by deliberately reintroducing the bad import: the build exits
   1 with exactly that message.

### Verified against a production build, not dev

Every page loaded through `next build` + `next start`: all 12 return 200
with no error boundary and no page errors, the depth control defaults to
Standard and switches to Master Sommelier, and the Anthropic SDK is gone
from `.next/static/chunks`. An audit of all 36 client components (treating
`"use server"` files as the boundary they are) found nothing else reaching
a server-only module.

**The lasting lesson is about the checks, not the import.** A whole page
was broken by a change that built cleanly and ran cleanly in dev. Anything
touching what a client component imports wants a production-build check
before it ships, and `next dev` alone cannot stand in for one.

## 32. The owner's first sign-in locked them out of the second

Shipped 2026-09-21 as part of Phase 1, caught 2026-09-22 during the
owner's actual first real sign-in in production - not by review, and not
by the test suite, because the test suite only covered the stateless
half of the decision.

`isAllowedToSignIn` (`lib/auth.js`) grants entry through exactly two
paths: an `Invite` row for the address, or an unclaimed cellar (the
bootstrap window `maySignIn` in `lib/invite-policy.js` describes). The
owner's very first sign-in goes through the second path by design - there
is no invite to have yet - and correctly claims the seeded cellar. But
claiming it is exactly what closes the bootstrap path: the cellar is no
longer unclaimed, and no invite was ever written for that address either.
The owner's *second* sign-in - later the same evening, after signing out
to verify the flow - had neither path available and came back
`AccessDenied`. The bug locks out the one person the whole feature exists
to let in, on the very next attempt.

Diagnosed live against the actual failure, not guessed: a temporary log
line in `isAllowedToSignIn` (added, used, then removed) printed
`hasInvite=false cellarUnclaimed=false allowed=false` for the owner's own
address on the second attempt, which is what pointed at the missing
invite rather than at Google, Vercel, or the database.

### Fixed, and made unrepeatable

1. **`isAllowedToSignIn` now writes an accepted `Invite` row every time it
   lets someone through with no existing invite.** A bootstrap-path pass
   leaves behind exactly the record an ordinary invited sign-in would
   already have, so every sign-in after the first behaves identically no
   matter which path the first one used.
2. **The already-locked-out account was recovered by hand**: one `INSERT`
   into `Invite` for the owner's address, run directly against production
   through the database's own query console, confirmed working before the
   code fix even deployed - the invite check itself was never broken, only
   the thing that should have populated it.
3. `scripts/invite-policy.test.mjs` gained two cases reproducing the
   sequence: the owner's real second sign-in with no invite recorded
   (correctly refused - proof the bug lived in *not persisting*, not in
   the decision function itself), and the same address with the invite
   `isAllowedToSignIn` must now leave behind (correctly allowed). The
   pure function was never wrong; nothing here could have caught the bug
   without also testing the side effect, which is what the fix adds.

**The lasting lesson:** a stateless allow/deny check and a durable record
of who has been let in are two different responsibilities, and a
"first time" path that succeeds without writing anything down will look
correct exactly once. The fix everywhere else in this app has been to
verify against a real environment rather than review the code and assume
it holds - this is the same lesson, aimed at an access-control decision
instead of a bundler mechanism.

## 33. Phase 2 of separate cellars per user — query scoping

Full writeup lives in `FUTURE_CAPABILITIES.md` under "Phase 2 - scoping,"
since it's architecture rather than a hygiene fix. Short version: before
this, every Prisma read/write in the app - roughly a hundred call sites -
had no owner filter at all, so a second real account would have seen and
could have edited the first owner's entire cellar. `lib/scoped-prisma.js`
closes that in one place, via a Prisma Client Extension, rather than
correctly repeating an owner check by hand at each site.

Caught by asking "what would actually happen if we added a second real
user" rather than by review - the same question that started this: #30's
leak was found by testing, #31's outage was found by a production build,
#32's lockout was found by a real second sign-in. This one was found by
asking the question before building anything, for once, which is cheaper
than any of the other three ways.

### A follow-up review found what the scoping pass itself missed

The extension's own design comment says `create` is safe to leave
unscoped because "every child-model create site first re-fetches the
parent it's attaching to." A security review of the diff (three findings,
independently verified before being trusted) found three call sites
where that just wasn't true: `saveTastingFlight`, `addTastingNote` and
`addBottlePhoto` each created a child row from a caller-supplied id with
no ownership check at all. `saveTastingFlight`'s gap was the worse of the
three - the flight page's own `include: { bottle: true }` then rendered
that unowned bottle in full, since a nested Prisma `include` never
re-enters the extension's interception point. All three are fixed now,
by the same pattern `addBottleToFlight` already used correctly.

Verification is worth being honest about: a fourth call site
(`deleteBottlePhoto`) was flagged alongside these by the same pass and
turned out to be a false positive on closer reading - `delete` genuinely
is one of the operations the extension scopes, unlike `create`. Left
unfixed on purpose, and noted here so "the reviewer said so" isn't
mistaken for "therefore true" the next time this file gets read.

## 34. Scan: a fourth destination, "Flight"

The owner asked for a way to land in Flights straight from a scan session
- opening several bottles for a tasting tonight, scanning each label, and
ending up on the flight rather than the cellar.

Fits alongside the existing three because it shares their shape (chosen
once for the batch, per SCAN_INTENTS in `lib/scan-intent.js`) but not
their mechanism: Cellar/Wishlist/Tasting each set a bottle's `status`
directly, and Flight can't - a flight is a separate queue of picks, not a
fourth status, and every existing flight only ever holds bottles you
actually have (`FlightPick`'s own schema comment: "you cannot open a wine
you do not have"). So "Flight" writes the same `status: "inventory"` as
Cellar and adds a second step once the batch finishes: a panel offering
to bundle everything just scanned into an existing open flight or a new
one, ending on that flight - the same choice `AddToFlight` already offers
from a single bottle's own page, scaled to a whole batch and landing on
the flight itself rather than a small inline confirmation.

What decides which saved wines are candidates for that second step is the
photo they came from, not their final status alone - `Cellar` and
`Flight` produce identical `inventory` bottles, so distinguishing them
needs to remember which picker card was selected when that photo was
read (already tracked, for retry). A card flipped to Wishlist or Tasted
on its own per-card control afterward drops out of the candidate list
either way, whatever intent it was scanned under - the same "you cannot
open a wine you do not have" rule the rest of flights already enforces.

`addBottlesToFlight` is new - the batch counterpart to the existing
single-bottle `addBottleToFlight`, deliberately not a client-side loop
over the single version. This file already has a hard-won rule about
that (see #16's photo-removal fix): a client awaiting several Server
Actions in a row is not reliable once a router refresh follows the last
one. Starting a brand-new flight from the batch reuses `saveTastingFlight`
outright (this session's own IDOR fix earlier tonight, so its ownership
check comes for free) rather than `createFlight` + an add loop.

## 35. #34's real bug, and a tasting/event label carried into notes

Two follow-ups from actually using #34, the same evening it shipped.

**The bug:** a wine scanned under the "Flight" picker still showed
"Saved to Cellar" on its own per-card control, with no way to flip it
back - because that control only ever showed the three real statuses
(Cellar/Wishlist/Tasted), and Flight isn't a fourth status. It writes the
same `status: "inventory"` as Cellar (a flight only ever queues bottles
you actually have), so the per-card picker genuinely had nothing else to
show; what it was missing was a way to say "and also queue this one,"
independent of - and after - whichever picker card was selected when the
photo was scanned.

Fixed by giving `DestinationPicker` a real fourth option instead of
inferring flight candidacy from `photo.intent` after the fact. Cellar and
Flight now write the identical `status: "inventory"` but are visually and
functionally distinct buttons, because a new `flightFlag` travels beside
`status` on every entry - set by intent when a photo is first read
(`entriesFromScanResults`/`draftEntriesFromWines`), then freely
switchable per card afterward the same way `Cellar`/`Wishlist`/`Tasted`
already were. `finishBatch`'s flight-candidate collection now reads that
flag instead of the photo's original intent, which is also the more
correct rule: a card someone actually flipped to Flight after the fact
belongs in the batch's flight offer, and one flipped away from it
shouldn't, regardless of which picker card started the photo.

**The feature:** a batch-level "Tasting or event name" field (e.g.
"Chain Bridge Mexican Wine Fiesta 9/19"), carried through to every
wine's tasting note - not stored anywhere on `Bottle` itself, since it
describes the occasion, not the wine. Threaded the same way `intent`
already was (captured per photo at read time, so changing the field
mid-batch steers only the *next* photos - see `handleFilesChange`'s own
comment on why `intent` works this way). Composed into the note text
server-side (`extractWinesFromPhoto`): with a label and the photo's own
note both present, the label goes first, a blank line, then the photo's
note; with a label and no note, the label alone is still worth a
tasting note of its own, since it's the reason the wine has anything
tasting-related to say at all. With no label typed, the original
behaviour - note only when the photo carried one - is unchanged.

`scannedNote` (what the card shows as "read from the photo") deliberately
stays untouched by this - it would otherwise misattribute the owner's own
typed event name as something the photo said. A separate line on the
card ("Tagged in the tasting note: …") confirms the label actually
landed, without conflating the two sources.

## 36. A flight isn't a fourth status

Trying #35's Flight fix in practice surfaced the actual design flaw
underneath it, described by the owner from a real wine tasting: scanning
wines poured there had them landing "in the cellar" - because "Flight"
wrote `status: "inventory"`, same as Cellar, on the reasoning that a
flight only ever queues bottles you actually have (see FlightPick in
prisma/schema.prisma: "you cannot open a wine you do not have"). That
reasoning is correct for prepping a home tasting from owned bottles, and
wrong for a wine tasted at an event and never owned at all - which still
belongs in a flight, so its note can sit alongside the rest of that
evening's lineup, but should never inflate the Cellar count.

Two things turned out to already work the way the owner wanted, once
looked at closely:

- **A flight built from bottles you already own, prepped ahead of
  hosting it** - already exactly right. `addBottleToFlight`/
  `addBottlesToFlight` never touch a bottle's status; it stays in the
  Cellar, visible in both places, until its own pick is marked tasted on
  the flight page (which runs the same inventory-decrement as the bottle
  page's "Tasted one" button). No change needed.
- **A flight staying "live" until you're done with it** - also already
  true, via `isOpenFlight()` (lib/flights.js): a flight counts as open
  while any pick is untasted, and reads as "a record now, not a queue"
  only once every pick has been marked tasted. There's no "complete
  flight" button because none is needed.

The actual fix: "add to a flight" is no longer a fourth, mutually
exclusive destination sharing Cellar's status. It's a separate checkbox
(`flightIntent` for the batch default, `flightFlag` per card) that
combines with any of the three real statuses - Cellar, Wishlist, or
Tasted. `DestinationPicker` now renders the three status radios plus this
checkbox below them; the top-of-page intent picker got the same
treatment (3 tiles + a separate "Also queue these for a flight" toggle,
both the full grid and the compact strip). `finishBatch`'s
flight-candidate collection dropped its `status === "inventory"` filter
accordingly - any status now qualifies.

Bottles scanned straight to Tasted (an event, never owned) and flagged
for a flight needed one more piece: their `FlightPick` should start
already consumed, not "still to pour" - the wine was tasted before it
ever joined the flight. `addBottleToFlight`, `addBottlesToFlight`, and
`saveTastingFlight` now seed `consumed` from the bottle's actual status
at add-time. That alone wasn't quite enough, though: a bottle that
started as ordinary Cellar inventory and got poured *through* the flight
also ends up `consumed: true` - and `unmarkFlightPickConsumed`'s Undo
calls `undoOneTasted`, which would happily call `setBottleStatus(id,
"inventory")` on a bottle that was never inventory to begin with,
handing back Cellar ownership of a wine nobody ever owned. The two cases
are indistinguishable from `consumed` alone once it's true, so
`FlightPick` gained its own column, `startedConsumed`, set once at
creation and never touched again - `unmarkFlightPickConsumed` refuses to
run when it's set, and `FlightPicksList` hides the Undo button in favor
of a plain "Already tasted when scanned — never in your cellar" line for
those picks. Migration:
`prisma/migrations/20260926000000_flight_pick_started_consumed`.

## 37. #36's checkbox didn't survive contact with the owner

Shipped #36, described it back, and got direct pushback the same evening:
*"I don't love it as another checkbox from a UX standpoint. I'd rather it
be a status option that isn't connected to 'Cellar'."* Right on both
counts, and the second one is the sharper of the two - a checkbox riding
on top of a status a wine didn't actually have is the same bug #36 itself
was written to fix, just relocated from "shares Cellar's status" to
"shares whichever status the checkbox rides on." Hiding "this is a flight
wine" behind a flag on a shared status was never the real problem; the
checkbox was only ever a symptom of it.

The fix this time is the one #36 talked itself out of: `Bottle.status`
gained a real fourth value, `"flight"` - not `"inventory"`, not
`"consumed"`, its own thing. A wine poured at a tasting was never bought,
so it needed a status that says exactly that, the same way `"wishlist"`
already says "not owned yet." `DestinationPicker` and the top-of-page
intent picker both went back to a single row of mutually-exclusive
options - four now, Cellar/Wishlist/Tasted/Flight - and every bit of
`flightFlag`/`flightIntent`/`saveFlight` client-side bookkeeping the
checkbox needed came back out, because "is this a flight wine" is now
just `bottle.status === "flight"`. Read as fully as it looks: nothing
rides on anything else's status anymore.

Scope question worth recording: a flight-status bottle has no list page
of its own (no fourth `/flight` index alongside `/inventory`,
`/wishlist`, `/consumed`) - deliberately, on the owner's own choice
between the two options put to them. Its only home in the app is the
flight it belongs to, which is why `PendingFlightPanel`'s "Skip" option
is gone: skipping isn't leaving a wine in the Cellar anymore, it's
orphaning a bottle with genuinely nowhere else to be seen (still in
`/export`, still reachable by direct link, just off every list). Each
wine saved under Flight is saved immediately (same as every other scan
destination), so if a batch is abandoned before `PendingFlightPanel`
resolves - the tab closes, the browser crashes - those bottles sit at
status `"flight"` unlinked to any `TastingFlight` until someone finds
them another way. Accepted, not fixed: the alternative (a real list page,
its own nav entry) was the larger of the two scopes on offer, and this
was explicitly the smaller one.

`markFlightPickConsumed`/`unmarkFlightPickConsumed` needed the same
branch #36's `startedConsumed` was reaching for, but the real status
makes it exact instead of a flag: a flight-only pick graduates straight
from `"flight"` to `"consumed"` (no Cellar quantity to draw down, since
there wasn't any), and Undo reverses it straight back to `"flight"` -
never to `"inventory"`, which is what makes Undo safe to leave
unconditional again (FlightPicksList's hidden-button special case from
#36 is gone; there's nothing left to hide it from). `FlightPick` traded
`startedConsumed` for `originFlightOnly`, recording which of the two a
pick came from so both directions know where to land - set once at
creation, same as its predecessor, in a new migration
(`prisma/migrations/20260926010000_flight_pick_origin_flight_only`)
rather than editing #36's, since that one may already have run
somewhere.

## 38. #37's accepted edge case, on the very first real batch

Scanned 7 wines under "Flight" for a real tasting ("Chain Bridge 9/26"),
typed that into the batch's own "Tasting or event name" field, and
never saw a flight afterward. Not a bug in the sense of broken code -
walked through it with the owner and confirmed exactly the sequence #37
called out as an accepted risk: the purple "these wines need a flight"
panel did appear, but nothing was typed into its own, separate "Theme
name" field before leaving the page. The wines are fine (`status:
"flight"`, sitting there correctly) - there was just nowhere left in the
UI to find and finish linking them, since #36's "just the flight
itself" scope deliberately didn't build one.

Two fixes, one for right now and one for next time:

- `FlightBottlePicker`'s candidate query (on any flight's own page)
  widened from `status: "inventory"` to `status: { in: ["inventory",
  "flight"] }`. This is the recovery path #37 didn't build: open any
  flight (or start a new one), search for the 7 wines by name in "Add a
  bottle", and they're right there to add by hand. Wording in that
  component softened from "your cellar" to "your bottles" so it stops
  overclaiming now that a flight-only wine can show up in it too.
- The real root cause: two separate name fields that looked like one.
  The event-name field feeds tasting notes only, and always has; the
  flight's actual name is a second, blank input inside the purple panel,
  and typing the first was never going to fill in the second by itself.
  `PendingFlightPanel` now prefills its "Theme name" input from whichever
  flight candidate carried an event label, so typing "Chain Bridge 9/26"
  once, the way the field's own placeholder suggests, now also becomes
  the flight's name by default - still editable, just no longer a second
  decision nobody was told to make.

## 39. The design/UX review backlog, cleared out in one pass

Asked to work through the design/UX review items (#9, #16, #17, #20,
#28, #29) rather than one at a time - everything below was "cheap and
ready", with no open design question blocking it, which is what made
doing all seven in one sitting reasonable. The three items still blocked
on a real decision (`/consumed`'s shape, "Drink tonight"'s shape, #9's
two measurement questions) are untouched; they're recorded where they
already were, not here.

- **Region implies country** (#17). `lib/regions.js`'s comment-grouped
  regions became real data (`REGIONS_BY_COUNTRY`, with `countryForRegion`
  reading it case-insensitively); `BottleForm` fills Country in from a
  known Region while Country is still blank, and shows a soft "Bordeaux
  is usually France" note rather than blocking a genuine mismatch. Two
  groups a human would've kept together got split on the way in -
  Austria/Hungary out of "Germany", Argentina out of "South America" -
  since a loose heading isn't the same claim as the data underneath it.
- **Research's status badges** (#17). `lib/status-look.js` (icon + accent
  per status) and `StatusBadge.js` (the small pill built from it) replace
  bare `{bottle.status}` text in Research's two lists and on the bottle
  page - the "one source rather than three" the finding asked for.
  Deliberately additive: Scan's and the home page's own existing icon/
  accent definitions were left alone rather than folded in too, since
  neither was flagged as wrong and both still work.
- **One progress bar** (#17). `ProgressBar.js` replaces the near-identical
  markup Scan and `/estimate-windows` each drew by hand; Research's own
  bar moved onto it too, with its multi-state coloring and taller, slower
  animation kept as props rather than smoothed away - a real difference
  in what that bar means, not drift to erase.
- **A real "Tasted one" on the cellar row** (#29 finding 3). The expanded
  row now renders `TastedControls` - the same component, not a second
  implementation - whenever status is `inventory`; the quantity stepper
  is relabelled "Correct the count" so it stops reading like the same
  question.
- **Research's diff table on narrow screens** (#29 finding 5). Stacked
  per field (label, then "Now: …" / "Proposed: …") below `sm:`, where the
  three-column table's own 480px minimum used to leave the "Proposed"
  column - the actual point of the screen - starting off a phone's
  ~311px. The table itself is unchanged at `sm:` and up.
- **The guest heart and sign-in copy** (#29 finding 8). The heart is a
  real button now (`useTransition`, dimmed and disabled while in flight,
  a 44px target instead of ~20px) rather than a bare form submit with no
  feedback at all. Both guest screens - before and after entering a name
  - now say whose cellar is being browsed and that the owner sees the
  guest's name next to what they favorite.
- **Polish** (#29). Desktop `NavLinks.js` reordered to match the phone
  tab bar's first five exactly, with the three phone-bar-only-via-home-
  card extras (Wishlist, Flights, Tasting notes) appended after rather
  than interleaved; `pairings/page.js`'s stale "not in the nav" comment
  rewritten. `Bought it` moved into `TastedControls` (it was the one
  status button left as a plain form with no pending state) so a shared
  `Spinner` now covers all of the bottle page's status buttons. `/research`
  queue's `Research`/`Dismiss` buttons are real 44px targets; `Dismiss`
  deliberately stayed unconfirmed, since at that stage no proposal exists
  yet to lose - `ResearchProposalCard`'s own "Discard this research"
  already confirms the version of this that does risk something. README's
  stale "six cards" became eight (plus the export link, not a ninth card)
  with Pairings and Research added to the counted-card list; both README
  and `PROJECT.md` had their "pairings are ephemeral, never saved" claims
  corrected to describe `/pairings` and "Save this pairing", which shipped
  in #41 and has been true since.

## 40. The three remaining open questions, decided and built

The three items #39 left alone because they were genuinely blocked on a
decision, not on effort - `/consumed`'s shape, "Drink tonight"'s shape,
and #9's two measurement questions. Put to the owner directly rather
than guessed at, since each was recorded as exactly that kind of
question when it was first raised.

**`/consumed` stays a list of wines, not a list of notes** (#17's branch
question). Chosen specifically to keep this page on the same instant,
client-side filtering every other list already uses (BACKLOG #19) - a
note-first rebuild would have meant a new query shape and a new list
component just for this one page, diverging from how every other list
in the app works. That decision also settled the second half of the
same finding, the broken search: `getBottles`'s `withLatestNote` option
now also loads every note's text for this page's bottles into a
search-only field (`noteSearchText` in `lib/bottles.js`, folded into
`searchableText()` in `lib/filter-bottles.js`) - a second, non-`distinct`
query alongside the existing latest-note one, since Prisma's client only
ever hands back the deduped rows once `distinct` is applied. Never
rendered - the row still shows just the latest note - so a word from an
*older* note now matches without shipping every note to every list
(Cellar, Wishlist still carry none at all) or paying a round-trip per
keystroke.

**"Drink tonight" is a real state, on the whole pairing, cleared by
hand** (#28 findings 3-4). `SavedPairing.plannedForTonight` (migration
`20260928000000_pairing_planned_for_tonight`), set by
`markPairingForTonight` and cleared only by `clearPairingForTonight` -
nothing in the app ever flips it on its own, deliberately: an auto-clear
tied to every pick's note being logged risks staying silently stuck on
if one course's wine never gets written up, which is worse than one more
tap. Whole pairing rather than one pick within it, since a multi-course
menu is "tonight's" as a unit even worked through course by course; more
than one pairing can be marked at once on purpose, since a real evening
can be an aperitif pairing and a dinner pairing both, and forcing a
single choice would just make marking the second one silently un-mark
the first. Surfaces in the three places #28 left open: a "Tonight" badge
on `/pairings` (sorted first) and on the pairing's own page, a "Drink
tonight"/"Done for tonight" toggle on that page, and the home page's
Pairings card swapping its description from "Kept" to "N tonight" - the
count shown stays every kept pairing, unchanged.

**#9's two measurement questions stay deferred**, on the owner's call -
no live API key in this sandbox to A/B against, and timing
instrumentation was offered and declined for now. Revisit if scan/
estimate quality or speed ever feels like an active problem, or once a
key is available here to test with directly.

## 41. Flight status: a real data bug found by review, plus two stale strings

A `data-engineer` review of the #34-#38 Flight-status redesign (asked for
after the backlog recap above) confirmed the 4-value `Bottle.status`
change is solid everywhere ownership is queried, and found one real bug:

**`markFlightPickConsumed`'s `originFlightOnly` branch could silently
overwrite a true `emptiedAt` date.** It hardcoded
`emptiedAtForStatus("consumed", null)` instead of reading the bottle's
actual current `emptiedAt` - invisible on an ordinary single-flight
graduation (the bottle really was null beforehand), but nothing stops the
same flight-only bottle from being added to two open flights at once
(the duplicate check in `addBottleToFlight` is scoped per-flight, not
across flights). Mark it tasted in the first flight (correctly stamps
today), then later mark the second flight's pick for the same bottle
tasted: the guard on `pick.consumed` is per-pick, not per-bottle, so this
ran again and reset the date to whatever day the second flight got around
to it - discarding the true one with no edit that looked like an edit.
Fixed by selecting the bottle's real `emptiedAt` first and passing it
through, the same pattern `markOneTasted` already uses.

Also fixed, both stale copy left over from before flight-only bottles
existed: `FlightPicksList`'s "Remove from flight" confirm always said "It
stays in your cellar" (untrue for an `originFlightOnly` pick - removing
one leaves it exactly as unlinked as #37/#38's accepted edge case, just
via a second path nobody had named), and `FlightBottlePicker`'s empty
state still said "Nothing in your cellar matches that" a session after
its placeholder and aria-label were reworded to "your bottles" for the
same reason.

A companion `ux-critic` review of the same flows (Flight status, Drink
tonight, the Scan destination picker) came back the same evening with a
longer list - most notably that flight-only wines can be stranded through
several everyday paths beyond the one #38 already named. Acted on the
same evening; see #42.

## 42. The ux-critic findings from #41, built

Every finding from #41's companion review, in the order the review itself
ranked them.

**Breaks the task:**

- **Four ordinary moves on the Scan page silently stranded a flight
  wine, beyond the one #38 already named.** The finished-batch box's own
  "N in Flight →" link went to `/flights`, where an unresolved batch's
  wines aren't yet - it's plain text now ("N waiting for a flight ↓")
  while the panel below is still unresolved. Scanning a second round of
  photos before resolving the first Done silently replaced the pending
  panel's candidates instead of adding to them - `finishBatch` now merges.
  Done's own help text claimed "this just puts the page away" even with a
  required next step still open - conditional now
  ("Next: choose a flight for the wines waiting on one."). The
  leave-page warning covered unsaved edits but not an unresolved panel -
  it does now.
- **Nothing anywhere said a flight-only wine was stranded, and its own
  page couldn't fix it.** `/flights` gets a "waiting for a flight" panel
  (`OrphanedFlightBottles.js`, sharing the same picker ScanPanel shows
  right after a batch finishes, via a new `FlightLinkPanel.js`) for
  whatever an earlier, abandoned batch left unresolved. The home Flights
  card's description swaps to "N unfiled" while any exist. The bottle
  page's own "Add to a tasting" control - the recovery path itself - was
  restricted to `status === "inventory"`, hiding it from the one status
  that most needed it; widened to include `"flight"`, and once a
  flight-only bottle is actually linked, the page names which flight
  instead of still offering to add it again. `FlightBottlePicker`'s
  search puts flight-only bottles first and badges them, rather than
  burying one past the 12-row cap in an unfiltered cellar.
- **Three confirmations promised the opposite of what would actually
  happen** for a flight-only wine: "Remove from flight" and "Delete
  flight" both claimed the bottle "stays in your cellar" (fixed in #41
  and here respectively - the flight delete now names how many picks were
  never in the cellar at all), and a scan card's own delete confirm made
  the same claim for a card whose status was "flight".

**Costs the user:**

- **The flight-linking panel's own controls were the smallest and least
  guarded on the page** - existing-flight buttons at ~20px with no
  confirm on a one-tap "add all N and leave the page" action, 14px text
  triggering iOS zoom-on-focus. `FlightLinkPanel.js` (and `AddToFlight.js`,
  named alongside it) now use 44px controls throughout, 16px inputs, and
  a real confirm on the one-tap add.
- **The tile grid's one distinguishing fact about Flight lived only in a
  hover tooltip**, which a phone never shows. The same hint text now
  renders as a line under the grid, live as the selection changes.

**Polish:**

- **The "Tonight" badge was amber**, the same color already meaning
  "needs a check" (Needs research, unsaved) and Wishlist elsewhere in the
  app. Both pairings pages now use teal, matching the Pairings home
  card's own accent.
- **A flight pick's collapsed row didn't say which wines were
  flight-only**, where "Tasted" means something different for them
  (straight to Tasted vs. a real Cellar decrement) - the violet
  `StatusBadge` now shows on `originFlightOnly` picks. Undo was a bare
  text link under 44px; it's a real button now.

**Also decided and built, from the review's other section (Drink
tonight):** `plannedForTonight` never cleared itself, so the label kept
saying "Tonight" for a pairing marked weeks ago (the manual-clear
decision from #40 is unchanged - only the label's honesty). A new
`plannedForTonightAt` timestamp (migration
`20260928010000_pairing_planned_for_tonight_at`) lets `tonightLabel()`
(`lib/pairings.js`) say "Planned Sep 3 — done?" once the marked day has
passed. `TonightToggle.js` replaces the plain, pending-state-free toggle
forms on both pairings pages with a real button (Spinner, 44px) and adds
the same toggle to the list row itself, so clearing a stale one doesn't
require opening the pairing first. The toggle moved below the wines on
the detail page - the evening ends there, not at the top. A planned
pairing's wine links now carry the same `?pairedWith=` note prefill
Suggest's own result gives the same wine, shown as a separate "Add a
tasting note →" link. The home Pairings card links straight to the one
pairing when exactly one is planned for tonight, rather than to the
whole list.

**The review's closing "tradeoff" (not one of its numbered findings),
put to the owner directly:** whether a wine scanned under Flight should
start already tasted rather than left-to-taste, for the workflow where
wines are scanned *as* they're poured rather than from a sheet
beforehand. **Decided: leave it as-is** - left-to-taste stays the
default, on the reasoning that a tasting sheet scanned ahead of pouring
(the flight becomes the evening's checklist) is the more common shape,
and nothing here builds toward the other case. Revisit if scanning wines
one at a time as they're poured turns out to be the more common real
pattern.

Also not touched: Suggest's own "a flight is a queue of bottles you can
open" line, which the review flagged as dated wording but which is still
literally true in the one context it appears (a gap pick with no
`Bottle` row at all, genuinely distinct from a flight-only bottle that
has one).

`app/components/FlightLinkPanel.js`, `OrphanedFlightBottles.js`,
`TonightToggle.js`, `app/(owner)/flights/page.js`,
`app/(owner)/bottles/[id]/page.js`, `app/(owner)/page.js`,
`app/(owner)/pairings/page.js`, `app/(owner)/pairings/[id]/page.js`,
`lib/pairings.js`, `app/actions.js`.

## 43. A visual pass caught what code review couldn't - and a real data-loss bug behind it

`ux-critic` reads JSX and Tailwind classes; it never renders the app. Asked
whether that leaves a gap for design simplicity specifically, the answer
was yes - so this stood up a local Postgres, seeded a realistic ~23-bottle
cellar (every status, two flights, two pairings, a research proposal), and
screenshotted all 14 screens at 375px with a real browser. Most of the app
held up well. Two things didn't.

**The bottle detail page opened onto a permanently-expanded 14-field
form**, every single visit, before Tasting notes, Photos or Research -
regardless of whether the reason for being there was to check a drinking
window (already visible above, in the header) or add a two-second note.
This is the exact defect BACKLOG #16 diagnosed and fixed on Scan cards
("every card was a full 14-field form"); that fix never reached the one
page every other screen in the app actually links to. Fixed the same way:
`Details` is a `<details>` disclosure now, closed by default, with the
same disclosure-triangle affordance Scan's own "Edit details" uses.
Nothing above it changes - status, drinking window, and the Tasted/Delete/
Add-to-a-tasting buttons were already there.

**The Research diff table's rendering revealed a genuine data-loss bug in
the accept path, not just a display glitch.** Seeding a proposal with only
3 of 12 fields (an incomplete fixture, not realistic production data) made
`researchChanges()` (`lib/research-fields.js`) show all 9 untouched fields
as being wiped to "not set" - because it read a field *missing* from the
proposal's JSON the same as one explicitly proposed as blank. Chasing why
led to `applyResearchProposal` in `app/actions.js`, which does the
identical thing on write: `data[key] = proposal.proposed[key] ?? null`
for every `RESEARCH_FIELDS` key, whether or not the proposal actually has
an opinion on it. Today `RESEARCH_TOOL`'s schema is `strict: true` with
every field `required`, so this can't currently happen - but the code was
one schema change or model hiccup away from silently blanking real bottle
data on an "Accept" click, and the diff table would have shown exactly
this scenario as normal before you ever clicked it. Both fixed the same
way: a field absent from `proposed` now means "no opinion", not "propose
clearing it" - `key in proposed`, not just truthiness. Verified by
re-seeding the same incomplete proposal against the fix: the diff table
correctly showed 1 real change (the field that actually differed) instead
of 9 phantom ones, and accepting it left the other 8 fields' real values
untouched in the database.

Also verified, not touched: the Scan destination tiles, the Drink Tonight
badge/toggle, and the Cellar list's control stack were all already correct
- the last of those confirmed to be at the exact height BACKLOG #17
measured and tuned it to, not a fresh problem.

`app/(owner)/bottles/[id]/page.js`, `lib/research-fields.js`,
`app/actions.js`.

## 44. "Name your Domaine"

The first real touchpoint for the "Domaine"/"Cellarmaster" nomenclature
FUTURE_CAPABILITIES.md settled on - the estate's own name (e.g. "Rucker
Family Cellar"), as distinct from the person's own `name`. `User` gains
`domaineName String?` (nullable - naming an estate is optional, and every
existing row predates this), settable from a new section at the top of
`/invites` via `setDomaineName` (`app/(owner)/invites/actions.js`), always
writing the signed-in account's own row via `currentOwnerId()` rather
than taking an id - there's nothing here for one account to point at
another's row with, unlike the invite-door actions beside it which
already act globally because the door itself is shared. Blank clears it
back to unset rather than storing an empty string.

Shown on the Guest sign-in and landing screens
(`app/(guest)/guest/page.js`), which previously always said "browsing
{owner name}'s cellar" - now "browsing {Domaine name}" when one is set,
falling back to the exact previous wording otherwise. Deliberately kept
separate from who sees a guest's favorites: that sentence still names the
actual person, since an estate name can't see anything - only "whose
cellar is this" reads the Domaine name, not "who will see your pick."

Also shown per-row in `/invites`' own Accounts list, since - per the
original "Separate cellars per user" decision, "fully separate cellars...
no household/shared-bottle concept" - every account is already its own
fully separate estate today, so two rows there can correctly carry two
different Domaine names.

Schema comment on `User.domaineName` records why this lives on `User`
rather than a real `Domaine` table (which doesn't exist yet - see
FUTURE_CAPABILITIES.md): every User's cellar is already its own Domaine of
one Cellarmaster as built, so a per-User column is correct for what
exists today, with the column needing to move to a real `Domaine` table
if Shared Cellars is ever built - the same kind of staged migration
`ownerId` itself already went through.

Verified with lint, a production build, and a local Postgres instance
(no live database in this sandbox otherwise): the field saves and
survives redisplay on `/invites`, and both guest screens correctly pick
up the new name while keeping the person's own name for who sees a
favorite.

## 45. A motto for your Domaine

`User.domaineMotto` (nullable String, same reasoning as `domaineName` in
#44) joins the same form on `/invites` rather than getting a second one -
`setDomaineName` renamed to `setDomaineDetails` since one form now saves
two fields together, still writing only the signed-in account's own row.
Shown wherever the Domaine name already is (both Guest screens, and
`/invites`' own Accounts list), always alongside the name and never on
its own - a tagline with nothing to sit under wouldn't mean anything, so
the page's own copy says so and the Accounts list only ever renders the
motto nested inside the "if a name is set" branch.

Verified with lint, a production build, and the same local-Postgres round
trip #44 used: both fields save together, and the guest sign-in and
landing screens correctly render "browsing Rucker Family Cellar —
'Life's too short for bad wine'" with the motto italicized and quoted.

## 46. "✓ Saved" on the Domaine form

The plain `<form action={setDomaineDetails}>` from #44/#45 had no way to
say a save worked short of a full page reload - the same gap `InviteForm`
(this page's own sibling form) already solved. `setDomaineDetails` gained
the `(prevState, formData)` signature `useActionState` needs and now
returns `{ success: true }`; a new `DomaineDetailsForm.js` client
component wraps it, matching `InviteForm.js`'s exact shape - a disabled/
"Saving…" button while pending, a green `role="status"` "✓ Saved" line
once it resolves. No fade-out timer, deliberately: `InviteForm`'s own
confirmation doesn't get one either, so this stays consistent with the
one other form on this page rather than picking its own convention.

Verified with lint, a production build, and the same local-Postgres round
trip: both fields save and "✓ Saved" appears immediately after.

## 47. Multiple Users per Domaine — Phase 0

The schema half of FUTURE_CAPABILITIES.md's "Shared cellars" entry - a
real `Domaine` model, `User.domaineId`/`role` (both NOT NULL, one Domaine
per User, no join table). Nothing reads either column for scoping yet:
`Bottle`/`TastingFlight`/`SavedPairing`'s own `ownerId` still points at
`User` directly, and `lib/scoped-prisma.js` is untouched - deliberately a
later phase, staged the same way the original ownership work itself was.

The backfill is the part worth being careful about: one new Domaine per
*existing* User, never merging two people's already-separate cellars
into one. `domaineName`/`domaineMotto` (#44/#45) moved off `User` onto
the new `Domaine.name`/`motto` in the same migration, which meant
updating the four places that read/wrote them - required to keep the app
buildable, not extra scope. A new `currentDomaineId()` (`lib/owner.js`)
is the seam this phase adds, mirroring `currentOwnerId()`'s own
uncached-on-purpose reasoning.

Verified against a real backfill scenario, not an empty database: seeded
a pre-existing named Domaine the way an already-migrated production
database would have it, ran the migration, and confirmed the name/motto
landed on the new `Domaine` row correctly, `domaineId`/`role` backfilled,
the migration's own scratch correlation column was gone afterward, and
both `/invites` and `/guest` rendered exactly as before. Also confirmed
lint and a production build clean, and that `Bottle`/`TastingFlight`/
`SavedPairing`'s foreign keys are untouched.

`prisma/schema.prisma`, `prisma/migrations/20260928040000_domaine_and_membership/`,
`lib/owner.js`, `app/(owner)/invites/actions.js`,
`app/(owner)/invites/page.js`, `app/(guest)/guest/page.js`.

## 48. Multiple Users per Domaine — Phase 1

The Domaine now owns the cellar: `Bottle`/`TastingFlight`/`SavedPairing`/
`ResearchJob` carry `domaineId` and `lib/scoped-prisma.js` scopes by it,
so a Domaine's members share one cellar. Invites carry `access`
(Cellarmaster, Guest, or their own Domaine) and the Domaine that sent
them; `createUser` places each new account accordingly - which also fixed
a Phase 0 bug where any new invited sign-in would have failed on the
NOT NULL `domaineId`. Guest-role members are refused by the data layer
itself (not just the layout redirect), browse and favorite at `/guest`
through a `Guest` row linked to their account, and can sign out from
there. `ownerId` on the roots is now attribution only (nullable,
`SET NULL`), so removing a member can't take the shared cellar with them.
Full write-up, verification and what's still open: FUTURE_CAPABILITIES.md,
"Shared cellars", Phase 1.

`prisma/schema.prisma`, `prisma/migrations/20260928050000_domaine_owns_the_cellar/`,
`lib/scoped-prisma.js`, `lib/owner.js`, `lib/auth.js`, `lib/guest.js`,
`lib/invite-access.js`, `lib/bottles.js`, `app/actions.js`,
`app/(owner)/layout.js`, `app/(owner)/invites/`, `app/(owner)/export/route.js`,
`app/(owner)/research/page.js`, the four other owner list/detail pages,
`app/(guest)/guest/page.js`, `app/components/InviteForm.js`.

## 49. Change a member's role, or remove them

On `/invites`' Members list: "Make Guest"/"Make Cellarmaster" and
"Remove" on every row but your own, each behind a confirm that says what
will happen (`ConfirmButton` gained a neutral `tone` for the role change,
which isn't destructive). `changeMemberRole` and `removeMember` in
`app/(owner)/invites/actions.js` are scoped to your own Domaine and
exclude you in the query itself - so a Domaine can never lose its last
Cellarmaster. Removal deletes the account and its invite together, so
the person is signed out at once and can't simply sign back in; what
they added stays in the cellar. Details and verification:
FUTURE_CAPABILITIES.md, "Shared cellars", Phase 1.

## 50. An in-app page for a refused sign-in

A refused or failed sign-in used to land on Auth.js's own generic page,
served from @auth/core outside this app - or, from the email form, on the
app's crash screen ("That didn't work… trying again is worth a shot"),
because Auth.js's server-side `signIn()` *throws* a refusal rather than
redirecting, and nothing caught it. The "hasn't been invited" message on
`/signin` itself never actually showed: Auth.js routes AccessDenied to its
error page, not back to sign-in.

Now `pages.error` is `/signin/error`, which explains the three cases in
words: an address that can't sign in (never invited, or removed - kept
deliberately indistinguishable, so the page doesn't tell a stranger who
was once on the list), an expired or used link, and anything else
("something went wrong on our side" - e.g. a bad email-provider key).
The sign-in actions catch `AuthError` and redirect exactly where Auth.js
would (sign-in-step errors to `/signin?error=`, the rest to
`/signin/error`). `/signin`'s own alert now covers the one sign-in-step
error worth naming - an address already linked to the other door.

Verified with accounts on: an uninvited address via the real form, a
removed member's link, an expired link and a bad email key each land on
the right message; `npm run verify` covers the new page (16 pages).

`app/signin/error/page.js`, `app/signin/actions.js`, `app/signin/page.js`,
`lib/auth.js`, `scripts/smoke.mjs`.

## 51. Retire the anonymous guest link

The owner's call, once invited Guests existed: `/guest` is no longer a
URL anyone can open by typing a name. It's where a signed-in Guest
member browses and favorites, and nobody else - a signed-out visitor is
sent to `/signin`, a Cellarmaster to the app itself, and with accounts
switched off the page says guest browsing needs an invite (there being
nobody to invite yet).

Gone with it: the name form, "Not you?", the `guestId` cookie and the
two actions behind them (`enterAsGuest`, `switchGuest`),
`anonymousGuestDomaineId`, the Cellar's "Guest link" share chip (now an
"Invite a guest" link to `/invites`, shown once accounts are on), and
the "you don't need an account" lines on `/signin` and `/signin/error`.
Cookie guests' existing `Guest` rows and favorites were deliberately
left in place, so names already shown next to a favorite still show;
nothing can add to them.

Verified with accounts on - signed-out visitor bounced to `/signin`,
Guest member browsing and favoriting, Cellarmaster sent to `/`, the new
invite link reaching `/invites` - and `npm run verify` clean in both
modes, with the smoke test now treating `/guest` as a signed-in page.

`lib/guest.js`, `lib/owner.js`, `app/actions.js`,
`app/(guest)/guest/page.js`, `app/(owner)/inventory/page.js`,
`app/components/GuestLinkButton.js` (deleted), `app/signin/page.js`,
`app/signin/error/page.js`, `lib/scoped-prisma.js`, `scripts/smoke.mjs`,
README.md, PROJECT.md, FUTURE_CAPABILITIES.md.

## 52. Vercel's "Function Storage" limit: fewer deployments, smaller ones

Vercel emailed that the Hobby team had used 100% of its 10 GB of
Function Storage - the combined size of the server function bundles of
every deployment it retains. Not traffic: every push to every branch
made a preview deployment, all of them kept, each carrying a bundle
dominated by an image library nothing here uses. Two changes:

- **Only two branches deploy** (`vercel.json`): `"**": false` switches
  every branch off - `**` rather than `*` so names with a slash, like
  every `claude/...` branch, are covered - and the two `true` rules turn
  back on `claude/great-meitner-j2tbow` and `main`. The first matters
  most: it is the repo's default branch and where production builds from
  (`main` is 207 commits behind it), so a blanket "no `claude/*`" rule,
  the first idea, would have stopped production deploying at all. Vercel
  deploys a branch if any rule matching it is `true`.
- **`sharp` is left out of every server bundle** (`next.config.mjs`,
  `outputFileTracingExcludes`). It was ~47 of ~63 MB of traced files per
  deployment - two Linux builds of libvips plus a wasm fallback - for
  Next's image optimizer, which this app never calls: photos are plain
  `<img>` from Blob, and the icons use `next/og`, which doesn't use it.
  Measured after: 15.1 MB of traced files, 0 of 26 traces referencing
  it; `/icon` and `/apple-icon` still render; `npm run verify` clean.

Not done here, and the owner's to do in the Vercel dashboard: deleting
the preview deployments already retained, and a retention policy so old
ones expire on their own. Community reports say the storage figure can
lag hours after deletions on Hobby.

`vercel.json` (new), `next.config.mjs`, README.md.

## 53. The ux-critic's review of the sharing flows, all eight findings built

Ran `ux-critic` over everything built for shared Domaines (#47-#52) and
built every finding:

1. **"Invite a guest" made the friend a Cellarmaster.** The form
   preselected Cellarmaster, so the Cellar page's "Invite a guest" ->
   type an email -> Invite gave a friend full edit access. Now nothing is
   preselected unless the link asks (`/invites?access=guest`, which the
   Cellar link uses); an unchosen form is refused in place.
2. **A role change left its confirm open, offering the reverse.** After
   "Yes, make Guest" the same box re-armed as "Yes, make Cellarmaster" -
   it looked like nothing had happened, inviting the tap that undid it.
   `ConfirmButton` gained `doneMessage`: the box closes when the action
   finishes and says what happened ("Sam is now a Guest."). Its confirm
   button now shows "Working…" and stops taking taps while the action
   runs, and Cancel is a real 44px button - both for every caller.
3. **Inviting someone sends nothing, but said they were all set.** The
   success message now says Cellarmaster doesn't send anything, and a
   Share button (new `ShareInviteButton`) drafts the message - share
   sheet on a phone, clipboard elsewhere - with the sign-in link and
   their address. Also on every "Waiting to sign in" row, for nudging.
4. **No way to People or Sign out on a phone.** Both lived only in the
   desktop header. Home gained "People & Domaine ->" and "Sign out" in
   the export link's quiet style (phone only); the desktop link is now
   "People", shown even with accounts off.
5. **/invites opened on its least-used part.** Retitled "People";
   reordered invite -> waiting -> members -> separate cellars -> Domaine
   name; the long paragraphs became one line each; the name and motto
   boxes got visible labels and 44px height. Dropped the now-false "what
   an invite gives them is settled at first sign-in".
6. **The same person appeared twice, with the weaker control first.**
   Used invites no longer list (Members covers those people, and Remove
   is what actually takes access away) - which also retired the "You"
   row and the bootstrap invite's system note. Used "separate cellar"
   invites get their own list, "Has their own cellar", whose Revoke now
   says plainly that it locks them out of their own cellar.
7. **"Cellarmaster" meant three things.** The guest header shows the
   cellar's name, not the app's; sign-in says "Sign in with the address
   you were invited with"; "A separate cellar of their own" sits below
   an "Or, not sharing" divider rather than as a third role; the error
   page lost the stale "guests included" and gained a line about picking
   the right Google account. One rule for the cellar's display name now
   lives in `lib/cellar-name.js`.
8. **A guest's first visit.** "Welcome" rather than "Hi, sam@gmail.com";
   the invite's "Who is this?" note, not the email, is the name the
   Cellarmasters see beside a guest's favorites; a drawn, visible heart
   instead of the 🤍 emoji; Sign out as a real button; "the people who run
   this cellar can see your name"; and a "My favorites (n)" filter.

Verified with accounts on in a production build, 26 checks covering each
finding end to end (including the role change actually happening once,
the drafted share text, and the guest's favorites filter), screenshots
at 375px, and `npm run verify` clean with accounts on and off.

`app/components/{ConfirmButton,InviteForm,DomaineDetailsForm,ShareInviteButton,GuestBottleList}.js`,
`app/(owner)/invites/{page,actions}.js`, `app/(owner)/{page,layout}.js`,
`app/(owner)/inventory/page.js`, `app/(guest)/{layout,guest/page}.js`,
`app/signin/page.js`, `app/signin/error/page.js`, `lib/guest.js`,
`lib/cellar-name.js` (new), `lib/invite-access.js`, README.md.

## 54. Usage limits per Domaine

The first of the Phase 3 plan in FUTURE_CAPABILITIES.md, built as decided:
counted per Domaine, and a Domaine over its monthly cap moves to a
lighter model rather than being blocked, with a higher hard stop above
that for runaway use. The app owner sets every other Domaine's limits.

- **The ledger** (`UsageEvent`, `lib/usage.js`): one row per Claude call,
  written through a single `aiAccess()` / `ai.call()` door that all six
  call sites now use. Cost is stored in micro-dollars - a drinking-window
  call costs about 0.3 of a cent, which whole-cent rows would have summed
  to nothing - from a rate table copied from the published prices.
- **The tiers** (`lib/ai-models.js`): Opus work drops to Sonnet, Sonnet
  work to Haiku 4.5. Haiku takes no adaptive thinking, no `effort` and
  only the basic web search tool, so the request shape and Research's tool
  version follow the model. If Haiku rejects a request, that call is
  retried once on the normal model, loudly.
- **The limits** (`Domaine.monthlySpendCapCents`/`monthlyHardStopCents`):
  $5 and $15 by default, from `lib/usage-policy.js`, overridable in the
  environment; the app owner's own Domaine is unlimited. Calendar months,
  UTC.
- **The screens**: a note on Suggest/Scan/Research/Estimate-windows when
  it matters; the Domaine's own spend on the People page; `/usage` for the
  app owner (every Domaine, per feature, with the limit form).
- **Scan is held on Sonnet over the cap** (decided 2026-10-03,
  `holdTier` in `lib/usage.js`) and only paused at the hard stop: it is
  the one feature that saves what it reads straight into the cellar with
  no review, so a cheaper model's mistakes would land as bad data. The
  Scan page shows no "lighter models" note until Scan itself is paused.
- **Found while testing**: React resets an uncontrolled form after every
  action, so a refused limit save wiped what had just been typed. The
  form now keeps the typed values (`UsageLimitsForm`). And my first bulk
  Research test never started a job - the button has a two-step confirm -
  so the "paused" check beside it had passed vacuously; both are fixed.

Verified against a stub of the Messages API, with exact costs checked by
hand; 50 unit checks join `npm run verify`; `/usage` joins the smoke test
(17 pages). **Not run against the live API**, and Haiku's quality on
label reading and Research is still unmeasured - see FUTURE_CAPABILITIES.md
"Built" for the full list of what is and isn't known.

`prisma/schema.prisma`, `prisma/migrations/20260929000000_usage_ledger_and_caps/`,
`lib/usage.js`, `lib/usage-pricing.js`, `lib/usage-policy.js`,
`lib/ai-models.js`, `lib/anthropic.js`, `lib/suggest-model.js`,
`lib/owner.js`, `lib/auth.js`, `app/actions.js`, `app/(owner)/usage/`,
`app/components/{AiLimitNotice,AiUsageSummary,UsageLimitsForm}.js`,
`app/(owner)/invites/page.js`, `scripts/usage.test.mjs`,
`scripts/smoke.mjs`, `.env.example`, README.md.

## 55. A three-reviewer pass on the usage limits, and what it changed

After #54 the ai-reviewer, data-engineer and docs-keeper agents each read the
work. Their combined list, decided with the owner 2026-10-03 (the owner will
revisit item M separately):

- **Drinking-window estimates are held on Sonnet** (like Scan) and only
  paused at the hard stop: they too are saved unreviewed. Both estimators
  pass `holdTier`. A plausibility check (`plausibleWindow` in
  `lib/drink-window.js`: whole years, 1800-2300, end not before start, start
  not before the vintage, end within a century of it) refuses an implausible
  answer before it is saved or cached.
- **Estimates only fill blanks.** The write is a conditional `updateMany`
  (`drinkFrom` and `drinkTo` both null), so an estimate that arrives after
  the owner typed a window can't overwrite it; the single-bottle button
  refuses a bottle that already has one.
- **Research keeps the owner's window** (`holdOwnersWindow` in
  `lib/research-fields.js`): a proposal can no longer replace a window the
  owner set, only fill or revise an estimated one.
- **The lighter-model retry** sticks for the rest of the action once a model
  has refused (and catches a 404 as well as a 400), instead of retrying every
  call; the log says an input-caused 400 will also fail on the normal model.
- **"Research all" and "Estimate windows" stop cleanly at the hard stop**:
  the queue is kept, the job is marked `paused`, and the screens say so.
- **Lighter-tier Research is capped at two web searches** per call.
- **The app owner is a stored flag** (`User.isAppOwner`, on exactly one
  account, the earliest by `createdAt` then `id`, set by a migration), not
  "the earliest user, looked up each time" and not an env var. The People
  page shows no controls on that row and `changeMemberRole`/`removeMember`
  refuse it. `OWNER_EMAIL` is now only for claiming the first account.
- **A Domaine can't lose its last Cellarmaster to a race**: those two
  actions run in a Serializable transaction that rolls back if no
  Cellarmaster would remain. Three Domaines left memberless by accounts
  deleted outside the app were removed from the development database;
  `/usage` labels any such Domaine.
- **CHECK constraints** on limits (non-negative, hard stop at or above cap)
  and on the ledger's counts and cost.
- **`/export` now carries** the Domaine (name, motto), its members and its
  invites - the usage ledger and limits are deliberately left out.
- **Suggest's system prompt** was rewritten (browse the cellar with no
  filters first), and the "estimated window" rule is repeated in the tool's
  field descriptions.
- **Docs**: README, FUTURE_CAPABILITIES, AGENTS.md, `.env.example`, the
  schema comments, three agent definitions and this file brought back in
  line with the code. 23 new unit checks (`scripts/ai-guards.test.mjs`) join
  `npm run verify`.

Migrations: `20260930000000_app_owner_flag`,
`20260930010000_limits_check_constraints`. Deploy note: apply them before the
new code serves traffic - the session callback reads `isAppOwner`.

## 56. Left open by the #55 review

- ~~**Shared constants for roles, access levels and usage features.**~~ -
  done in #58.
- **Measure Haiku.** Its quality on label reading and Research is still
  unmeasured; there is no live API key in the development environment.
  Scan and the estimators are held on Sonnet because of that doubt, and
  Suggest/Research drop to Haiku over the cap. A small fixed set of photos
  and bottles run on both tiers would settle whether that is acceptable.
- ~~**`scripts/compare-suggest-models.mjs` no longer loads**~~ - fixed in #57.
- **Maybe, if it ever bites**: an index on `UsageEvent(createdAt)` if `/usage`
  gets slow across many Domaines; a ledger flag for "retried on the normal
  model" so `/usage` can show how often the lighter tier was refused.

## 57. The model-comparison script works again, and can't drift from Suggest

`scripts/compare-suggest-models.mjs` stopped loading when the model helpers
moved out of `lib/anthropic.js` (which is `server-only`) in #54, and before
that it had already been caught running a stale prompt (#23): its header
said "re-sync by eye", and nobody had. Both fixed at the root.

- **The prompt and tools are shared, not copied.** `BROWSE_CELLAR_TOOL`,
  `SUGGESTIONS_TOOL` and `buildSuggestSystemPrompt` moved verbatim from
  `app/actions.js` (a `"use server"` file, so the script could never import
  them) to `lib/suggest-prompt.js`, which has no SDK, database or `@/` alias.
  The app and the script now import the same objects. Six new checks in
  `scripts/ai-guards.test.mjs` pin the strict flags, the estimated-window
  rule in both field descriptions, and the prompt's browse-first line.
- **Three arms, from `requestShape()`**: `opus` (reasoning), `sonnet`
  (extraction) and `haiku` (extraction, lighter) - the three models Suggest
  can really run on, with the request fields the app would send each
  (Haiku gets no thinking and no effort). All three run by default.
- **Still copied**: the `browse_cellar` query itself (Prisma and the scoped
  client in the app, plain `pg` here). The script header says so.

Checked against the stub API: it loads, sends the right model, thinking,
effort and tools to each arm, and the full test suite and `npm run verify`
pass. **Not run against a live key**, and the stub doesn't answer Suggest's
tools, so the browse loop and its pg query were not exercised end to end.
Running it - `node scripts/compare-suggest-models.mjs --models haiku,sonnet`
against real keys - is the first step of the Haiku measurement in #56. It
spends real money: all defaults is thirty calls.

## 58. Roles, access levels and usage features, from one list each

The strings `"cellarmaster"`, `"guest"`, `"separate"` and the five usage
feature names were literals in about twenty files. A typo in one is a
comparison that is never true, with no error - for `role !== "cellarmaster"`
that locks a person out. Done the way `WINE_COLORS` was.

- **`lib/roles.js`**: `ROLE` (cellarmaster, guest) and `ACCESS` (the two
  roles plus `separate`), with `ROLE_VALUES` / `ACCESS_VALUES` for
  validation. Frozen, no imports, so the invite form (a client component)
  and plain node scripts can load it. Every comparison in `lib/auth.js`,
  `lib/owner.js`, `lib/guest.js`, the owner layout, `/export`, `/usage`,
  `/invites` and its actions now spells the value from here;
  `lib/invite-access.js` builds its option list from it.
- **`lib/usage-features.js`**: `FEATURE` (scan, suggest, research,
  estimate-windows, photo-details), imported by every `ai.call()` site and
  by the two pages that show a limit notice. `recordUsage` now logs an
  unknown feature name (still recording the row - the spend is real).
- **A drift hazard closed on the way**: "held" features (Scan and the
  drinking-window estimators, which stay on their normal model over the
  cap) were declared three times at the call sites with `holdTier: true`
  and a fourth time, by name, in the notice that says "running on lighter
  models". They are now one list, `HELD_FEATURES`, keyed on the feature,
  and `ai.call()` no longer takes a `holdTier` argument. Adding a call site
  for a held feature can't forget the hold; the notice can't disagree with
  the gate.
- **Stored values unchanged**: no migration. `scripts/constants.test.mjs`
  (10 checks, in `npm run verify`) pins every stored word and fails if a
  raw role, access or feature literal reappears in `app/` or `lib/` code
  (comments may still say them); checked by adding a deliberate offender.

`npm run verify` passes with accounts on and off, and the three stub
end-to-end suites pass. One suite failed once for test-state reasons (a
leftover research queue from another suite), fixed in the test.

## 59. Model testing: paused, 2026-10-03

The plan (#56, #57): run the Suggest comparison and then a label-reading
comparison against the real API for the first time, to learn whether Haiku
is acceptable as the over-cap tier and whether the 5.5 models are worth
adopting. **Paused by the owner**, who may restart it from scratch.

Where it stands:

- **Built and merged, and still good**: `scripts/compare-suggest-models.mjs`
  loads again and has a Haiku arm; the Suggest prompt and tools are shared
  with the app (`lib/suggest-prompt.js`); the pricing table already has
  `claude-opus-5-5` and `claude-sonnet-5-5`. Not yet done: arms for the 5.5
  models in the script, and the label-reading comparison.
- **Never run against a real key.** A separate session, "Cellarmaster model
  testing", was started on the branch to do the first run. It stopped at
  step one, the one-cent "does the key work" call: its own report was
  "proxy not swapping credential". The environment's API credential (host
  `api.anthropic.com`, header `x-api-key`) was not being substituted into
  its requests, so no real model call has succeeded. This is an environment
  set-up problem, not something the owner or the code did wrong. It spent no
  API money.
- **`test-labels/`** exists on the branch with only a one-line `notes.md`;
  no photos or expected answers have been added.

To resume, start a fresh session and change nothing else until a single
tiny call (Haiku, 8 tokens) succeeds. If the credential still isn't
substituted, try the other route: an ordinary environment variable holding
the key, which the session can read (less private, since the session sees
it), set only for the test and deleted after.

If the testing is abandoned instead: delete the `cellarmaster-testing` key in
the Claude Console, and remove the credential from the Default environment.

## 60. Two flight UX items, raised by the owner 2026-10-03

Both from using a flight at a real tasting (a flight of five wines, every one
marked tasted, on `/flights/[id]`).

### 1. "Delete flight" is the wrong word for finishing a flight

Once every wine in a flight is tasted, the only control on the page is a red
**Delete flight**. Functionally that is fine: each tasted wine is already
logged (a flight-only wine moved to Tasting notes when its pick was marked
tasted, an owned one had its count decremented), so the flight itself has
nothing left to hold. But a red delete on a flight that went well reads as
destroying something, and it is the only way to be rid of the flight.

- **What to build.** When every pick is tasted, the control reads
  **Complete flight**, in a calm tone rather than red (`ConfirmButton` already
  has `tone="neutral"`), with a confirm that says what stays: the tasting
  notes and the bottles' history are untouched; only the flight's queue entry
  goes. While picks are still untasted it stays **Delete flight**, since that
  really does discard planned wines.
- **The open design question.** Should completing *delete* the flight, as
  today, or *keep it as a record* (a `completedAt`, listed under a "Finished"
  heading on `/flights`)? `isOpenFlight()` in `lib/flights.js` already treats
  an all-tasted flight as "a record now, not a queue", which points at keeping
  it - and a kept flight would let a past tasting's lineup be looked at again.
  Deleting is the smaller change and what the owner described as acceptable.
  Decide before building; the label change alone can ship either way.
- **Check before changing anything.** An *untasted* flight-only wine
  (`originFlightOnly`) deleted with its flight is left with no flight and
  turns up in the "waiting for a flight" box on `/flights`. Completing a
  fully tasted flight cannot do that, but a partly tasted one still can, so
  "Complete" must not be offered until every pick is tasted, and "Delete"'s
  existing warning about flight-only wines stays.

### 2. Adding wines to a flight by photo, without leaving the flight

Building a flight by hand lets you pick only from bottles already in the
cellar (and flight-only wines saved earlier). Scanning wines straight into a
flight does exist, but only by going out to **Scan**, choosing the **Flight**
destination, and then picking a flight at the end of the batch. The owner's
point: someone already on a flight's page, or just creating one, should not
have to leave it to do that.

- **What to build.** An **Add by photo** option beside the bottle picker on
  `/flights/[id]` (and as the obvious next step right after "Create flight",
  where the new page already opens the picker), which runs the existing scan
  panel with its destination fixed to *this* flight, so the wines land in it
  directly and the page ends back on the flight. The reading, review cards and
  the Flight status for wines you don't own are all the existing Scan code
  (`ScanPanel`, `lib/scan-intent.js`); this is a different entry point to it,
  not a second scanner.
- **Open questions.** Does a scanned wine here always become flight-only (the
  Scan "Flight" behaviour, #36), or should the owner be able to say "this one
  I do own" and send it to the Cellar as well? And the scan panel's
  end-of-batch "choose a flight" step has to be skipped here, since the
  flight is already known; that step is where #37 and #38's abandoned-batch
  edge cases live, so the change needs the same care.
- **Where the code is.** `app/(owner)/flights/[id]/page.js`,
  `app/components/FlightBottlePicker.js`, `app/components/NewFlightForm.js`,
  `app/components/ScanPanel.js`, and `addBottlesToFlight` in `app/actions.js`.

### Built, 2026-10-03

Both, with the owner's answers to the open questions: a flight scanned from
inside is *only* that flight (no choice of Cellar or another flight), and
completing deletes, as before.

- **Complete flight.** On `/flights/[id]`, when there is at least one wine and
  every pick is tasted, the control is a neutral **Complete flight** with a
  confirm that says the wines are tasted and logged and only the flight is
  cleared. Otherwise it stays the red **Delete flight**, whose warning about
  flight-only wines is unchanged - which also closes the orphaning edge above,
  since Complete is never offered while a wine is untasted. `completeTastingFlight`
  re-checks on the server and does nothing if a wine was un-tasted in another
  tab since the page loaded. It still deletes; keeping finished flights as a
  record (`completedAt`, a "Finished" list) remains an option, not built.
- **Add wines by photo.** A link on the flight page opens
  `/flights/[id]/scan`, which is `ScanPanel` with its new `flight` prop: no
  destination tiles, no per-card "Saved to", no event name, no flight step.
  `extractWinesFromPhoto` takes the flight id, checks it before the paid call,
  forces the Flight status and links each photo's wines into the flight as
  soon as they are saved, not at "Done" - so a closed tab strands nothing
  (#37, #38). A hand-typed card saves through `createBottleInFlight`. If a
  link fails the wines are still saved, wait in the box on `/flights`, and the
  card says so. "Done" returns to the flight.
- **One row, not two bars.** The first version put "Add wines by photo" as a
  full-width bar above the "Add a bottle" panel, spending a second row on what
  is one question. They now share a row, **Add a bottle** and **Add by photo**,
  with the bottle search opening below (`FlightBottlePicker` takes a
  `photoHref`; its collapsible became an `aria-expanded` button). On an empty
  flight the search is still open to begin with.
- **Revised the same day (owner).** "Complete flight" is now at the top
  whether or not every wine is tasted: with some left it marks them all tasted
  and then clears the flight (`completeTastingFlight` runs each remaining pick
  through `markFlightPickConsumed`, so the effects are exactly those of tapping
  each - a cellar wine's count down by one, a flight-only wine to Tasting
  notes - and a failure partway can simply be re-run). The confirm spells out
  those effects. Delete moved to the foot of the page, as the quieter way to
  discard an untasted flight; an empty flight keeps Delete at the top. Each
  untasted pick also shows **Tasted** and **Tasted + note** on its collapsed
  row (`markFlightPickConsumedAndNote` marks it, then opens the bottle's note
  form tied to the flight); a tasted row stays one line, and Undo is still in
  the expanded row. A cost to know: two buttons add about 56px under each
  untasted wine, so a long untasted flight is taller than before.
- **Compacted for a long flight (owner, same day).** Chosen from two contact
  sheets (header and row options, with the wine counts that fit one phone
  screen): a three-row header - Back with the purple Flight pill opposite it,
  the name with Rename, then Complete flight beside "N of M tasted" and the
  date - and the two actions as icons (✓ Tasted, ✎ Add note, which also marks
  tasted) at the right of each untasted row, with a one-line key above the
  list. The Flight pill is off every wine, since the page is already the
  Flights area. About 4½ wines fit a phone screen before and about 7 now.
  What the pill and the old "Tasted one - N left" label used to say moved:
  a cellar wine with several bottles shows "N bottles" after its name (and the
  icon's accessible name says "Tasted one - N left"), and a flight-only wine
  says it was never in the cellar when its row is expanded. Icons are
  unlabelled on the row itself, so the key and each button's `aria-label`
  carry the meaning.
- **Opening a wine shows the wine (owner, same day).** The expanded row now
  leads with what the Cellar's own expanded row shows - variety and origin,
  colour and ABV, the drinking window, a clamped line of label or sheet notes,
  Suggest's reason when there is one, and a quiet "Photos, notes and editing"
  link - followed by Order up/down and Remove from flight. Gone: the "never in
  your cellar" note and the "Log a tasting note" link, both made redundant by
  the ✎ icon on the row. Kept, because removing them would lose a path: Undo
  on a tasted wine, and "Add a tasting note" on a tasted wine only (its ✎ icon
  is gone once it is tasted, since that icon also marks tasted).
- **Wording on the flight scan page.** It said wines "stay out of your cellar",
  and the card spinner said "checking your cellar" (true - Claude looks for
  existing matches - but it read as if the wines went there). The flow was
  never wrong: scanned wines get the Flight status and no cellar quantity. The
  intro now says wines are added to the flight only, "nothing is added to your
  cellar", and the spinner just says "Reading the photo…" in flight mode.
- **A race fixed on the way.** Appending picks was "last order + 1", a read
  then a write; three photos finishing together (the panel reads three at
  once) would write the same order. `appendFlightPicks` does it in a
  transaction under a per-flight advisory lock, and `addBottlesToFlight` now
  uses it too.

Verified on a production build against the stub API: six wines from three
simultaneous photos land in the flight with orders 0 to 5 and none in the
cellar; Complete appears only when everything is tasted and refuses on a stale
page; another Domaine's flight scan page is a 404; the ordinary Scan page is
unchanged. Not tried with a real photo or a phone camera.

