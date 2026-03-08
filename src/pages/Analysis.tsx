import { useParams } from "react-router-dom";
import { Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Analysis = () => {
  const { id } = useParams();

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analysis Results</h1>
        <p className="text-sm text-muted-foreground">Analysis ID: {id}</p>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Authenticity Score</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center py-8">
          <Shield className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">Analysis results will appear here</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Analysis;
