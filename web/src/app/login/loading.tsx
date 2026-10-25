import { Skeleton } from "@/components/ui/skeleton";

export default function LoginLoading() {
  return (
    <div className="grid min-h-screen place-items-center px-4" aria-label="Loading sign-in">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="mt-4 h-4 w-56" />
        <Skeleton className="mt-6 h-10 w-full" />
        <Skeleton className="mt-6 h-10 w-full rounded-full" />
      </div>
    </div>
  );
}
