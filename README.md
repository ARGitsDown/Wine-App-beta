# Cellarmaster

A personal wine cellar tracker: cellar, wishlist, and tasting notes. See
[`PROJECT.md`](./PROJECT.md) for the full project spec and reasoning behind
the technical choices, [`BACKLOG.md`](./BACKLOG.md) for known data-model
gaps worth revisiting later, and
[`FUTURE_CAPABILITIES.md`](./FUTURE_CAPABILITIES.md) for bigger, deferred
features like separate cellars per user.

## What's here so far

- **Cellar** (`/inventory`) — bottles you own, with add/edit/remove, a
  free-text search box (producer, bottling, region, vintage - whatever you
  remember about it), and filtering by variety, region, sub-region,
  country, color, vintage, and rating. Searching and filtering happen in
  the browser as you type: the whole list is already there, so narrowing
  it is instant rather than a round-trip per keystroke. The filter panel
  starts collapsed so the bottles themselves are what's on screen first,
  and a narrowed list still has a shareable URL. A Sort control sits
  beside it — producer A–Z, **drink soon** (most urgent first: past peak,
  then whichever window closes soonest, then not-ready-yet, then bottles
  with no window on file), recently added, recently acquired, vintage
  either way, or highest rated. Also tracks ABV and a drinking window (from/to year) - both
  filled in automatically when scanned, editable by hand otherwise. Lists
  show
  just each bottle's header line by default (producer, bottling, vintage,
  type); clicking a row expands it in place for the fuller details and a
  link to its full page, so a long list stays scannable. Each bottle
  has both a short `type` (a header-friendly style label like "Red Bordeaux
  Blend" or "Zinfandel") and a fuller `variety` field for more detailed
  notes on the grape(s). "Region" is deliberately one flexible field rather
  than a rigid hierarchy: a US state for domestic wines, or a named
  region/appellation otherwise (Bordeaux, Burgundy, Central Otago, etc.) —
  a fuller multi-level drill-down can be layered on top later without a
  schema rework. There's also `bottling`, for producers who make more than
  one wine from the same grape/vintage: a vineyard designation (e.g.
  "Rochioli Vineyard") or a proprietary/cuvée name (e.g. "Madeleine"),
  shown right in the header so a producer's own bottlings read as
  distinct entries instead of looking like duplicates. Variety and Region
  fields offer autocomplete suggestions as you type (grape names/regional
  synonyms for Variety, well-known appellations plus anything you've typed
  before for Region) - still plain text underneath, so anything not on
  either list is fine to type too. Searching Variety by a grape name also
  matches bottles logged under a regional synonym for the same grape (e.g.
  searching "Grenache" also finds one logged as "Garnacha" or "Cannonau") -
  see [`BACKLOG.md`](./BACKLOG.md) #1.
- **Drinking windows, never left blank** — scanning and Research both
  propose a window for every wine now, rather than only when one is stated
  outright, and each says whether the answer was read from a source or
  judged, so an estimate is always shown as one. A bottle added by hand
  gets an **Estimate drinking window** button on its own page: the same
  model knowledge and the same cache as the bulk pass below, no web
  search.
- **Estimate drinking windows** (`/estimate-windows`, linked from a banner
  on the Cellar whenever any bottle qualifies) — a one-time bulk pass that
  gives every bottle with no drinking window at all a best
  estimate from Claude's general knowledge of the producer/variety/
  region/vintage (no web search - this is meant for backfilling hundreds
  of bottles at once, not researching one). Applied directly rather than
  reviewed one by one, and marked "estimated" on the bottle's own page
  afterward so it's clear which windows are a rough guess worth
  double-checking versus a confirmed one - see [`BACKLOG.md`](./BACKLOG.md)
  #7. Each answer is remembered against the wine (producer/bottling/grape/
  region/vintage), so owning the same wine as two separate entries, or
  re-adding it months later, reuses the earlier estimate instead of paying
  to ask the same question again.
- **Wishlist** (`/wishlist`) — bottles to try or buy, same filtering. A
  "Bought it" button moves a bottle into the cellar. As on the Cellar, the
  two ways in sit at the top of the page, before the controls for
  narrowing what is already there: a **Scan a label or shelf** button that
  opens the scanner already pointed at the right place, then the by-hand
  form.
- **Research** (`/research`) — bottles the scan feature wasn't confident
  about, and what a web search turned up for them. Each can be researched
  in one click from the list, or all at once behind a confirmation that
  says how many bottles that covers - at most that many live searches, and
  fewer when two rows turn out to be the same wine with the same details on
  file, since those share one lookup. Results wait in a review
  queue rather than being applied: each shows a field-by-field diff of
  current against proposed, which you can accept in one click, edit first,
  or dismiss. A proposal whose bottle changed after the research ran is
  flagged rather than thrown away, since the diff shows you what moved.
