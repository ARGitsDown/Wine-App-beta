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
- **A small cache** (keyed on producer/bottling/canonicalVariety/region/
  vintage) reuses a past estimate for an identical wine instead of
  re-asking Claude every time - not a hand-curated reference table (which
  would need the same domain judgment we're already asking the model
  for, just harder to keep current), just avoiding redundant calls for
  bottles you own multiples of.
- **A "drink soon" sort/view** on Inventory, ordered by urgency (past
  peak -> ending soon -> ready -> too young), since an estimate sitting
  on a detail page nobody visits doesn't actually help prioritize pulls.

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
