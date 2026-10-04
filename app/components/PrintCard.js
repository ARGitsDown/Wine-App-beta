import BackButton from "@/app/components/BackButton";
import PrintButton from "@/app/components/PrintButton";

// The sheet a printed card is made of: a title, an optional line under it, and
// whatever the caller lays out. The owner nav and tab bar are hidden when
// printing (print:hidden in the layout), and text is forced dark: in dark
// mode the page's text is near-white, which would print as nothing on paper.
export default function PrintCard({ backHref, title, subtitle, note, children }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 print:max-w-none print:gap-5 print:p-0">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <BackButton fallbackHref={backHref} />
        <PrintButton />
      </div>
      <article className="flex flex-col gap-5 rounded-lg border border-zinc-200 p-6 text-zinc-900 print:rounded-none print:border-0 print:p-0 print:text-black dark:border-zinc-800 dark:text-zinc-100">
        <header className="flex flex-col gap-1 border-b border-zinc-300 pb-3 print:border-black">
          <h1 className="text-2xl font-semibold print:text-3xl">{title}</h1>
          {subtitle && <p className="text-sm text-zinc-600 print:text-black dark:text-zinc-400">{subtitle}</p>}
        </header>
        {children}
        {note && <p className="text-xs text-zinc-500 print:text-zinc-700">{note}</p>}
      </article>
    </div>
  );
}
