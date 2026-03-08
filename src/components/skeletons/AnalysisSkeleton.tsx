import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

const AnalysisSkeleton = () => (
  <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
    <div className="flex items-center gap-3">
      <Skeleton className="h-9 w-9 rounded-md" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>

    <Card className="border-border">
      <CardContent className="flex flex-col items-center py-6">
        <Skeleton className="h-28 w-28 rounded-full mb-4" />
        <Skeleton className="h-7 w-28 rounded-full" />
        <Skeleton className="h-3 w-48 mt-3" />
        <Skeleton className="h-3 w-40 mt-1" />
      </CardContent>
    </Card>

    <div className="flex gap-3">
      <Skeleton className="h-10 flex-1 rounded-md" />
      <Skeleton className="h-10 flex-1 rounded-md" />
    </div>

    <div className="space-y-2">
      <Skeleton className="h-4 w-32 mb-3" />
      {[1, 2, 3].map((i) => (
        <Card key={i} className="border-border">
          <CardContent className="p-3 space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-4 w-12 rounded-full" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

export default AnalysisSkeleton;
