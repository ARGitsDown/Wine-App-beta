# Wine App — Project Spec

## 1. Overview

This is a personal hobby project to build a wine tracking app. The primary
goal isn't the app itself — it's to learn how AI-assisted coding actually
works by building something real, end to end, that I'll enjoy using
afterward. I'm a wine hobbyist: I want to track what's in my cellar, log
tasting notes, and keep a wishlist of bottles to try or buy. I have no prior
coding experience, so this project is also my introduction to how software
gets built.

## 2. Who it's for

Just me, for now. The app should assume a single user with no login system
for the MVP. It's plausible that a few other people (friends or family) might
want their own version later, but that's not a requirement today — don't
build multi-user support or accounts now, just don't design anything that
would make adding it later unusually painful (e.g., don't hardcode "me" as a
magic value scattered through the code).

## 3. Core features (MVP)

Keep this deliberately small. The goal is a working app I actually use, not
a feature-complete one:

- **Inventory** — bottles I own: producer, vintage, variety, region,
  quantity, notes. Add, edit, remove.
- **Tasting notes & ratings** — log a note and a rating against a bottle,
  whether it's currently in inventory or already consumed.
- **Wishlist** — bottles I want to try or buy, separate from inventory.
- **Search/filter** — by type/variety, region, vintage, and rating.

That's it for v1. Everything else below is explicitly deferred.

## 4. Possible future features

Not for now — but worth keeping in mind so early technical choices don't
rule them out. Two items originally listed here are since built — see
[`README.md`](./README.md) for how they work today:

- ~~Wine pairing suggestions (matching a dish to bottles on hand)~~ — built
  as `/suggest`, along with themed tasting flights (the two other half of
  that same feature).
- ~~Photo-based label reading~~ — built as `/scan`, including multi-wine
  sheets (a shop's tasting list), not just single bottle labels.
- Barcode scanning
- Drinking window tracking (when a bottle is at its peak) — tracked in
  [`BACKLOG.md`](./BACKLOG.md).
- ~~Sharing or collaborating with other people~~ — partly built as guest
  favoriting (`/guest`): no accounts, a friend just browses your inventory
  and shortlists bottles for their next visit. Everyone getting their own
  separate cellar is a bigger fork, tracked in
  [`FUTURE_CAPABILITIES.md`](./FUTURE_CAPABILITIES.md) rather than here.
- Price tracking / valuation
- Offline support
- Saved/browsable tasting flights (a "queue" to pull bottles from later to
  consume and rate) — the current `/suggest` pairing output is ephemeral,
  not saved anywhere yet.

## 5. How I want to use it

- **Platform:** Phone, primarily. I don't have coding experience or a
  strong preference between "real app" and "website" — what matters is that
  it works well on my phone.
  - **Recommendation for the coding assistant:** build this as a mobile-
    friendly website (a "web app") rather than a native iOS/Android app.
    A native app requires a Mac, Xcode, and app store submission — a much
    bigger lift with no real benefit at this stage. A well-built mobile
    website can be added to my phone's home screen and feels like a real
    app for everyday use. Native can always be revisited later if it's
    ever justified.
- **Offline:** Not required for v1 — online-only is fine to start. Offline
  support is a real future goal, though, so avoid architecture choices that
  would make adding it unusually difficult later (this is a note for the
  coding assistant's technical judgment, not something I can evaluate
  myself).
- **Multiple users:** Just me for now, possibly others later (see section 2).

## 6. Constraints & preferences

- I have no coding background. I'm relying on the coding assistant to:
  - Make sensible technical choices on my behalf (language, framework,
    database, hosting) without expecting me to weigh in on tradeoffs I
    don't have context for.
  - Explain what it's doing and why, in plain language, as we go —
    especially the first time a new concept or tool shows up.
  - Flag when it's making an assumption on my behalf so I can correct it
    if it's wrong.
- **Simple over impressive.** I'd rather have something boring that I
  understand and can maintain than something clever that breaks in ways
  neither of us can debug. If there's a straightforward, well-worn way to
  do something and a fancier way, default to the straightforward one.
- Prioritize steps that help me actually learn (short explanations of what
  a file/command/concept does) over moving as fast as possible.

## 7. Open questions

Things worth deciding — with the coding assistant's guidance — before or
shortly after building starts:

- **Confirm the "web app, not native app" recommendation in section 5** —
  I'm not attached to it, just don't have the background to evaluate it
  myself.
- **Data storage:** where does my data actually live, and is it backed up
  anywhere I could recover it from if something breaks?
- **Hosting:** where does the app run once it's more than a local
  experiment, and does that cost anything?
- **How much do I need to understand vs. just trust?** I want to learn, but
  I also don't want every small step to turn into a lecture — worth
  agreeing on a rhythm (e.g., explain new concepts, don't re-explain
  repeated ones).
- **Naming:** does this app need a name, or is that unimportant for now?
