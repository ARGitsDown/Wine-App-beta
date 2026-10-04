# What I (should) have learned

A recap of what building Cellarmaster should have taught, written to be
**tested against**, not just read. The goal in [`PROJECT.md`](./PROJECT.md)
was never only the app - it was to learn how software gets built with AI
assistance, end to end. This file is the checklist for that second goal.

Everything below is true of this repo as of **2026-10-03** and points at the
real files, so you can check any claim against the code. If a claim stops
being true, that is a bug in this document - say so and it gets fixed.

---

## How to use this document

1. **Cover the answer, answer the question.** Each section ends with
   *Check yourself* questions. The answers sit in collapsed blocks
   (tap to open). Say your answer out loud or write it down *first*.
2. **Score yourself honestly** in the [Gaps log](#gaps-log) at the bottom:
   `1` = I could not explain this, `2` = I could with the doc open,
   `3` = I could explain it to a friend. Anything at `1` or `2` is where
   to spend time.
3. **"Explain it back" beats "recognize it".** If you can only nod along,
   it is a `2`. The test is whether you could say it unprompted.
4. **Print it.** `npm run print:learning` writes `LEARNING.pdf` with the
   answers moved to an answer key at the back (so a printout can be used as
   a real test); add `-- --with-answers` to keep them under each question.
   Ask a Claude Code session to run it - the PDF is not kept in the repo.
5. **Ask for more.** To expand this file, ask for a new section on a topic
   ("add a section on how caching works"), a harder quiz on one section,
   or a "teach me this from scratch" walkthrough of any file. Add what you
   got wrong to the log - that is the document's most useful part.

**A note on expectations.** You did not write this code and you are not
expected to be able to. What you *should* be able to do is: know what each
piece is for, know where to look when something breaks, ask for the right
change in the right words, and judge whether a proposed change is sensible.
That is the real skill of directing software, and the vocabulary below
is the tool for it.

---

## 1. The whole thing in one paragraph

Cellarmaster is a **web app** (a website you add to your phone's home
screen) for tracking a wine cellar. You open it in a browser; the page and
all its logic are served by **Vercel**; the data lives in a **Postgres
database**; photos live in **Vercel Blob** storage; signing in goes through
**Google** or an emailed link from **Resend**; and the clever parts - reading
labels, suggesting pairings, researching a bottle, estimating drinking
windows - are done by **Claude**, called through Anthropic's API and paid for
with an API key from the **Claude Console**. The code lives on **GitHub**,
and **Claude Code** (what you have been talking to) wrote and tested it.

### A request's journey

```
 Your phone (browser)
        │   1. you tap "Cellar"
        ▼
 Vercel  ── runs the Next.js app ──────────────────────────────┐
        │   2. checks you're signed in (session cookie)        │
        │   3. asks the database for YOUR Domaine's bottles    │
        ▼                                                      │
 Postgres (Prisma Postgres, via Vercel)                        │
        │   4. rows come back                                  │
        ▼                                                      │
 Vercel renders the page (HTML) and sends it back ◄────────────┘
        ▼
 Your phone shows it

 Scan a label:  phone ─► Vercel ─► (usage gate) ─► Anthropic API ─► answer
                                  └► photo saved to Vercel Blob
                                  └► bottle saved to Postgres
 Sign in:       phone ─► Vercel ─► Google (or Resend emails you a link)
```

Keep this picture. Almost every question of the form "where does X happen?"
is answered by finding X on it.

**Check yourself**

- Where does the *data* live? Where does the *code* run? Where do the
  *photos* live? Who answers the *clever* questions?
- Why can a page you opened yesterday show a bottle you added today from
  another device?

<details><summary>Answers</summary>

Data: a Postgres database. Code: Vercel's servers (not your phone - your
phone only displays what it is sent, plus a little interactive code).
Photos: Vercel Blob. Clever questions: Claude via the Anthropic API.

Because the browser is not the source of truth - the database is. Every
visit asks the server, which asks the database.
</details>

---

## 2. The platforms and accounts

Seven services, each with one job. Know **what it does for the app, where
you touch it, and what breaks if it goes away.**

