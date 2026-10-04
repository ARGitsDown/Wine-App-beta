"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// One "Done X · Undo" bar for the whole owner side, mounted in the layout so
// it survives what an action does to the page under it. Moving a wine to the
// Cellar removes its row from the Wishlist; deleting a wine removes its page;
// a component that owns its own "Undo" would unmount in the same render that
// made the Undo necessary. Anything that needs one calls
// useUndo()(message, undo), where undo is an async function returning
// { ok } or { error }.

const UndoContext = createContext(null);

// Long enough to read and reach for on a phone, short enough not to sit over
// the tab bar for the rest of the evening.
const SHOW_MS = 12000;

export function useUndo() {
  const show = useContext(UndoContext);
  // Outside the provider (a guest page, a test) there is simply no Undo.
  return show ?? (() => {});
}

export default function UndoProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
    setBusy(false);
  }, []);

  const show = useCallback(
    (message, undo) => {
      clearTimeout(timer.current);
      setBusy(false);
      setToast({ message, undo, error: null, key: Date.now() });
      timer.current = setTimeout(dismiss, SHOW_MS);
    },
    [dismiss]
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  async function runUndo() {
    if (!toast || busy) return;
    clearTimeout(timer.current);
    setBusy(true);
    let result;
    try {
      result = await toast.undo();
    } catch {
      result = { error: "Couldn't undo that. Please try again." };
    }
    if (result?.error) {
      // Keep the bar up with the reason: a failed undo that vanishes reads as
      // a successful one.
      setBusy(false);
      setToast((prev) => (prev ? { ...prev, error: result.error } : prev));
      timer.current = setTimeout(dismiss, SHOW_MS);
      return;
    }
    dismiss();
  }

  return (
    <UndoContext.Provider value={show}>
      {children}
      {toast && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg sm:bottom-6 dark:bg-zinc-100 dark:text-zinc-900"
        >
          <span className="min-w-0 flex-1">{toast.error ?? toast.message}</span>
          {!toast.error && toast.undo && (
            <button
              type="button"
              onClick={runUndo}
              disabled={busy}
              className="min-h-11 shrink-0 px-2 font-medium underline underline-offset-2 disabled:opacity-50"
            >
              Undo
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            data-offline-ok
            aria-label="Dismiss"
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-lg leading-none opacity-70"
          >
            &times;
          </button>
        </div>
      )}
    </UndoContext.Provider>
  );
}
