import { SkeletonHeader, SkeletonRows } from "@/app/components/Skeleton";

// The fallback for any route without a more specific loading.js of its own
// (Home, Research, Flights, Estimate windows). A route with one - the list
// pages, a bottle's detail page - uses that instead.
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <SkeletonHeader />
      <SkeletonRows count={3} />
    </div>
  );
}