| Platform | Its job here | Where you touch it | If it vanished |
|---|---|---|---|
| **GitHub** | Stores the code and its whole history. Runs the automatic checks (`.github/workflows/verify.yml`). | github.com/ARGitsDown/Wine-App-beta | You lose the history and the safety net; Vercel has nothing to build. |
| **Vercel** | Hosts the app: builds it on each push, runs it, holds the secrets (environment variables), provides Blob storage and the database connection. | vercel.com dashboard: deployments, environment variables, storage | The site disappears. Everything else survives (code on GitHub, data in Postgres). |
| **Prisma Postgres** (via Vercel's *Storage* integration - inferred from the variable names `lib/database-url.js` reads; check the Vercel dashboard to confirm) | The database: every bottle, note, flight, account, usage record. | Vercel dashboard → Storage. Code talks to it through **Prisma**. | You lose *all your data* - the only thing here that cannot be rebuilt from the repo. Hence `/export`. |
| **Vercel Blob** | Stores label photos as files; the database keeps only each photo's URL. | Vercel dashboard → Storage. `BLOB_READ_WRITE_TOKEN`. | Scanning still works but keeps no picture (by design). |
| **Anthropic API + Claude Console** | The AI. The *Console* (platform.claude.com) is where you create API keys, set spend limits and see billing. | Console → API keys, Billing, Limits | Scan, Suggest, Research and estimates report "unavailable"; the rest of the cellar works. |
| **Google Cloud Console** | Lets people "Sign in with Google": you register an **OAuth client** (an ID and a secret) and a consent screen. | console.cloud.google.com → APIs & Services → Credentials | The Google sign-in door closes; the email door still works. |
| **Resend** | Sends the "magic link" sign-in emails. | resend.com → API keys, Domains | The email door closes; the Google door still works. |

Also in the picture, but not part of the running app:

- **Claude Code** (claude.ai/code) - the development tool. It works in a
  temporary cloud machine (an *environment*) with the repo checked out. You
  configured one: *Default*, with **Trusted** network access and an **API
  credential** for `api.anthropic.com`.
- **Playwright + a local Postgres** - used only when testing, to open the
  real pages in a real (invisible) browser against a throwaway database.

### Two things that confuse everyone

- **claude.ai (the chat app) and the Claude Console (the API) are
  different products with different billing.** A chat subscription does not
  pay for API calls. The app's AI features are paid from the Console.
- **A secret never goes in the code or in chat.** Keys live in environment
  variables (Vercel's settings; the Claude Code environment's *API
  credentials*). That is why `.env.example` lists names but never values,
  and why the credential you added is hidden even from Claude.

### Environment variables - the app's settings

`.env.example` documents every one. The idea to hold on to: **each one
switches a capability on, and the app degrades honestly when it is missing.**
Only `DATABASE_URL` is truly required.

| Variable | Switches on |
|---|---|
| `DATABASE_URL` | The database (required) |
| `ANTHROPIC_API_KEY` | Scan, Suggest, Research, estimates |
| `BLOB_READ_WRITE_TOKEN` | Keeping label photos |
| `AUTH_SECRET` + a provider's pair | Accounts at all (sign-in, invites, Domaines) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google sign-in |
| `AUTH_RESEND_KEY` / `AUTH_RESEND_FROM` | Email sign-in |
| `OWNER_EMAIL` | Who may *claim* the very first cellar (not who runs the app) |
| `USAGE_DEFAULT_CAP_CENTS`, `USAGE_HARD_STOP_MULTIPLIER` | Starting AI limits for new Domaines |

**Check yourself**

1. Your Anthropic bill is higher than expected. Which website do you open?
2. Google sign-in stops working but email sign-in still works. Which
   platform do you look at first?
3. Which platform holds the one thing that cannot be recreated if lost?
4. Why does the app still *work* if `ANTHROPIC_API_KEY` is missing?
5. What is the difference between the Claude Console and claude.ai?

<details><summary>Answers</summary>

1. The Claude Console (platform.claude.com) - Billing and usage. (Inside the
   app, `/usage` shows what each Domaine has spent.)
2. Google Cloud Console - the OAuth client, redirect URIs, or the "test
   users" list.
3. The database (Prisma Postgres). Code is on GitHub; photos are replaceable;
   the data is not.
4. By design (`lib/ai-errors.js`): AI calls fail into a friendly "unavailable"
   message, and everything that is a plain database read keeps working.
5. Console = API keys, billing and limits for programs calling Claude.
   claude.ai = the chat product you use directly. Separate accounts of
   spend.
</details>

---

## 3. The shape of the code

### Front end vs back end - and why Next.js blurs them

- The **front end** is what runs in your phone's browser: the buttons,
  the filtering that happens as you type, the progress bars.
- The **back end** is what runs on Vercel's servers: checking who you are,
  reading and writing the database, calling Claude, holding secrets.

In an older style these are two separate programs that talk through an API.
**Next.js** lets one project do both. Two ideas make that work:

- **Server Components** (the default): a page's code runs *on the server*,
  fetches its data, and sends finished HTML. Nothing secret can leak
  because the code never reaches the browser.
- **Client Components** (files starting `"use client"`): code that *does* run
  in the browser, for anything interactive - a button that expands a row, a
  form that tracks what you typed. Example: `app/components/ConfirmButton.js`.
- **Server Actions** (files starting `"use server"`, mainly
  `app/actions.js`): functions you can call from a form or button that run
  *on the server*. This is how "add a bottle" works with no separate API.

> The lesson of the 2026-09-21 outage: if a Client Component (browser)
> imports something that touches a secret or the SDK, the page breaks in
> production while working in development. That is why `lib/anthropic.js`
> and `lib/prisma.js` start with `import "server-only"` - it turns the
> mistake into a failed build instead of a broken page.

### The folders

| Path | What lives there |
|---|---|
| `app/` | The pages and everything the browser reaches. A folder is a URL: `app/(owner)/inventory/` is `/inventory`. |
| `app/(owner)/` and `app/(guest)/` | **Route groups**: the parentheses mean "organize, but don't put it in the URL". Each group has its own `layout.js` (the frame around its pages). `(owner)` is the Cellarmaster side; `(guest)` is the read-only Guest view. |
| `app/(owner)/layout.js` | **The front door.** Checks you are signed in (else `/signin`) and sends Guests to `/guest`. One check covers every owner page. |
| `app/actions.js` | Nearly every write and every Claude call (about 3,000 lines): the *back end* in one file. |
| `app/api/` | Two plain HTTP endpoints: `auth` (sign-in plumbing) and `research/step` (see §6). |
| `app/components/` | Reusable pieces of screen: lists, forms, panels, icons. |
| `lib/` | Logic with no screen: rules, helpers, the AI "door", the database client. Small files, one idea each (e.g. `wine-colors.js`, `drink-window.js`). |
| `prisma/` | `schema.prisma` (the shape of the database) and `migrations/` (every change to it, in order). |
| `scripts/` | Tests and tools that are not part of the running app. |
| `public/` | Static files the browser fetches as-is. |
| `.github/workflows/` | The automatic check run on every push. |
| Root docs | `README.md` (what it does), `PROJECT.md` (why), `BACKLOG.md` (what was decided and what is open), `FUTURE_CAPABILITIES.md` (bigger plans), `AGENTS.md`/`CLAUDE.md` (rules for the AI), this file. |

Other things worth recognising: **Tailwind CSS** styles everything with short
class names written straight in the markup; `app/manifest.js` is what lets the
site be added to a home screen like an app (**PWA**, `display: standalone`);
`loading.js` shows a skeleton while a page's data loads; `error.js` is the
page shown when something throws.

**Check yourself**

1. A button needs to expand a row when tapped. Server or client component?
2. Where would you look for "what happens when I tap Delete"?
3. What does a folder named `(owner)` do to the URL?
4. Why must a secret never be imported into a client component?
5. Which file decides whether you are allowed to see any owner page?

<details><summary>Answers</summary>

1. Client - it reacts to the browser. (`"use client"` at the top.)
2. `app/actions.js` (the Server Action), found by following the form's
   `action=` from the component.
3. Nothing - parentheses organize files without appearing in the URL.
4. Client code is sent to every visitor's browser; anything in it is public.
   (And the Anthropic SDK throws on construction in a browser.)
5. `app/(owner)/layout.js`.
</details>

---

## 4. The data

### What the database holds

A **database** is organized tables of rows. Each table below is a **model** in
`prisma/schema.prisma`, which **Prisma** turns into code you can query.

| Model | One row is… |
|---|---|
| `Domaine` | A *cellar and its household*: name, motto, monthly AI limits. The unit of sharing. |
| `User` | A person's account: role, whether they are the app owner. Belongs to one Domaine. |
| `Invite` | A reserved place: an email address plus what it grants. |
| `Account`, `Session`, `VerificationToken` | Auth.js's own bookkeeping (which Google identity, who is signed in, one-time email links). |
| `Bottle` | A *wine*, not a physical bottle: producer, vintage, grape, region, quantity, status, drinking window… |
| `BottlePhoto`, `TastingNote` | Photos and tasting notes attached to a bottle. |
| `TastingFlight`, `FlightPick` | A saved tasting queue and its ordered bottles. |
| `SavedPairing`, `PairingPick` | A kept Suggest result for a dish or menu; each wine (pick) can be decided Drink or Hold, and is undecided (NULL) until it is; the pairing can be planned for a day (`plannedFor`, a calendar day, NULL = not planned). |
| `Guest`, `Favorite` | A Guest member's shortlist of bottles. |
| `DrinkWindowEstimate` | A *cache*: "we asked Claude about this exact wine before, here is the answer". |
| `ResearchProposal`, `ResearchJob` | What Research found (waiting for your review); and a bulk run's queue. |
| `UsageEvent` | One row per Claude call: model, tokens, cost. The AI *ledger*. |

### Ideas worth being able to say out loud

- **Migration**: a numbered, hand-written SQL file recording one change to
  the database's shape. Applied in order, never edited after they have run
  (you add a new one instead). The build runs them automatically
  (`npm run build` = `prisma migrate deploy && next build`).
- **Relation / foreign key**: how rows point at each other (`Bottle.domaineId`
  names its Domaine). **Cascade** means deleting the parent deletes the
  children.
- **Null means "unknown", never a guess.** A bottle with no drinking window
  has *null* in those columns, not a made-up year. A lot of the design follows
  from refusing to blur "not recorded" with "recorded as nothing".
- **Status** (`inventory` / `wishlist` / `consumed`) decides which screen a
  bottle appears on. Dates like `acquiredAt` and `emptiedAt` are *derived
  when status changes* (`lib/bottle-dates.js`) so they can never claim
  something untrue.
- **Constraints**: rules the database itself enforces (a unique email; a
  hard stop that is never below the cap). The database refuses bad rows even
  if the code has a bug.
- **Vocabularies live in one list.** `WINE_COLORS`, `ROLE`, `ACCESS`,
  `FEATURE`: one definition, imported everywhere, with a test that fails if a
  raw copy of the word reappears.
- **Export** (`/export`) is your backup: everything a person typed, as JSON.

### Who sees what: Domaines

The biggest design idea in the app. **A cellar belongs to a Domaine, not to a
person.** A Domaine has one or more members; each is a **Cellarmaster** (full
access) or a **Guest** (browse and favorite). An invite can add someone to
*your* Domaine or give them a **separate** one of their own.

- **Scoping.** `lib/scoped-prisma.js` wraps the database client so every
  query for bottles, flights and pairings is automatically filtered to the
  signed-in person's Domaine, and Guests are refused entirely. About a
  hundred call sites get this for free; none can forget it.
- **The app owner** is the one account flagged `User.isAppOwner`. It is the
  only one that sees `/usage` and sets other Domaines' AI limits. It cannot
  be demoted or removed from the app.
- **Invite-only.** Signing in with an unlisted email is refused
  (`lib/invite-policy.js`). The invite list *is* the security boundary.

**Check yourself**

1. Is a `Bottle` row a physical bottle? Why does that matter for "Tasted
   one - 5 left"?
2. Why is a migration never edited after it has been applied?
3. A bottle's drinking window is empty. What is stored, and why not 0?
4. Two friends are Cellarmasters in the same Domaine. Can one see the other's
   private notes? Who can see neither's cellar?
5. What stops a coding mistake from showing one Domaine's bottles to another?
6. What is a *cache*, and which model in this app is one?

<details><summary>Answers</summary>

1. No - it is a *wine* with a `quantity`. Tasting one decrements the count;
   the row only moves to "tasted" when the last is gone.
2. Other databases (production!) have already run it. Editing history would
   make them disagree with the file; a new migration moves everyone forward
   together.
3. `null` - "unknown". Zero (or a guessed year) would claim something false,
   and every screen treats a missing window differently from a set one.
4. They share one cellar (that is what a Domaine is); there is no
   per-person privacy inside it. Someone in a *different* Domaine sees neither.
5. The scoped client (`lib/scoped-prisma.js`) adds the Domaine filter to
   the query itself, so no call site can forget it. (It is enforced in the
   app's code, not by the database - which is one reason it is tested and
   reviewed so carefully.)
6. A stored answer reused instead of recomputed (`DrinkWindowEstimate`:
   asking Claude about the same wine twice costs money; the second time is
   free).
</details>

---

## 5. Signing in and who you are

- **Auth.js** (`next-auth` v5, in `lib/auth.js`) handles sign-in. Two
  doors: **Google OAuth** and an emailed **magic link** (Resend). Either
  alone is enough.
- **OAuth in one sentence:** instead of the app storing passwords, Google
  confirms "this person controls this email" and tells the app. You register
  the app with Google (Cloud Console) and get a **client ID** and a
  **client secret**; **redirect URIs** are the only addresses Google is
  allowed to send people back to.
- **Database sessions**: when you sign in, a `Session` row is created and a
  cookie holds only its random key. Removing someone's `User` row signs them
  out on their next request. (The alternative, a self-contained signed token,
  could not be revoked so immediately.)
- **Accounts can be switched off.** Without `AUTH_SECRET` and a provider, the
  app runs open with one owner. That was deliberate: it let the sign-in code be
  deployed and watched before it changed anything, so a half-configured deploy
  could not lock you out.
- **Authentication vs authorization.** *Who are you?* (sign-in) is different
  from *what may you do?* (role, Domaine, the app-owner flag). Both are
  checked on the server every time - hiding a button is not security.

**Check yourself**

1. What does Google actually give the app when you sign in?
2. Someone is removed from the Domaine. When does their access end?
3. Why is "the button is hidden for Guests" not enough protection?
4. What is the difference between being *authenticated* and *authorized*?

<details><summary>Answers</summary>

1. A confirmation of identity (a verified email and name), never a password.
2. On their next request: sessions are rows in the database and the removal
   deletes them.
3. Anyone can call a Server Action directly. The server (the scoped client,
   `currentCellarmaster()`) must refuse on its own.
4. Authenticated = we know who you are. Authorized = you are allowed to do
   this particular thing.
</details>

---

## 6. The AI layer

This is where most of the interesting decisions are.

### What Claude does here

| Feature | Route | What it asks Claude |
|---|---|---|
| **Scan** | `/scan` | Read a label or shop sheet photo into bottle fields. |
| **Suggest** | `/suggest` | Browse your cellar and recommend wines for a dish or theme. |
| **Research** | `/research` | Web-search an uncertain bottle and *propose* corrections. |
| **Estimate windows** | `/estimate-windows`, a bottle's own page | Guess a drinking window from general knowledge. |
| **Photo details** | a bottle's "add photo" | Read details off an extra photo. |

### How it is built

- **One door.** Every call goes through `aiAccess()` in `lib/usage.js`. It
  checks the Domaine's allowance, picks the model, makes the call, and
  records the cost. No other file talks to Claude directly - so a rule about
  AI spending can be enforced in exactly one place.
- **Tools, not free text.** Each call gives Claude a **tool** with a strict
  **schema** (`strict: true`): the answer must be a structured object with
  named fields, so the app can *use* it instead of parsing prose. For Suggest
  there are two tools: `browse_cellar` (Claude reads your actual cellar) and
  `record_suggestions` (the final answer). Their definitions are shared in
  `lib/suggest-prompt.js`.
- **The loop.** Suggest and Scan can need several turns (browse, think, answer);
  the code loops a bounded number of times so a confused model cannot run
  forever.
- **Models and tiers** (`lib/ai-models.js`): *reasoning* work (Suggest's
  "sommelier" depth) runs on the heaviest model; *extraction* work (reading,
  researching, estimating) on a mid-tier one. The lighter tier is **Haiku**.
  `requestShape()` is the single function that turns "I need extraction work"
  into a concrete model plus the right request fields.
- **Tokens and cost.** Claude is billed by **tokens** (roughly word-pieces),
  input and output priced separately. The ledger (`UsageEvent`) stores cost in
  **micro-dollars** because a single call costs a fraction of a cent and
  rounding each to cents would add up to nothing.
- **Caps and the hard stop.** Each Domaine except the owner's has a monthly
  **cap** (default $5): past it, Suggest and Research drop one model tier
  rather than stopping. Past the **hard stop** (default $15, a runaway guard)
  everything pauses until the 1st (UTC). **Held features:** Scan and the
  drinking-window estimators stay on their normal model past the cap, because
  their answers are saved *without anyone checking them* - a cheaper model's
  mistakes would become bad data (`HELD_FEATURES`, `lib/usage-features.js`).
- **Honest uncertainty.** An estimated drinking window is flagged
  `drinkWindowEstimated` and shown as an estimate everywhere; Research
  *proposes* and you review a field-by-field diff; the Suggest prompt forbids
  quoting an estimate back as fact. A **plausibility check** refuses an
  absurd answer before it is saved.
- **Long jobs.** "Research all" can take longer than one request is allowed
  to run. So the queue is a **database row** (`ResearchJob`); each *step*
  does what it can, saves its progress, then asks the app (an HTTP call to
  `app/api/research/step`) to run the next step, guarded by a per-job
  **token**. `after()` lets the server keep working after it has replied.
  Result: no ceiling on run length, and progress that survives you closing the
  tab.
- **Prompt caching.** Resending the same long instructions each turn is
  wasteful; marking them cacheable makes repeats cheaper. (It only helps above
  a model-specific minimum length.)

### Honest limits of what we know

Scan, Research and Haiku's quality have been tested against a *stub* (a fake
Claude that returns fixed answers) and **not yet measured against the real
API** at the time of writing. A stub proves the plumbing works; it says
nothing about whether a model reads labels well. That distinction -
*mechanics verified* vs *quality measured* - is worth keeping sharp.

