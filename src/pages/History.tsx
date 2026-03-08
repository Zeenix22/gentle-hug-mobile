import { Clock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const History = () => {
  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analysis History</h1>
        <p className="text-sm text-muted-foreground">View your past analyses.</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search analyses..."
          className="pl-9"
        />
      </div>

      {/* Empty State */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">All Analyses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No analyses yet</p>
            <p className="text-xs text-muted-foreground/70">Your analysis history will appear here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default History;
