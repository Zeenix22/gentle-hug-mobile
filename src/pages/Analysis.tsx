import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Share2,
  Clock,
  Image,
  Video,
  FileText,
  Hash,
  Shield,
  Trash2,
  Brain,
  Cpu,
  Eye,
  Layers,
  Activity,
  Copy,
  ScanFace,
  BadgeCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import TrustScore from "@/components/ui/trust-score";
import StatusBadge from "@/components/ui/status-badge";
import ErrorState from "@/components/ui/error-state";
import AnalysisSkeleton from "@/components/skeletons/AnalysisSkeleton";
import { getMockAnalysis } from "@/data/mock-analyses";
import { getAnalysis, deleteAnalysis } from "@/services/analysis-service";
import { downloadReport, shareAnalysis } from "@/utils/report-utils";
import { toast } from "@/hooks/use-toast";
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
import type { AnalysisResult } from "@/types";

const fileTypeIcons: Record<string, typeof Image> = { image: Image, video: Video, document: FileText };

const severityColors: Record<string, string> = {
  low: "bg-success/10 text-success border-success/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  high: "bg-destructive/10 text-destructive border-destructive/20",
};

const Analysis = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<AnalysisResult | null | undefined>(undefined);
  const [error, setError] = useState(false);

  const loadAnalysis = async () => {
    setError(false);
    setResult(undefined);
    try {
      const dbResult = await getAnalysis(id ?? "");
      if (dbResult) {
        setResult({
          id: dbResult.id,
          fileId: dbResult.id,
          fileName: dbResult.file_name,
          fileType: dbResult.file_type,
          status: dbResult.status,
          authenticityLevel: dbResult.authenticity_level || "uncertain",
          confidenceScore: dbResult.confidence_score ?? 0,
          summary: dbResult.summary || "",
          details: dbResult.details || [],
          exifData: dbResult.exif_data || {},
          hashInfo: dbResult.hash_info || undefined,
          createdAt: dbResult.created_at,
          completedAt: dbResult.completed_at,
        });
        return;
      }
    } catch {
      // Fall back to mock
    }

    // Check sessionStorage for dynamically generated mock
    const storedMock = sessionStorage.getItem(`mock-analysis-${id}`);
    if (storedMock) {
      try {
        setResult(JSON.parse(storedMock));
        return;
      } catch { /* ignore parse errors */ }
    }

    const mock = getMockAnalysis(id ?? "");
    if (mock) {
      setResult(mock);
    } else {
      setResult(null);
    }
  };

  useEffect(() => { loadAnalysis(); }, [id]);

  if (result === undefined) return <AnalysisSkeleton />;

  if (error) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-9 w-9 min-h-0 min-w-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <ErrorState title="Failed to load analysis" description="We couldn't retrieve this analysis." onRetry={loadAnalysis} />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto text-center space-y-4 animate-fade-in">
        <div className="rounded-full bg-muted p-4 inline-flex mx-auto">
          <Shield className="h-12 w-12 text-muted-foreground/30" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Analysis Not Found</h1>
        <p className="text-sm text-muted-foreground">This analysis doesn't exist or has been removed.</p>
        <Button variant="outline" onClick={() => navigate("/upload")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Upload
        </Button>
      </div>
    );
  }

  const FileIcon = fileTypeIcons[result.fileType] || FileText;
  const analysisTime = result.completedAt && result.createdAt
    ? Math.round((new Date(result.completedAt).getTime() - new Date(result.createdAt).getTime()) / 1000)
    : null;

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3 animate-fade-in">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-9 w-9 min-h-0 min-w-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-foreground truncate">{result.fileName}</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileIcon className="h-3 w-3" />
            <span className="capitalize">{result.fileType}</span>
            {analysisTime != null && (
              <>
                <span>•</span>
                <Clock className="h-3 w-3" />
                <span>{analysisTime}s</span>
              </>
            )}
          </div>
        </div>
      </div>

      <Card className="border-border animate-fade-in" style={{ animationDelay: "0.1s", opacity: 0 }}>
        <CardContent className="flex flex-col items-center py-6">
          <TrustScore score={result.confidenceScore} level={result.authenticityLevel} size="lg" />
          <StatusBadge status={result.authenticityLevel} size="lg" className="mt-4" />
          <p className="text-xs text-muted-foreground text-center mt-3 max-w-xs leading-relaxed">
            {result.summary}
          </p>
        </CardContent>
      </Card>

      {/* Score Breakdown */}
      {(() => {
        const parseScore = (k: string) => {
          const v = result.exifData?.[k];
          return v ? parseInt(v.replace("/100", "")) : null;
        };
        const elaScore = parseScore("ELA Score");
        const hfScore = parseScore("AI Vision Score") ?? parseScore("HF Score");
        const winstonScore = parseScore("Winston Score");
        const mantranetScore = parseScore("ManTra-Net Score");
        const fftScore = parseScore("FFT Score");
        const siftScore = parseScore("SIFT Copy-Move Score");
        const faceScore = parseScore("Face Forensics Score");
        const c2pa = result.exifData?.["C2PA Provenance"];
        const aiTool = result.exifData?.["AI Tool Detected"];
        const faceCount = result.exifData?.["Faces Detected"];

        const scoreBarColor = (score: number) =>
          score >= 75 ? "bg-success" : score >= 35 ? "bg-warning" : "bg-destructive";

        const engines = [
          { label: "ManTra-Net (Manipulation Trace)", icon: Layers, score: mantranetScore, desc: "SRM noise residuals + per-region anomaly scoring to detect splicing, copy-move, and AI inpainting", offDesc: "Requires the Python microservice." },
          { label: "FFT Frequency Analysis", icon: Activity, score: fftScore, desc: "Radial frequency spectrum analysis — detects AI upscaling, GFPGAN/Real-ESRGAN face restoration, and diffusion artifacts", offDesc: "Requires the Python microservice." },
          { label: "Face Forensics (Deepfake)", icon: ScanFace, score: faceScore, desc: `Per-face frequency + texture analysis to detect deepfakes and AI face restoration${faceCount ? ` (${faceCount} face${faceCount === "1" ? "" : "s"} detected)` : ""}`, offDesc: "Requires the Python microservice." },
          { label: "SIFT Copy-Move Detection", icon: Copy, score: siftScore, desc: "Geometric SIFT keypoint matching to detect cloned/painted/stamped regions within the image", offDesc: "Requires the Python microservice." },
          { label: "Error Level Analysis (ELA)", icon: Cpu, score: elaScore, desc: "Pixel-level recompression error analysis", offDesc: "ELA requires the Python microservice." },
          { label: "AI Vision Analysis (Gemini)", icon: Eye, score: hfScore, desc: "Vision LLM analyzing textures, artifacts, and visual patterns for AI-generation detection", offDesc: "Requires LOVABLE_API_KEY." },
          { label: "AI Detection (Winston AI)", icon: Shield, score: winstonScore, desc: "Winston AI deep learning model for AI-generated image detection", offDesc: "Requires WINSTON_API_KEY." },
        ].map(e => ({ ...e, has: e.score != null }));

        const hasAny = engines.some(e => e.has);

        return (
          <Card className="border-border animate-fade-in" style={{ animationDelay: "0.12s", opacity: 0 }}>
            <CardContent className="py-4 space-y-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Score Breakdown
              </h2>

              {engines.map((eng) => {
                const Icon = eng.icon;
                return (
                  <div key={eng.label} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Icon className="h-3 w-3" /> {eng.label}
                      </span>
                      {eng.has && eng.score != null ? (
                        <span className="text-xs font-bold text-foreground">{eng.score}/100</span>
                      ) : (
                        <span className="text-[10px] font-medium text-muted-foreground/60 italic">Not available</span>
                      )}
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      {eng.has && eng.score != null ? (
                        <div
                          className={cn("h-full rounded-full transition-all duration-1000", scoreBarColor(eng.score))}
                          style={{ width: `${eng.score}%` }}
                        />
                      ) : (
                        <div className="h-full rounded-full bg-muted-foreground/10" style={{ width: "100%" }} />
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {eng.has ? eng.desc : eng.offDesc}
                    </p>
                  </div>
                );
              })}

              {hasAny && (
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Brain className="h-3 w-3" /> Final Score
                    </span>
                    <span className="text-xs font-bold text-primary">{result.confidenceScore}/100</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {result.exifData?.["Scoring Method"] || "Weighted blend of available engines"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      <div className="flex gap-2 animate-fade-in" style={{ animationDelay: "0.15s", opacity: 0 }}>
        <Button
          variant="outline"
          className="flex-1 gap-2 text-sm"
          onClick={() => {
            downloadReport(result);
            toast({ title: "Report downloaded", description: "Text report saved to your device." });
          }}
        >
          <Download className="h-4 w-4" /> Report
        </Button>
        <Button
          variant="outline"
          className="flex-1 gap-2 text-sm"
          onClick={async () => {
            const usedNativeShare = await shareAnalysis(result);
            if (!usedNativeShare) {
              toast({ title: "Link copied", description: "Analysis link copied to clipboard." });
            }
          }}
        >
          <Share2 className="h-4 w-4" /> Share
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Analysis</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this analysis and its associated file. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  try {
                    await deleteAnalysis(result.id);
                    toast({ title: "Deleted", description: "Analysis has been removed." });
                    navigate("/history");
                  } catch {
                    toast({ title: "Delete failed", description: "Could not delete this analysis.", variant: "destructive" });
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {result.details.length > 0 && (
        <div className="animate-fade-in" style={{ animationDelay: "0.2s", opacity: 0 }}>
          <h2 className="text-sm font-bold text-foreground mb-3">Detailed Findings</h2>
          <div className="space-y-2">
            {result.details.map((detail: any, index: number) => (
              <Card key={index} className="border-border">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="text-xs font-semibold text-foreground">{detail.category}</h3>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", severityColors[detail.severity] || "")}>
                      {detail.severity}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-foreground mb-0.5">{detail.finding}</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{detail.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {result.exifData && Object.keys(result.exifData).length > 0 && (
        <div className="animate-fade-in" style={{ animationDelay: "0.25s", opacity: 0 }}>
          <Accordion type="single" collapsible>
            <AccordionItem value="exif" className="border border-border rounded-lg px-4">
              <AccordionTrigger className="text-sm font-bold">
                <span className="flex items-center gap-2">
                  <Image className="h-4 w-4 text-primary" />
                  EXIF / Metadata
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pt-1">
                  {Object.entries(result.exifData).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{key}</span>
                      <span className="font-medium text-foreground text-right max-w-[55%] truncate">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      {result.hashInfo && (
        <div className="animate-fade-in" style={{ animationDelay: "0.3s", opacity: 0 }}>
          <Accordion type="single" collapsible>
            <AccordionItem value="hash" className="border border-border rounded-lg px-4">
              <AccordionTrigger className="text-sm font-bold">
                <span className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-primary" />
                  File Integrity
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-1">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">SHA-256</p>
                    <p className="text-[10px] font-mono text-foreground break-all bg-muted rounded p-2">{result.hashInfo.sha256}</p>
                  </div>
                  {result.hashInfo.md5 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">MD5</p>
                      <p className="text-[10px] font-mono text-foreground break-all bg-muted rounded p-2">{result.hashInfo.md5}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Modified:</span>
                    <StatusBadge
                      status={result.hashInfo.isModified ? "manipulated" : "authentic"}
                      size="sm"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      <div className="pb-4" />
    </div>
  );
};

export default Analysis;
