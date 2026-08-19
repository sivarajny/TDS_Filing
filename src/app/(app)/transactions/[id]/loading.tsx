import { Skeleton, CardsSkeleton } from "@/components/ui/skeleton";

export default function TransactionDetailLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-72" />
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <CardsSkeleton count={3} />
    </div>
  );
}