**Check yourself**

1. Why does every Claude call go through one function?
2. What does `strict: true` on a tool buy you?
3. A Domaine passes its cap. What changes for Suggest? For Scan? Why the
   difference?
4. Why is cost stored in micro-dollars?
5. "Research all" is on bottle 40 of 90 and you close the app. What happens?
6. What is the difference between "the code works" and "the model is good at
   it"?
7. What is a token?

<details><summary>Answers</summary>

1. So spending rules (caps, the hard stop, the ledger) are enforced in one
   place instead of six that could disagree.
2. The reply is guaranteed to be an object of the declared shape, so code can
   read `input.picks` without defensive parsing.
3. Suggest runs one tier cheaper. Scan does not - it saves its results
   unreviewed, so its quality is protected until the hard stop.
4. A call costs a fraction of a cent; whole-cent rows would round to zero and
   the month's total would be wrong.
5. It carries on - the queue is a database row, and each step schedules the
   next. Reopening shows the true progress.
6. Code working means the request goes out and the answer is handled safely.
   Model quality means the answers are *right* - only measuring real outputs
   against known-correct ones shows that.
7. The unit Claude reads and writes (a word fragment); both directions are
   billed per token.
</details>

---

## 7. How changes are made safely

- **Branches.** Work happens on a branch (`claude/great-meitner-j2tbow`),
  separate from `main`, which production builds from. `vercel.json` lets Vercel
  deploy only those two - other branches would each leave a retained
  deployment behind and the free plan has a storage cap.
