import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const Processing = () => {
  const { id } = useParams();

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Processing</h1>
        <p className="text-sm text-muted-foreground">Analyzing your file...</p>
      </div>

      <Card className="border-border">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin mb-6" />
          <p className="text-sm font-semibold text-foreground mb-2">
            Analyzing file authenticity
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            This may take up to 30 seconds
          </p>
          <div className="w-full max-w-xs">
            <Progress value={33} className="h-2" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">Processing ID: {id}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Processing;
