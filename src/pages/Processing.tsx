import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Loader2,
  Upload,
  ScanSearch,
  FileCheck2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AnimatedProgress from "@/components/ui/animated-progress";
import { getAnalysis } from "@/services/analysis-service";
import type { UploadedFile } from "@/types";

interface ProcessingStage {
  id: string;
  label: string;
  icon: typeof Upload;
  description: string;
}

const stages: ProcessingStage[] = [
  { id: "upload", label: "Uploading", icon: Upload, description: "Transferring files securely..." },
  { id: "metadata", label: "Extracting Metadata", icon: ScanSearch, description: "Reading EXIF data and file signatures..." },
  { id: "analysis", label: "AI Analysis", icon: FileCheck2, description: "Running deepfake and manipulation checks..." },
  { id: "report", label: "Generating Report", icon: CheckCircle2, description: "Compiling results and confidence scores..." },
];

const Processing = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const passedFiles = (location.state as { files?: UploadedFile[] })?.files;
  const analysisIds = (location.state as { analysisIds?: string[] })?.analysisIds;

  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);

  // Poll for real analysis status if we have analysis IDs
  useEffect(() => {
    if (!analysisIds?.length || isCancelled || isComplete) return;

    const pollInterval = setInterval(async () => {
      try {
        const analysis = await getAnalysis(analysisIds[0]);
        if (analysis.status === "completed") {
          setIsComplete(true);
          setProgress(100);
          setCurrentStageIndex(stages.length - 1);
          clearInterval(pollInterval);
        } else if (analysis.status === "failed") {
          setIsCancelled(true);
          clearInterval(pollInterval);
        } else if (analysis.status === "processing") {
          setCurrentStageIndex(2);
          setProgress(60);
        }
      } catch {
        // ignore polling errors
      }
    }, 1500);

    return () => clearInterval(pollInterval);
  }, [analysisIds, isCancelled, isComplete]);

  // Simulated progress for visual feedback (or mock mode)
  useEffect(() => {
    if (isCancelled || isComplete) return;
    // If we have real analysis IDs, just animate up to the current stage
    // If no analysis IDs (mock mode), simulate fully
    const isMock = !analysisIds?.length;

    const stageInterval = setInterval(() => {
      setProgress((prev) => {
        const stageSize = 100 / stages.length;
        const stageStart = currentStageIndex * stageSize;
        const stageEnd = stageStart + stageSize;

        if (isMock) {
          const next = prev + Math.random() * 3 + 1;
          if (next >= stageEnd) {
            if (currentStageIndex < stages.length - 1) {
              setCurrentStageIndex((s) => s + 1);
              return stageEnd;
            } else {
              clearInterval(stageInterval);
              setIsComplete(true);
              return 100;
            }
          }
          return Math.min(next, 100);
        } else {
          // Real mode: gently animate towards current stage
          const target = stageEnd - 5;
          if (prev < target) {
            return prev + Math.random() * 2 + 0.5;
          }
          return prev;
        }
      });
    }, 200);

    return () => clearInterval(stageInterval);
  }, [currentStageIndex, isCancelled, isComplete, analysisIds]);

  // Auto-navigate to results on completion
  useEffect(() => {
    if (isComplete) {
      const targetId = analysisIds?.[0] || id;
      const timer = setTimeout(() => {
        navigate(`/analysis/${targetId}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isComplete, id, analysisIds, navigate]);

  const handleCancel = () => {
    setIsCancelled(true);
  };

  const currentStage = stages[currentStageIndex];

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">
          {isComplete ? "Analysis Complete!" : isCancelled ? "Cancelled" : "Processing"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isComplete
            ? "Redirecting to results..."
            : isCancelled
            ? "Analysis was cancelled."
            : `Analyzing ${passedFiles?.length ?? 1} file${(passedFiles?.length ?? 1) > 1 ? "s" : ""}...`}
        </p>
      </div>

      <Card className="border-border overflow-hidden">
        <CardContent className="p-6">
          <div className="flex justify-center mb-6">
            {isComplete ? (
              <div className="rounded-full bg-success/15 p-4 animate-scale-in">
                <CheckCircle2 className="h-10 w-10 text-success" />
              </div>
            ) : isCancelled ? (
              <div className="rounded-full bg-destructive/15 p-4 animate-scale-in">
                <XCircle className="h-10 w-10 text-destructive" />
              </div>
            ) : (
              <div className="rounded-full bg-primary/10 p-4">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
              </div>
            )}
          </div>

          {!isCancelled && (
            <div className="text-center mb-5">
              <p className="text-sm font-semibold text-foreground mb-1">
                {isComplete ? "All checks complete" : currentStage.label}
              </p>
              <p className="text-xs text-muted-foreground">
                {isComplete ? "Results ready" : currentStage.description}
              </p>
            </div>
          )}

          {!isCancelled && (
            <AnimatedProgress
              value={progress}
              showLabel
              size="md"
              variant={isComplete ? "success" : "default"}
              animated={false}
            />
          )}
        </CardContent>
      </Card>

      {!isCancelled && (
        <div className="space-y-2 animate-fade-in" style={{ animationDelay: "0.2s", opacity: 0 }}>
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            const isActive = index === currentStageIndex && !isComplete;
            const isDone = index < currentStageIndex || isComplete;

            return (
              <div
                key={stage.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 transition-all duration-300",
                  isDone
                    ? "border-success/30 bg-success/5"
                    : isActive
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-card opacity-50"
                )}
              >
                <div
                  className={cn(
                    "rounded-full p-1.5 transition-colors",
                    isDone ? "bg-success/15" : isActive ? "bg-primary/15" : "bg-muted"
                  )}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={cn("text-xs font-medium", isDone ? "text-success" : isActive ? "text-foreground" : "text-muted-foreground")}>
                    {stage.label}
                  </p>
                </div>
                {isDone && <span className="text-[10px] font-medium text-success">Done</span>}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-3">
        {!isComplete && !isCancelled && (
          <Button variant="outline" onClick={handleCancel} className="flex-1 gap-2">Cancel</Button>
        )}
        {isCancelled && (
          <>
            <Button variant="outline" onClick={() => navigate("/upload")} className="flex-1 gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Upload
            </Button>
            <Button
              variant="trust"
              onClick={() => {
                setIsCancelled(false);
                setCurrentStageIndex(0);
                setProgress(0);
              }}
              className="flex-1 gap-2"
            >
              Retry
            </Button>
          </>
        )}
      </div>

      {passedFiles && passedFiles.length > 0 && (
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">
            Processing: {passedFiles.map((f) => f.name).join(", ")}
          </p>
        </div>
      )}
    </div>
  );
};

export default Processing;