- **Build vs dev.** `next dev` is a forgiving workshop; `next build` +
  `next start` is how production actually runs. **They differ**, and things
  that work in dev can fail in production. So the rule in `AGENTS.md`:
  *`npm run verify` before you say it works.*
- **`npm run verify`** runs, in order: eleven unit checks (the sign-in policy,
  usage arithmetic, AI guards, constants, pairings, lot fields, cellar overview,
  the recycle bin, print cards, the digest, CSV import; `npm run test:policy`
  runs just these), lint, a production build,
  starts the built app, then opens all 19 pages in a real browser and fails on
  any error. The same runs on GitHub on every push (`verify.yml`), against an
  *empty* database on purpose: the bugs a full database hides are the
  empty-state ones.
- **Lint** is an automatic style-and-mistake checker (`eslint`). **A unit
  test** checks one small rule in isolation. A **smoke test** just opens
  everything and checks nothing is on fire.
- **A stub** is a stand-in for something expensive or external (a fake
  Anthropic server) so behaviour can be tested without real spend.
- **Comments explain *why*.** In this codebase, a comment that merely says
  what the code does is noise; the valuable ones record a decision, a
  failure that happened, or a trap. `BACKLOG.md` is the same idea at project
  scale: a numbered log of what was decided and why.
- **Review agents.** Specialist reviewers (`.claude/agents/`) read changes
  for AI quality, data design, doc accuracy and usability. They report;
  they do not edit.

