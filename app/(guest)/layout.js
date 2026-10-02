import { getGuestCellar, resolveGuestView } from "@/lib/guest";

// What a visiting guest sees: the cellar's own name and nothing else. No
// nav, because every other page in the app belongs to the Cellarmasters -
// a guest who could click "Cellar" would land in the editable view, which
// is not what "browse the cellar read-only" means.
//
// The cellar's name rather than the app's (BACKLOG #53): "Cellarmaster"
// across the top of a guest's screen named a role they don't have.
// Falls back to the app name only for a visitor the page is about to
// redirect anyway.
export default async function GuestLayout({ children }) {
  const view = await resolveGuestView();
  const heading = view ? (await getGuestCellar(view.domaineId)).cellarName : "Cellarmaster";

  return (
    <>
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-3xl px-4 py-3 text-sm font-medium">{heading}</div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </>
  );
}
