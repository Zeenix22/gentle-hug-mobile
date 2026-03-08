import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const DashboardSkeleton = () => (
  <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
    <div>
      <Skeleton className="h-8 w-40 mb-2" />
      <Skeleton className="h-4 w-56" />
    </div>

    <Skeleton className="h-12 w-full rounded-lg" />

    <div className="grid grid-cols-3 gap-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="border-border">
          <CardContent className="p-3 flex flex-col items-center">
            <Skeleton className="h-8 w-8 rounded-lg mb-1.5" />
            <Skeleton className="h-6 w-10 mb-1" />
            <Skeleton className="h-3 w-12" />
          </CardContent>
        </Card>
      ))}
    </div>

    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-20" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-border">
            <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-4 w-4 flex-shrink-0" />
          </div>
        ))}
      </CardContent>
    </Card>
  </div>
);

export default DashboardSkeleton;