**Check yourself**

1. Why isn't "it works in `next dev`" good enough?
2. Why does CI test against an *empty* database?
3. You ask for a change and Claude says "done". What should you ask next?
4. What is the point of a stub?

<details><summary>Answers</summary>

1. Dev assembles things differently from production; a whole page once
   shipped broken because only dev had been checked.
2. Because empty-state bugs (a page that assumes at least one row) are the ones
   a developer with a full cellar never sees.
3. "Did you run `npm run verify`, and what did it say?" - and whether the
   tested thing was the real path or a stub.
4. To test the app's behaviour without cost or dependence on the outside
   world - at the price of not testing the outside world itself.
</details>

---

## 8. Design principles this app keeps repeating

If you can state these, you understand the *taste* of the project, which
matters more than any single file.

1. **Degrade honestly.** Missing a key or a service means a clear message and
   everything else keeps working - never a crash.
2. **Unknown is not zero.** Missing data stays visibly missing.
3. **Show estimates as estimates.** A guess is never allowed to look like a
   fact, on any screen.
4. **A person reviews what AI proposes** - except where a review would be
   impractical, and there the model is held to the stronger one.
5. **One place per fact.** One list per vocabulary, one door for AI, one
   scoped client for data; then a test that fails if someone bypasses it.
6. **Make the mistake impossible, not unlikely.** `server-only`, database
   constraints, the scoped client: guards in the machinery, not reminders in
   a document.
