import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Clock, BarChart3, ArrowRight, Image, Video, FileText, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatusBadge from "@/components/ui/status-badge";
import ErrorState from "@/components/ui/error-state";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import { mockAnalysisResults } from "@/data/mock-analyses";
import { getUserAnalyses } from "@/services/analysis-service";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

const fileTypeIcons: Record<string, typeof Image> = { image: Image, video: Video, document: FileText };

interface AnalysisRow {
  id: string;
  file_name: string;
  file_type: string;
  authenticity_level: string | null;
  confidence_score: number | null;
  created_at: string;
  status: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dbAnalyses, setDbAnalyses] = useState<AnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    if (user) {
      try {
        const data = await getUserAnalyses();
        setDbAnalyses(data);
      } catch {
        setError(true);
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <DashboardSkeleton />;

  const hasRealData = dbAnalyses.length > 0;
  const allItems = hasRealData
    ? dbAnalyses.map((a) => ({
        id: a.id,
        fileName: a.file_name,
        fileType: a.file_type as "image" | "video" | "document",
        authenticityLevel: (a.authenticity_level || "uncertain") as any,
        confidenceScore: a.confidence_score ?? 0,
        createdAt: a.created_at,
      }))
    : mockAnalysisResults.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        fileType: a.fileType,
        authenticityLevel: a.authenticityLevel,
        confidenceScore: a.confidenceScore,
        createdAt: a.createdAt,
      }));

  const recentAnalyses = allItems.slice(0, 3);
  const totalCount = allItems.length;
  const authenticCount = allItems.filter((a) => a.authenticityLevel === "authentic").length;
  const flaggedCount = totalCount - authenticCount;

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Welcome back! Here's your overview.</p>
      </div>

      <Button
        onClick={() => navigate("/upload")}
        variant="trust"
        className="w-full gap-2 font-semibold h-12 animate-fade-in"
        size="lg"
        style={{ animationDelay: "0.1s", opacity: 0 }}
      >
        <Upload className="h-5 w-5" />
        Upload New File
      </Button>

      {error ? (
        <ErrorState
          title="Couldn't load analyses"
          description="There was a problem fetching your data."
          onRetry={load}
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 animate-fade-in" style={{ animationDelay: "0.15s", opacity: 0 }}>
            {[
              { label: "Total", value: String(totalCount), icon: BarChart3 },
              { label: "Authentic", value: String(authenticCount), icon: Image },
              { label: "Flagged", value: String(flaggedCount), icon: Clock },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="border-border hover-scale">
                  <CardContent className="p-3 text-center">
                    <div className="rounded-lg bg-primary/10 p-1.5 inline-flex mb-1.5">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="border-border animate-fade-in" style={{ animationDelay: "0.2s", opacity: 0 }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                Recent Analyses
                <Button variant="ghost" size="sm" onClick={() => navigate("/history")} className="text-xs gap-1 text-primary h-8 min-h-0">
                  View All <ArrowRight className="h-3 w-3" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              {recentAnalyses.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <div className="rounded-full bg-muted p-3 mb-3">
                    <Upload className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No analyses yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Upload a file to get started!</p>
                </div>
              ) : (
                recentAnalyses.map((item, index) => {
                  const FileIcon = fileTypeIcons[item.fileType] || FileText;
                  return (
                    <div
                      key={item.id}
                      onClick={() => navigate(`/analysis/${item.id}`)}
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:border-primary/20 transition-all cursor-pointer hover:shadow-sm animate-fade-in"
                      style={{ animationDelay: `${0.25 + index * 0.05}s`, opacity: 0 }}
                    >
                      <div className={cn(
                        "flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center",
                        item.fileType === "image" ? "bg-primary/10 text-primary" :
                        item.fileType === "video" ? "bg-warning/10 text-warning" :
                        "bg-success/10 text-success"
                      )}>
                        <FileIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{item.fileName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <StatusBadge status={item.authenticityLevel} size="sm" showIcon={false} />
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Dashboard;
