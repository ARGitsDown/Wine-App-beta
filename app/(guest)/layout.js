// What a visiting friend or family member sees: the cellar's name and
// nothing else. No nav, because every other page in the app belongs to the
// owner - a guest who could click "Cellar" would land in the owner's
// editable view, which is not what "browse the cellar read-only" means.
export default function GuestLayout({ children }) {
  return (
    <>
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-3xl px-4 py-3 text-sm font-medium">
          Wine Tracker
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </>
  );
}
