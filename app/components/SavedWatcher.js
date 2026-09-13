"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

// A form's `pending` status (from useFormStatus) briefly goes true then
// false when a Server Action submission finishes - this watches for that
// transition to know the form's bottle was saved, without changing how
// BottleForm's action prop works anywhere else it's used. Must be rendered
// as a child of the form it's watching (useFormStatus reads the nearest
// parent form's status).
export default function SavedWatcher({ onSaved }) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) onSaved();
    wasPending.current = pending;
  }, [pending, onSaved]);

  return null;
}
