import { Skeleton, CardsSkeleton } from "@/components/ui/skeleton";

export default function PrefillLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Skeleton className="h-7 w-80" />
      <Skeleton className="h-10 w-full" />
      <CardsSkeleton count={5} />
    </div>
  );
}
