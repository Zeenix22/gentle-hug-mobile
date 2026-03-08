import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Filter,
  Image,
  Video,
  FileText,
  ChevronRight,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import StatusBadge from "@/components/ui/status-badge";
import ErrorState from "@/components/ui/error-state";
import HistorySkeleton from "@/components/skeletons/HistorySkeleton";
import { mockAnalysisResults } from "@/data/mock-analyses";
import { getUserAnalyses, deleteAnalysis } from "@/services/analysis-service";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { AuthenticityLevel, FileType } from "@/types";
import { formatDistanceToNow } from "date-fns";

const fileTypeIcons: Record<string, typeof Image> = { image: Image, video: Video, document: FileText };

type FilterStatus = "all" | AuthenticityLevel;
type FilterFileType = "all" | FileType;

const statusFilters: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "authentic", label: "Authentic" },
  { value: "suspicious", label: "Suspicious" },
  { value: "manipulated", label: "Manipulated" },
];

const typeFilters: { value: FilterFileType; label: string; icon: typeof Image }[] = [
  { value: "all", label: "All", icon: Filter },
  { value: "image", label: "Images", icon: Image },
  { value: "video", label: "Videos", icon: Video },
  { value: "document", label: "Docs", icon: FileText },
];

interface NormalizedItem {
  id: string;
  fileName: string;
  fileType: FileType;
  authenticityLevel: AuthenticityLevel;
  confidenceScore: number;
  createdAt: string;
}

const History = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [typeFilter, setTypeFilter] = useState<FilterFileType>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [dbAnalyses, setDbAnalyses] = useState<any[]>([]);
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

  const allItems: NormalizedItem[] = useMemo(() => {
    if (dbAnalyses.length > 0) {
      return dbAnalyses.map((a: any) => ({
        id: a.id,
        fileName: a.file_name,
        fileType: a.file_type as FileType,
        authenticityLevel: (a.authenticity_level || "uncertain") as AuthenticityLevel,
        confidenceScore: a.confidence_score ?? 0,
        createdAt: a.created_at,
      }));
    }
    return mockAnalysisResults.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      fileType: a.fileType,
      authenticityLevel: a.authenticityLevel,
      confidenceScore: a.confidenceScore,
      createdAt: a.createdAt,
    }));
  }, [dbAnalyses]);

  const filtered = useMemo(() => {
    return allItems.filter((item) => {
      const matchesSearch = item.fileName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || item.authenticityLevel === statusFilter;
      const matchesType = typeFilter === "all" || item.fileType === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [allItems, searchQuery, statusFilter, typeFilter]);

  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (typeFilter !== "all" ? 1 : 0);

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Analysis History</h1>
        <p className="text-sm text-muted-foreground">{allItems.length} analyses total</p>
      </div>

      <div className="flex gap-2 animate-fade-in" style={{ animationDelay: "0.1s", opacity: 0 }}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search files..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Button
          variant={showFilters ? "default" : "outline"}
          size="icon"
          onClick={() => setShowFilters(!showFilters)}
          className="relative"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {showFilters && (
        <div className="space-y-3 animate-fade-in">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Status</p>
            <div className="flex gap-1.5 flex-wrap">
              {statusFilters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-all min-h-0 min-w-0 border",
                    statusFilter === f.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:border-primary/30"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">File Type</p>
            <div className="flex gap-1.5 flex-wrap">
              {typeFilters.map((f) => {
                const Icon = f.icon;
                return (
                  <button
                    key={f.value}
                    onClick={() => setTypeFilter(f.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all min-h-0 min-w-0 border flex items-center gap-1.5",
                      typeFilter === f.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:border-primary/30"
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {loading ? (
          <HistorySkeleton />
        ) : error ? (
          <ErrorState
            title="Couldn't load history"
            description="There was a problem fetching your analyses."
            onRetry={load}
          />
        ) : filtered.length === 0 ? (
          <Card className="border-border">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-3 mb-3">
                <Search className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No results found</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Try adjusting your search or filters</p>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 text-xs text-primary"
                  onClick={() => { setStatusFilter("all"); setTypeFilter("all"); setSearchQuery(""); }}
                >
                  Clear all filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filtered.map((item, index) => {
            const FileIcon = fileTypeIcons[item.fileType] || FileText;
            const timeAgo = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true });

            return (
              <Card
                key={item.id}
                className="border-border hover:border-primary/20 transition-all duration-200 cursor-pointer hover:shadow-sm animate-fade-in"
                style={{ animationDelay: `${0.05 * index}s`, opacity: 0 }}
                onClick={() => navigate(`/analysis/${item.id}`)}
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <div className={cn(
                    "flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center",
                    item.fileType === "image" ? "bg-primary/10 text-primary" :
                    item.fileType === "video" ? "bg-warning/10 text-warning" :
                    "bg-success/10 text-success"
                  )}>
                    <FileIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.fileName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StatusBadge status={item.authenticityLevel} size="sm" showIcon={false} />
                      <span className="text-[10px] text-muted-foreground">{item.confidenceScore}%</span>
                      <span className="text-[10px] text-muted-foreground">•</span>
                      <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <div className="pb-4" />
    </div>
  );
};

export default History;