7. **Write down why.** Decisions, reversals and bugs are logged so the next
   person (or session) does not re-derive or repeat them.
8. **Verify the real thing.** Build it like production, open it like a user,
   and say plainly what was *not* tested.
9. **Small reversible steps; ask before anything outward-facing or
   destructive.**

**Check yourself:** pick any feature you use and name two of these
principles it follows. (Weak spot if you cannot.)

---

## 9. Vocabulary

Grouped, with plain definitions. Test yourself by covering the right-hand
column.

### The web

| Term | Meaning |
|---|---|
| **Browser** | The program on your phone that displays pages. |
| **Server** | A computer that answers requests; here, Vercel's. |
| **Request / response** | The browser asks for something; the server replies. Every tap that loads anything is one. |
| **HTTP** | The language requests and responses are written in. |
| **URL / route** | The address; the part after the domain (`/inventory`) is the *route*. |
| **HTML / CSS / JavaScript** | Structure / appearance / behaviour of a page. |
| **Cookie** | A small value the browser sends back on every request; holds your session key. |
| **API** | A defined way for one program to ask another for things (Anthropic's API, our `research/step` endpoint). |
| **Endpoint** | One address on an API. |
| **Environment variable** | A named setting supplied from outside the code (keys, URLs). |
| **PWA** | A website installable on the home screen and launching full-screen. |
| **Deploy** | Building a version and putting it live. |
| **Production vs development** | The live site vs your working copy. |
| **Cache** | A stored answer reused instead of recomputed. |

### The framework and code

| Term | Meaning |
|---|---|
| **Next.js** | The framework this app is built with: pages, routing, server and browser code in one project. |
| **React** | The library that builds screens out of reusable components. |
| **Component** | A reusable piece of screen. |
| **Server / Client component** | Runs on the server / in the browser. |
| **Server Action** | A server function called straight from a form or button. |
| **Route group** | A folder in parentheses: organizes files, invisible in the URL. |
| **Layout** | The frame wrapping a set of pages. |
| **Hook** | A React function that gives a component memory or behaviour (`useState`). |
| **State** | What a component remembers between taps. |
| **Module / import** | A file, and the statement that pulls something from another file. |
| **Dependency / package / `npm`** | Code written by others that we use / the tool that installs it. `package.json` lists them. |
| **Tailwind** | Styling by short classes in the markup. |
| **Lint** | Automatic checking for mistakes and style. |
| **Build** | Turning source into the optimized files production serves. |
| **Bundle** | The files sent to the browser; keeping it small matters. |
| **Refactor** | Reorganizing code without changing what it does. |
| **Regression** | Something that used to work, broken by a later change. |
| **Idempotent** | Doing it twice has the same effect as once. |
| **Race condition** | Two things at once producing a result neither alone would. |
| **Stub / mock** | A fake stand-in used for testing. |
| **Smoke test** | A fast "does everything at least open?" check. |

### Data

| Term | Meaning |
|---|---|
| **Database / table / row / column** | Organized storage; a kind of thing; one thing; one fact about it. |
| **Postgres** | The database program itself. |
| **SQL** | The language databases are asked things in. |
| **Prisma / ORM** | A tool that lets code talk to the database as objects instead of raw SQL. |
| **Schema** | The declared shape of the database. |
| **Migration** | A recorded, ordered change to the schema. |
| **Foreign key / relation** | A column pointing at another table's row. |
| **Cascade** | Deleting a parent removes its children. |
| **Constraint** | A rule the database enforces itself. |
| **Index** | A lookup shortcut so queries stay fast as data grows. |
| **Transaction** | A group of changes that succeed or fail together. |
| **Serializable** | The strictest transaction mode; used where two people clicking at once must not both win. |
| **Null** | "No value / unknown" - not zero, not blank. |
| **Seed** | Starting data put in for testing. |
| **Scoping** | Automatically limiting queries to one Domaine's rows. |

### Accounts and access

| Term | Meaning |
|---|---|
| **Authentication / authorization** | Who you are / what you may do. |
| **OAuth** | "Sign in with Google": a trusted third party vouches for you. |
| **Redirect URI** | The only addresses Google may send you back to. |
| **Magic link** | A one-time sign-in link sent by email. |
| **Session** | The server's record that you are signed in. |
| **Role** | What a member can do: Cellarmaster or Guest. |
| **Domaine** | A cellar and the people who share it. |
| **App owner** | The one flagged account that runs the app and sets AI limits. |
| **Invite-only** | Only listed emails can sign in. |
| **IDOR** | Letting someone reach another's data just by changing an id in a request; the scoped client exists to prevent it. |

### AI

| Term | Meaning |
|---|---|
| **Model** | A particular Claude (Opus, Sonnet, Haiku): bigger is slower and dearer. |
| **Tier** | Which class of model a kind of work needs. |
| **Token** | The unit Claude reads, writes and is billed in. |
| **Prompt / system prompt** | The instructions and question sent to the model / the standing instructions. |
| **Tool / tool use** | A function the model may call; how it returns structured answers. |
| **Schema (tool)** | The exact shape the answer must have. |
| **Thinking / effort** | How much the model deliberates before answering. |
| **Hallucination** | The model stating something confidently untrue. |
| **Prompt caching** | Cheaper reuse of repeated instructions. |
| **Web search tool** | Lets the model look things up live (Research). |
| **Ledger** | The running record of every call's cost. |
| **Cap / hard stop** | The soft limit that downgrades the model / the hard limit that pauses AI. |
| **Held (feature)** | One kept on its normal model past the cap. |
| **Eval** | Measuring a model on known cases to see how good it really is. |

### This project's own words

| Term | Meaning |
|---|---|
| **Cellarmaster** | A member with full access (and the app's name). |
| **Guest** | A member who can browse and favorite. |
| **Flight** | A saved tasting queue of bottles. |
| **Pairing** | A kept Suggest result for a dish. |
| **Drinking window** | The years a wine is at its best (`drinkFrom`–`drinkTo`). |
| **Estimated window** | A window the app guessed, always labelled as such. |
| **Bottling** | A producer's named wine (vineyard or cuvée). |
| **Proposal** | A change Research suggests, awaiting your review. |
| **Research job / step** | A bulk run, and one slice of it. |
| **Smoke / verify** | The production-style test run. |
| **BACKLOG #n** | A numbered entry in the decision log. |

---

## 10. A harder self-test: scenarios

No hints. Answer each in a few sentences, then check.

1. **Your friend (a Guest) says they can see your bottles but can't favorite
   anything.** Walk through where you would look.
2. **The Anthropic charge this month is $40, not $10.** Which three places
   could tell you why, and what controls would have limited it?
3. **You want a new field "Closure" (cork / screwcap) on each bottle.** List
   every layer that must change.
4. **A page shows an error only on the live site, never on your machine.**
   What is your first suspicion, and what do you run?
5. **Someone you invited reports "access denied" on Google sign-in.** Give
   three possible causes.
6. **You are asked: "is Haiku good enough for label reading?"** What do you
   say, and what would it take to answer?

<details><summary>Answers</summary>

1. `/invites` → their role (is it `guest`?). Then `resolveGuestView`
   (`lib/guest.js`) and the `Guest`/`Favorite` rows; then the favorite action
   in `app/actions.js`. Also check whether they signed in as the account you
   think they did.
2. Claude Console billing/usage; `/usage` in the app (per Domaine, per
   feature); the `UsageEvent` rows. Limits: each Domaine's cap and hard
   stop, plus a spend limit set in the Console itself. Note the app owner's
   own Domaine has no limit by design.
3. The `Bottle` model in `schema.prisma`; a new **migration**; the add/edit
   form (`BottleForm`); the Server Actions that read/write it; the Scan
   schema if Claude should fill it; list/detail displays; the export; any
   vocabulary list (a single shared list, per principle 5); the docs.
4. Dev vs production differences, often a client component importing
   something server-only. Run `npm run verify`.
5. Not on the invite list; the Google address differs from the invited one
   (dots, alias); the address is not on the Google OAuth "test users" list;
   or they picked the wrong Google account.
6. "Unknown." The mechanics are tested; quality is not. It takes real label
   photos with the correct answers written down, run through both models
   (Haiku vs the current one), and the fields compared.
</details>

---

## Gaps log

Fill this in after each self-test. Date it. Revisit the 1s and 2s.

| Date | Section | Score (1-3) | What I could not explain | Next step |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |

## Topics not covered yet (candidates to add)

Add or reorder freely, then ask for any of them to be written up:

- How **caching** works across the app (`unstable_cache`, `revalidatePath`,
  why the region list is cached)
- **Git** in depth: commits, branches, merging, what a pull request is
- **How a Server Action travels** from a button to the database and back
- **Reading a stack trace** and the logs in Vercel
- **CSS and Tailwind** fundamentals
- **TypeScript vs JavaScript** (this project uses JavaScript with a little TS
  config; what the difference means)
- **Prompt design** - what makes the Suggest and Scan prompts good or bad
- **Cost and capacity thinking** - what happens at 10 users? 100?
- **Security basics** beyond this app: secrets, injection, least privilege
- **Backups and recovery** - rehearse restoring from `/export`
- A guided tour: pick one feature and trace it from tap to database
- **Undo without a `deletedAt` column** - why deleted wines go to a snapshot
  table (`BottleTrash`) instead, and what restoring has to re-link
- **"Claim, then act"** - how a conditional UPDATE keeps two overlapping runs
  from both sending the digest email (and why a failed send puts it back)
- **A "lot" of bottles** - why size, place and price live on a row rather than
  on each bottle, and what that does to counting and totals

---

*Maintained by the same loop as the rest of the repo: change the code, update
the doc, and say what was not checked. If you find something here that is
wrong or confusing, that is the most valuable thing you can report.*