- **Tasting notes** (`/consumed`) — bottles you've finished, kept around
  (with their tasting notes). A row is a wine rather than an individual bottle,
  so owning several and drinking one just decrements the count ("Tasted
  one — 5 left"); it only moves here once the last one is gone, or via
  "Tasted all N" if you're clearing the whole lot at once. Counts can
  also be corrected with a +/- stepper right on a cellar row, without
  opening the bottle. Each bottle records when it was emptied, so this
  page sorts by "Recently emptied" — the date is stamped automatically and
  editable on the bottle's page, and bottles that got here before this
  existed read "Emptied date unknown" until you fill one in.
- **When a bottle arrived** — separately from all of that, a bottle records
  when it entered the cellar, which is not the same fact as when its row
  was typed in. It's stamped when a wine is added to the cellar or bought
  off the wishlist, kept when you eventually drink it (so a wine shows
  "Acquired May 2, 2019 / Emptied Sep 14, 2026"), and never invented where
  it wouldn't be true: a wishlist bottle isn't owned yet, and a wine logged
  straight to tasting notes never sat in the cellar. Editable — and
  clearable — on the bottle's page, and the Cellar and Tasting notes both
  sort by "Recently acquired".
- **Tasting notes** — a note, an optional 1–5 rating, and the date you
  tasted it, logged against any bottle regardless of its current status.
  The date defaults to today, so logging as you drink stays one tap, but a
  bottle you opened last month can be backdated rather than stamped with
  the day you got round to writing it up — and the date on an existing
  note can be corrected by clicking it. Rating is optional so a note can
  be logged without a personal score yet — an impression written down the
  night you opened a bottle, before you've settled on what it's actually
  worth.
- **Scan a label** (`/scan`) — photograph (or pick from your library) one or
  more photos at once. Each photo can hold a single bottle label *or* a
  document listing several wines (a shop's tasting sheet, a menu) - Claude
  figures out which and produces one reviewable card per wine either way.
  For each, it checks your own saved bottles for anything similar and
  infers what it can (e.g. the grape variety for a Bordeaux or Burgundy
  labeled only by region), and carries over any descriptive text the source
  already had, filed by whose words they are: something you wrote yourself
  becomes your tasting note and counts the wine as tasted, while a shop's
  shelf talker, a menu write-up or a back-label blurb goes to the bottle's
  "Critic & winemaker notes" instead. Somebody else's prose reading back as
  your own verdict is the mistake worth designing out — see
  [`BACKLOG.md`](./BACKLOG.md) #16. Each wine is saved as soon as it's read,
  rather than waiting on a manual confirm - so navigating away (or the tab
  closing) mid-batch never loses a wine that already came back; review and
  correct each card afterward, or remove one you don't want. Before picking
  photos you tap where the batch lands — Cellar, Wishlist or Tasting, as
  three cards carrying the same icons and colors those places have on the
  home screen — and every wine in it goes there, rather than the app
  guessing from whether the source happened to carry tasting notes; any
  single card can still be moved on its own afterward. Once results are
  stacking up the three cards shrink to a row of icons captioned "Next
  photos go to …", so the destination stays changeable for the next batch
  without pushing the results down the page. A wine it
  wasn't fully confident about is flagged "Needs research" once saved.
  A progress bar above the batch tracks how many photos have been read and
  how many wines have turned up so far, so a ten-photo run reads as
  working rather than indefinite, and ends with a summary of what was
  saved and what couldn't be read. The photo
  itself is kept too (uploaded to Vercel Blob storage) and shown back on
  the bottle's list row and detail page - optional, and the rest of
  scanning works exactly the same without it (see `BLOB_READ_WRITE_TOKEN`
  in `.env.example`). "Add a photo" on a bottle's detail page adds more
  photos afterward - a back label, a cork, a case - beyond the one
  captured at scan time. Each one it's read too: Claude looks for anything
  new it shows (an ABV or tasting note printed on a back label, a vintage
  on a case) and proposes field updates the same reviewable way as
  Research - nothing changes until you review and save.
- **Needs research** (the other half of the same `/research` page) —
  bottles the scan feature flagged as unsure about some field, before
  anything has been looked up. Research one straight from the queue, or
  open it and hit "Research further" on its own page, to have Claude look
  it up with an actual web search (not just its training knowledge) and
  propose corrections - reviewed and edited the same way as everywhere
  else before you save them. Dismiss a
  bottle straight from the queue if the current details already look
  fine, without spending a search on it. Research also looks for existing
  winemaking/tasting notes about the wine - the winery's own site first,
  then major critics (Wine Advocate, Wine Spectator, Halliday, Jancis
  Robinson), then other reviews/wine shops - and proposes them for the
  bottle's "Critic & winemaker notes" field, kept separate from your own
  notes and tasting entries.
- **Suggest** (`/suggest`) — describe tonight's menu for a pairing, or a
  theme/mood for a tasting flight, in one flexible text box; Claude infers
  which you mean. It browses your cellar (never the wishlist)
  for real candidates, explains its reasoning, and - when nothing owned is
  a strong match - proposes a specific gap suggestion you can add to the
  wishlist in one click instead of forcing a mediocre pick. Ticking
  "Include wines not in my cellar" widens that: a wine you don't own can
  then be recommended on its merits wherever it would genuinely pair
  better, not just as a fallback, still marked "Not in your cellar" and
  still addable to the wishlist. Off by default, since the usual question
  is what to open tonight. A **Character** control - Balanced / Classic /
  Exploratory / Avant-garde - says how adventurous the pick should be,
  which the request itself rarely settles: "something with roast chicken"
  is answered equally well by a white Burgundy, a Jura Savagnin or a
  chilled Trousseau. Balanced is the default and steers nothing.
  "Avant-garde" is a claim about the boldness of the *choice*, not the
  style of the wine. It knows each
  candidate's drinking window (if one is set) and steers toward a bottle
  that's actually ready over one that's too young or past peak. It also
  knows which of those windows the app guessed rather than read from a
  source, and it will pick a bottle on a guessed window just as readily -
  but it won't quote the years back at you as established fact, saying a
  bottle is "estimated to be drinking now" instead. The bottle's own page
  marks a guess with a "· estimated" badge right beside the window; a
  recommendation that quietly dropped that marker would be the one place in
  the app where a guess reads as a certainty. Every
  result leads with a short evocative title ("The Many Faces of Pinot")
  and keeps the fuller explanation behind a "Why these" disclosure, so
  you can see what was suggested before reading why. A pairing
  recommendation is ephemeral (not saved anywhere) but links each pick
  straight to "log this pairing," which prefills the dish into a new
  tasting note. A tasting-flight result can be saved via "Save this
  flight" - see **Tasting flights** below.
- **Tasting flights** (`/flights`) — a themed flight kept as a queue to
  pull bottles from over time rather than disappearing once you leave the
  page. Either ask Suggest for one and save it, or start one yourself with
  a theme name and search your cellar for the bottles, in the order
  you'd pour them. Any bottle you own can also be added to a flight from
  its card or its own page, via **Add to a tasting** — which lists the
  flights still on the go and offers to start a new one. Picks can be
  reordered or removed, marked "tasted" once you open them, or linked
  straight to logging a tasting note (prefilled with which flight it was
  part of). A flight is listed and headed by its title; one saved before
  titles existed keeps showing its summary as its name rather than getting
  a backfilled guess, and a hand-built one needs no description at all. Only real owned bottles are saved into a
  flight - a gap suggestion in the same result isn't something to "pull
  from the cellar," and can already be added to the wishlist independently.
- **Guest favoriting** (`/guest`) — a link you hand to friends and family
  so they can browse your cellar (read-only) and favorite
  bottles they'd like pulled for their next visit. The `/guest` chip on
  the Cellar opens your phone's share sheet, or copies the link where
  there isn't one, rather than making you retype it. Guests get the same
  instant search and filtering as the Cellar (minus the rating filter and
  the drink-soon sort, since your own scores and drinking windows aren't
  shown to them) — a cellar worth browsing is usually one too big to
  scroll. No account or password — a
  guest just enters a name (reused if they type the same one again from a
  new device), remembered via a cookie so their favorites persist across
  visits. Favorites show up back on `/inventory` as a ❤️ with who picked
  it. A guest sees only this page — no nav into the owner's Cellar,
  Scan, or anything else — which is why the app's routes are split into
  `app/(owner)` and `app/(guest)` route groups, each with its own header,
  rather than sharing one. This is deliberately lightweight; everyone getting their own
  separate cellar is a bigger, separate capability - see
  [`FUTURE_CAPABILITIES.md`](./FUTURE_CAPABILITIES.md).
- **Deleting asks first** — removing a bottle, one of its photos, or a
  saved flight takes a second click, and the confirmation says what else
  goes with it ("Also deletes 2 tasting notes and 2 guest favorites"),
  since a bottle's notes and favorites are cascade-deleted along with it.
- **Data export** (`/export`, linked from the home page) — downloads every
  bottle, its tasting notes, and every guest with their favorites, as one
  JSON file. Cheap peace of mind for a personal system with no other backup
  story. Saved flights and the extra photos added to a bottle aren't in the
  file yet — see [`BACKLOG.md`](./BACKLOG.md) #18.
- **Add to home screen** — the app has a real icon and manifest, so
  "Add to Home Screen" (iOS/Android) gives it its own icon and a
  standalone window (no browser address bar) instead of just a bookmarked
  tab, per the mobile-web-app plan in [`PROJECT.md`](./PROJECT.md). The
  mark is a cellar vault with a bunch hanging in it, drawn as plain shapes
  in `app/components/AppMark.js` rather than an image asset, so there is
  nothing to host and it renders identically wherever `ImageResponse` runs.
  `app/icon.js` draws it at 512px for the favicon and the manifest,
  `app/apple-icon.js` at 180px for the iOS home screen. Note that iOS
  snapshots the name and icon when you add it — changing either later
  won't update a bookmark that already exists.
- **Design touches** — the home page is six cards and nothing else: no
  title, no section labels, since six labelled cards say what the app holds
  better than a heading above them does. Each card carries its icon and
  name top-left, its count bottom-left (centered under the icon, so the
  figure reads as belonging to it) and its description bottom-right, each cut
  short enough to sit on one line at phone width. Only
  Cellar, Wishlist, Tasting notes and Flights carry a count — a number
  on "Scan" would be meaningless, so Scan and Suggest give their
  description the whole bottom row instead. Where there is a count, the
  card reads as two columns: icon over number on the left, name over
  description on the right. "Wines tasted" counts wines you have actually
  drunk, whether or not you wrote anything down — a bottle finished in
  silence still means you have had it. The whole screen fits above the
  fold on a small phone. The icons are hand-written SVG paths in
  `app/components/icons.js` rather than image assets or an icon library —
  nothing to host or license, and they inherit the surrounding text color
  so one copy works in both themes. They're built from a few shared parts
  (a bottle, a glass, a coil) rather than drawn one at a time, since four
  of the six contain a bottle and three contain a glass — which is what
  keeps the set looking like a set. Anywhere the app is doing something that takes a moment (saving
  a bottle, researching, getting suggestions, reading a scanned photo) it
  shows a small animated "glass swirl" indicator instead of static text,
  so a busy screen reads as working rather than stuck. Navigating between
  pages shows a page-shaped placeholder while the data loads, rather than
  leaving the old screen up with nothing happening, and the nav marks
  which page you're on.

## Running it locally

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

There's one Postgres database, used everywhere (no separate local
database) — set its connection string as `DATABASE_URL` in a `.env` file
(see `.env.example`). On Vercel, `npm run build` runs `prisma migrate
deploy` first, so schema changes apply automatically on every deploy.

The label-scanning feature needs an `ANTHROPIC_API_KEY` (also in
`.env.example`) — without one, `/scan` shows a clear error and falls back to
a manual add-bottle form, so it degrades gracefully rather than breaking the
rest of the app.

## Tech stack

- [Next.js](https://nextjs.org) (App Router, JavaScript) — pages and backend
  logic in one project, deployed on [Vercel](https://vercel.com).
- [Prisma](https://www.prisma.io) — the database layer. Models live in
  [`prisma/schema.prisma`](./prisma/schema.prisma).
- [Tailwind CSS](https://tailwindcss.com) — styling.
- [Anthropic's Claude API](https://docs.claude.com) (`@anthropic-ai/sdk`) —
  reads wine photos for the scan feature (`extractWinesFromPhoto`), reasons
  over the cellar for pairing/tasting suggestions (`getSuggestions`), and
  looks up an uncertain bottle with a real web search (`researchBottle`).
  All three in `app/actions.js`. Which model each call uses is set in one
  place (`lib/anthropic.js`): structured extraction against a known schema
  (scanning, research, drinking-window estimates, reading an added photo)
  runs on a faster mid-tier model, while open-ended judgment over the whole
  cellar (Suggest) stays on the heavier one — so the calls that just need
  careful reading aren't paying for reasoning they don't use.

Data mutations (adding a bottle, logging a tasting note, etc.) go through
Next.js Server Actions in [`app/actions.js`](./app/actions.js) — plain
`async` functions that run on the server and are wired directly to HTML
`<form>` elements, no separate API layer needed.
