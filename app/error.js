"use client";

import ErrorScreen from "@/app/components/ErrorScreen";

// The outer net. A segment's own error.js does not wrap the layout it sits
// beside, so this is what catches a failure in the owner or guest layout
// itself - the research badge's database query, for one. Ordinary page
// failures are caught below this by app/(owner)/error.js, which keeps the
// nav on screen; by the time anything reaches here there is no chrome left
// to preserve anyway.
export default function Error({ error, retry }) {
  return <ErrorScreen error={error} retry={retry} />;
}
