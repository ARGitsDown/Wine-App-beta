import { SkeletonHeader, SkeletonLine } from "@/app/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <div className="flex items-center gap-4">
        <SkeletonLine className="h-24 w-20 shrink-0 rounded" />
        <SkeletonHeader />
      </div>
      <SkeletonLine className="h-64 w-full rounded-lg" />
      <SkeletonLine className="h-32 w-full rounded-lg" />
    </div>
  );
}
