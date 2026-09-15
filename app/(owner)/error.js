"use client";

import ErrorScreen from "@/app/components/ErrorScreen";

// Deliberately here rather than only at the root: a boundary replaces
// everything it wraps, and the root one wraps this group's layout, so one
// failed page took the whole nav with it and left a single link as the only
// way anywhere. Caught at this level, the failure stays inside <main> and
// the app still looks like the app - every other screen is one tap away.
export default function OwnerError({ error, retry }) {
  return <ErrorScreen error={error} retry={retry} />;
}
