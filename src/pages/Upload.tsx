import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Image, Video, FileText, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFileUpload } from "@/hooks/use-file-upload";
import Dropzone from "@/components/upload/Dropzone";
import FilePreviewCard from "@/components/upload/FilePreviewCard";
import FileTypeBadge from "@/components/ui/file-type-badge";

const supportedTypes = [
  { icon: Image, label: "Images", formats: "JPG, PNG, GIF, WEBP" },
  { icon: Video, label: "Videos", formats: "MP4, MOV, AVI" },
  { icon: FileText, label: "Documents", formats: "PDF, DOC, DOCX" },
];

const UploadPage = () => {
  const navigate = useNavigate();
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

  const handleAnalyze = () => {
    // In Phase 7 this will trigger actual upload + processing
    // For now, navigate to a mock processing page
    const mockId = crypto.randomUUID().slice(0, 8);
    navigate(`/processing/${mockId}`, { state: { files: files.map(({ raw, ...f }) => f) } });
  };

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Upload Files</h1>
        <p className="text-sm text-muted-foreground">
          Select files to analyze for authenticity.
        </p>
      </div>

      {/* Dropzone */}
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

      {/* File List */}
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
            >
              <Trash2 className="h-3 w-3" />
              Clear all
            </Button>
          </div>

          <div className="space-y-2">
            {files.map((file) => (
              <FilePreviewCard
                key={file.id}
                file={file}
                onRemove={removeFile}
              />
            ))}
          </div>

          {/* Analyze Button */}
          <Button
            variant="trust"
            size="lg"
            onClick={handleAnalyze}
            className="w-full gap-2 font-semibold"
          >
            Analyze {files.length > 1 ? `${files.length} Files` : "File"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Supported Formats */}
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
