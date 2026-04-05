import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Image, Video, FileText, Trash2, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFileUpload } from "@/hooks/use-file-upload";
import Dropzone from "@/components/upload/Dropzone";
import FilePreviewCard from "@/components/upload/FilePreviewCard";
import FileTypeBadge from "@/components/ui/file-type-badge";
import AnimatedProgress from "@/components/ui/animated-progress";
import { useAuth } from "@/contexts/AuthContext";
import { uploadFileAndCreateAnalysis, triggerProcessing, analyzeAsGuest } from "@/services/analysis-service";
import { toast } from "@/hooks/use-toast";

const supportedTypes = [
  { icon: Image, label: "Images", formats: "JPG, PNG, GIF, WEBP" },
  { icon: Video, label: "Videos", formats: "MP4, MOV, AVI" },
  { icon: FileText, label: "Documents", formats: "PDF, DOC, DOCX" },
];

const UploadPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const {
    files,
    isDragging,
    fileInputRef,
    removeFile,
    clearFiles,
    openFilePicker,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleInputChange,
  } = useFileUpload({ maxFiles: 10 });

  const handleAnalyze = async () => {
    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      if (user) {
        // ── Authenticated flow: upload to storage + DB ──
        const analysisIds: string[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const analysisId = await uploadFileAndCreateAnalysis(file.raw, file.fileType, user.id);
          analysisIds.push(analysisId);
          setUploadProgress(Math.round(((i + 1) / files.length) * 100));
        }

        const primaryId = analysisIds[0];
        navigate(`/processing/${primaryId}`, {
          state: { analysisIds, files: files.map(({ raw, ...f }) => f) },
        });

        for (const id of analysisIds) {
          triggerProcessing(id).catch(console.error);
        }
      } else {
        // ── Guest flow: send file directly to edge function ──
        const results: any[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setUploadProgress(Math.round(((i + 0.5) / files.length) * 100));
          const result = await analyzeAsGuest(file.raw, file.fileType);
          results.push(result);
          setUploadProgress(Math.round(((i + 1) / files.length) * 100));
        }

        // Store results in sessionStorage and navigate to analysis page
        const primaryResult = results[0];
        sessionStorage.setItem(`mock-analysis-${primaryResult.id}`, JSON.stringify(primaryResult));
        navigate(`/analysis/${primaryResult.id}`);
      }
    } catch (err: any) {
      setUploadError(err.message || "Analysis failed. Please try again.");
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Upload Files</h1>
        <p className="text-sm text-muted-foreground">Select files to analyze for authenticity.</p>
      </div>

      <div className="animate-fade-in" style={{ animationDelay: "0.1s", opacity: 0 }}>
        <Dropzone
          isDragging={isDragging}
          fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onInputChange={handleInputChange}
          onClickBrowse={openFilePicker}
          hasFiles={files.length > 0}
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              {files.length} file{files.length > 1 ? "s" : ""} selected
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFiles}
              className="text-xs text-muted-foreground hover:text-destructive gap-1 h-8 min-h-0"
              disabled={isUploading}
            >
              <Trash2 className="h-3 w-3" />
              Clear all
            </Button>
          </div>

          <div className="space-y-2">
            {files.map((file, index) => (
              <div key={file.id} className="animate-fade-in" style={{ animationDelay: `${index * 0.05}s`, opacity: 0 }}>
                <FilePreviewCard file={file} onRemove={removeFile} />
              </div>
            ))}
          </div>

          {uploadError && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive text-xs animate-fade-in">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p>{uploadError}</p>
            </div>
          )}

          {isUploading && (
            <div className="animate-fade-in">
              <AnimatedProgress value={uploadProgress} showLabel size="sm" variant="default" animated={false} />
              <p className="text-[10px] text-muted-foreground text-center mt-1">
                {user ? "Uploading" : "Analyzing"} {files.length} file{files.length > 1 ? "s" : ""}...
              </p>
            </div>
          )}

          <Button
            variant="trust"
            size="lg"
            onClick={handleAnalyze}
            className="w-full gap-2 font-semibold"
            disabled={isUploading}
          >
            {isUploading ? (user ? "Uploading..." : "Analyzing...") : `Analyze ${files.length > 1 ? `${files.length} Files` : "File"}`}
            {!isUploading && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      )}

      {files.length === 0 && (
        <div className="space-y-3 animate-fade-in" style={{ animationDelay: "0.2s", opacity: 0 }}>
          <h2 className="text-sm font-semibold text-foreground">Supported Formats</h2>
          <div className="grid grid-cols-3 gap-2">
            {supportedTypes.map((type) => (
              <FileTypeBadge key={type.label} {...type} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadPage;
