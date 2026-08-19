import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function AdvisorLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-10 w-full" />
      <TableSkeleton />
    </div>
  );
}
