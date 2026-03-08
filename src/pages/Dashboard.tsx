import { useNavigate } from "react-router-dom";
import { Upload, Clock, BarChart3, ArrowRight, Image, Video, FileText, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatusBadge from "@/components/ui/status-badge";
import { mockAnalysisResults } from "@/data/mock-analyses";
import { formatDistanceToNow } from "date-fns";

const fileTypeIcons = { image: Image, video: Video, document: FileText };

const Dashboard = () => {
  const navigate = useNavigate();
  const recentAnalyses = mockAnalysisResults.slice(0, 3);

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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 animate-fade-in" style={{ animationDelay: "0.15s", opacity: 0 }}>
        {[
          { label: "Total", value: String(mockAnalysisResults.length), icon: BarChart3 },
          { label: "Authentic", value: String(mockAnalysisResults.filter(a => a.authenticityLevel === "authentic").length), icon: Image },
          { label: "Flagged", value: String(mockAnalysisResults.filter(a => a.authenticityLevel !== "authentic").length), icon: Clock },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="border-border">
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

      {/* Recent Analyses */}
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
          {recentAnalyses.map((item) => {
            const FileIcon = fileTypeIcons[item.fileType];
            return (
              <div
                key={item.id}
                onClick={() => navigate(`/analysis/${item.id}`)}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:border-primary/20 transition-all cursor-pointer hover:shadow-sm"
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
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
