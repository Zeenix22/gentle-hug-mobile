import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

const ErrorState = ({
  title = "Something went wrong",
  description = "We couldn't load the data. Please try again.",
  onRetry,
  className,
}: ErrorStateProps) => (
  <Card className={`border-destructive/20 ${className ?? ""}`}>
    <CardContent className="flex flex-col items-center justify-center py-10 text-center">
      <div className="rounded-full bg-destructive/10 p-3 mb-3">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-4 gap-2 text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
          Try Again
        </Button>
      )}
    </CardContent>
  </Card>
);

export default ErrorState;
