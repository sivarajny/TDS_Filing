import { Skeleton, CardsSkeleton } from "@/components/ui/skeleton";

export default function NewTransactionLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Skeleton className="h-7 w-48" />
      <CardsSkeleton count={4} />
    </div>
  );
}
