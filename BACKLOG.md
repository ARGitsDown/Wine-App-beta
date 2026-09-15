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
  its latency.** All five Claude calls set it; the four now on the
  lighter model are structured extraction ("read this back label, invent
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

## 17. The guest page ships the owner's private notes

`app/(guest)/guest/page.js` loads whole `Bottle` rows and spreads them into
props for a client component. `GuestBottleList` renders producer, bottling,
vintage, type, variety, region, country and the color swatch — but `notes`,
`criticNotes`, `needsResearch`, `photoUrl`, `acquiredAt` and `emptiedAt` all
ride along in the RSC payload and are readable in the browser's network tab.

`notes` is explicitly the owner's own free-form notes, and the route groups
were split precisely so a guest sees only their page. Sending the owner's
private notes to that page undercuts the split. It gets heavier as Research
fills `criticNotes` in, too: that field routinely holds several paragraphs,
so every guest page load carries all of it.

The fix is small and mechanical — replace the `include` with an explicit
`select` naming only what `GuestBottleList` and `filterBottles` read (`id`,
`producer`, `bottling`, `vintage`, `type`, `variety`, `canonicalVariety`,
`region`, `subRegion`, `country`, `wineColor`, `quantity`, plus the scoped
`favorites`). `getBottles` in `lib/bottles.js` already strips its joined
rows for exactly this reason; the guest path was written separately and
never got the same treatment. Worth doing on its own rather than folded
into unrelated work, so the diff is purely "what does this page actually
need".

## 18. Restore from a backup file

`/export` produces a JSON file that nothing can put back. `PROJECT.md` §7
asks whether the data is backed up anywhere recoverable, and today the
honest answer is "yes, but restoring it means hand-writing SQL".

A matching `/import`, or even a documented `node scripts/import.js
file.json`, would close the loop. It needs decisions this note shouldn't
pre-empt: merge or replace, what to do about id collisions, and whether
blob URLs in an old export still resolve. Worth doing only now that the
export actually contains every hand-authored table — importing an
incomplete backup is worse than not importing at all.

## 19. ABV: validate the unit, not just the comment

The schema pins the unit precisely ("14.5 for 14.5%") and nothing enforces
it. `parseOptionalFloat` accepts any finite number, `bottleDataFromWine`
takes `wine.abv` raw from the model, and `applyResearchProposal` takes it
raw from stored JSON.

The failure to expect is a model answering `0.145` — the fraction form —
instead of `14.5`. It stores clean, renders as "0.145%", and nothing flags
it. The form's `min="0" max="100"` is a browser hint the server never
re-checks, and neither AI path goes through a form at all.

One shared `parseAbv` beside the other `parseOptional*` helpers, dropping
anything outside a plausible label range rather than storing it, used by
all three paths. Deliberately not bundled with the research-proposal fixes:
those were correctness bugs with a known wrong outcome, this is a guard
against one that hasn't been seen yet.

## 20. List pages ship text nothing renders

`getBottles` uses `include` rather than `select`, so the full `Bottle` row —
`notes` and `criticNotes` included — reaches `FilterableBottleList` and
`BottleList`, both client components. `BottleList` reads twelve fields and
neither of those is among them.

The trimmed `tastingNotes: { select: { rating: true } }` and the
`{ tastingNotes, favorites, ...rest }` strip show the intent was to keep
list payloads small; the Bottle row's own wide text columns quietly defeat
it. The documented "load the whole table" simplification still holds — that
argument is about row count, and a personal cellar is small. This is about
column width, which it doesn't cover.

Right now it's a few hundred rows and you won't feel it. Once Research has
filled `criticNotes` on most of them, Cellar/Wishlist/History each ship a
few hundred kilobytes of unrendered text on every navigation, on a phone.
Swap `include` for `select`; the detail page already loads the full row
separately, so nothing else changes.

## 21. Bottle status as a shared constant

`"inventory"`, `"wishlist"` and `"consumed"` are written as bare string
literals in roughly 42 places across `app/actions.js`, `lib/bottle-dates.js`,
`lib/scan-intent.js`, five page components, `ScanPanel.js` (twice, as a
hand-written `[value, label]` array) and `BottleList.js`. Two of those keep
their own status→label mapping, so a fourth status — or a rename — means
finding every one of them by grep and trusting the grep was exhaustive.

`wineColor` had exactly this problem and it was solved properly: one
exported constant plus a case-insensitive normalizer in `lib/wine-colors.js`.
`status` never got the same treatment. The shape to copy is a
`lib/bottle-status.js` exporting `BOTTLE_STATUSES` (value, label, path),
with `pathForStatus` moving there out of `app/actions.js`.

Worth doing as its own change with nothing else in it, so the diff stays
purely mechanical and reviewable. Not urgent — nothing is broken today, and
the status vocabulary hasn't changed since the schema was written.

## 22. Compound index for the list pages

Every list page does `where: { status }, orderBy: { producer: "asc" }`, and
there is a single-column index on `status` only, so Postgres filters and
then sorts. `@@index([status, producer])` would serve both halves.

Being straight about this: at a few hundred rows you will never feel the
difference, and the schema comment beside the existing indexes already makes
exactly that argument for them. It's noted only because it's the same "cheap
to have in place before it hurts" reasoning applied to the one query shape
that runs on literally every page load.

## 23. The research review doesn't say whether a window was found or guessed

`drinkWindowEstimated` exists so it's clear which drinking windows are worth
double-checking, and the schema comment says it's shown as a distinct badge
for exactly that reason. The research review is the one place that
distinction matters most and the one place it isn't shown.

`RESEARCH_TOOL` asks the model for the flag and the proposal stores it, but
it isn't a `RESEARCH_FIELDS` entry, so it never becomes a diff row —
`windowEstimatedFromProposal` applies it silently on accept. A reviewer
approving "Drink from 2026 / Drink to 2034" is told those years and not
whether they came from a citation or from the model's judgment, and the
one-click Accept is the path most of these take.

Not a diff row of its own — "drinkWindowEstimated: false → true" is a worse
way to say it than marking the rows it qualifies. An "(estimated)" marker
beside the drink-window rows, reading from the proposal the way
`windowEstimatedFromProposal` already does, is the shape to aim for. The
carve-out comment in `lib/research-fields.js` notes why the field is absent
from that list in the meantime.

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
