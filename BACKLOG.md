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

## 2. Regional hierarchy depth

`region` is deliberately one flexible field today (see the schema
comment). Real wine databases split this further — CellarTracker tracks
Country / Region / Sub-Region / Appellation as separate levels — and go
deeper still within a single region (Bordeaux → Médoc → Margaux; Burgundy
→ Côte de Nuits → Gevrey-Chambertin → a specific climat). Worth layering
in as sub-region data proves useful, without breaking existing flat
`region` values.

## 3. Wine color/category, distinct from `type`

CellarTracker treats "Type" (red/white/rosé/sparkling/dessert/fortified)
as a field separate from "Variety" — we've conflated the two into one
`type` field ("Red Bordeaux Blend", "Zinfandel"). A dedicated
color/category field would let "show me all my whites" work reliably
regardless of how `type` happens to be worded.

## 4. Drinking window

Every major critic (Wine Spectator, etc.) and CellarTracker track a
"drinking window" — a from/to range for when a wine is at its best. We
don't capture this at all. Worth adding, especially since it could feed
directly into the Suggest feature (don't recommend a bottle that isn't
ready yet, or is already past its peak).

## 5. Bottle size / format

`quantity` counts bottles but doesn't distinguish sizes (375ml half,
750ml standard, 1.5L magnum, etc.) — two half-bottles and two magnums
both just read "quantity: 2" today, which understates or overstates how
much wine you actually have.

## 6. Alcohol % (ABV)

Legally printed on nearly every label, easy to capture during scanning,
and useful for style/food-pairing reasoning (a 15.5% Zinfandel behaves
very differently at the table than a 12.5% Riesling). Not captured today.

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
