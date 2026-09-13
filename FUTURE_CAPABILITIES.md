# Future Capabilities Backlog

Bigger, architecturally significant features that are explicitly deferred —
not hygiene fixes to existing data (see [`BACKLOG.md`](./BACKLOG.md) for
those), but new capabilities that would reshape how the app is used. Add to
this list as new ones come up; move an item into an actual build (and
delete it from here) once it's picked up.

## Separate cellars per user

Today there's exactly one cellar, one inventory, one wishlist — the app
still assumes a single owner, per [`PROJECT.md`](./PROJECT.md)'s original
scope. [Guest favoriting](./README.md) (a friend/family member browsing
*your* inventory and shortlisting bottles for their next visit) is the
lightweight version of "other people use this app": no accounts, no
password, just a name — good enough for someone visiting your cellar, not
for someone who wants their own.

A real "everyone gets their own cellar" capability is a much bigger fork:

- **Real accounts.** A guest's name-only identity is intentionally
  low-stakes (see the `Guest` model's comment in `prisma/schema.prisma`) —
  anyone can type any name. An account that owns real data (your own
  inventory, wishlist, tasting notes) needs actual authentication.
- **Data ownership on every model.** `Bottle` and `TastingNote` would need
  an owner reference, and every query in `lib/bottles.js`, `app/actions.js`,
  and every page would need to filter by "whose data is this" instead of
  assuming there's only one cellar. Easy to get scoping wrong once in a
  dozen call sites and leak one person's bottles into another's view.
- **Migrating existing data.** Every `Bottle`/`TastingNote` row that exists
  today has no owner column — it'd need to become "mine" (the original
  user) as part of the same migration that adds ownership, not left
  orphaned.
- **What guests become.** Once real accounts exist, today's `Guest`/
  `Favorite` models either get folded into the account system or kept as
  the deliberately-lighter "browsing someone else's cellar" mode alongside
  it — worth deciding once accounts actually exist, not before.

Worth revisiting once guest favoriting has been used for a while and it's
clear people actually want their own cellars, not just a shortlist on
someone else's.
