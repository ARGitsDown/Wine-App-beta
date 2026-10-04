"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

function subscribe(callback) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

// navigator.onLine is only trustworthy in one direction: false really is "no
// network"; true can still be a dead connection. So this reacts to false, and a
// write that fails on a connection it thought was up still reaches the error
// screen it always did.
const useOffline = () =>
  useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false
  );

// Controls that only look at what is already on the screen, so they keep
// working offline: anything that opens or closes something (aria-expanded),
// a filter toggle (aria-pressed), a "Cancel", and anything marked
// data-offline-ok. Every other button is a write or a navigation.
const READ_ONLY = "[aria-expanded], [aria-pressed], [data-offline-ok], summary";

// The app installs to the home screen and is used in cellars and basements
// with no signal. A save from there used to throw out of the server action and
// land on the "That didn't work" screen, taking whatever was unsaved with it.
// While the device reports no network this says so, and refuses the writes
// before they are sent: form submissions are cancelled and so are the buttons
// that call an action directly, with a nudge on the banner explaining why.
// Nothing is queued - a change made offline is not made, and the banner says
// so rather than pretending otherwise. Reading what is already loaded works.
export default function OfflineGuard() {
  const offline = useOffline();
  const [nudge, setNudge] = useState(0);

  useEffect(() => {
    if (!offline) return undefined;
    document.documentElement.dataset.offline = "true";

    function refuse(event) {
      event.preventDefault();
      event.stopPropagation();
      setNudge((n) => n + 1);
    }
    function onClick(event) {
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      if (!button || button.closest(READ_ONLY) || button.type === "reset") return;
      // A button inside a form is either a control for the form (stars, a
      // Cancel) or its submit; the submit is refused by the listener above,
      // so the click itself is left alone.
      if (button.form) return;
      refuse(event);
    }
    document.addEventListener("submit", refuse, true);
    document.addEventListener("click", onClick, true);
    return () => {
      delete document.documentElement.dataset.offline;
      document.removeEventListener("submit", refuse, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [offline]);

  if (!offline) return null;
  return (
    <div
      role="status"
      key={nudge}
      className={`sticky top-0 z-50 border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 print:hidden dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200 ${
        nudge > 0 ? "font-medium" : ""
      }`}
    >
      {nudge > 0
        ? "Can’t save while you’re offline. Nothing was changed."
        : "You’re offline. What’s already open still reads; changes can’t be saved until you’re back."}
    </div>
  );
}
