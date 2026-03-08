import { cn } from "@/lib/utils";
import { X, Image, Video, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UploadedFile } from "@/types";
import { formatFileSize } from "@/utils/file-utils";

interface FilePreviewCardProps {
  file: UploadedFile;
  onRemove: (id: string) => void;
}

const fileTypeIcons = {
  image: Image,
  video: Video,
  document: FileText,
};

const fileTypeBgColors = {
  image: "bg-primary/10 text-primary",
  video: "bg-warning/10 text-warning",
  document: "bg-success/10 text-success",
};

const FilePreviewCard = ({ file, onRemove }: FilePreviewCardProps) => {
  const Icon = fileTypeIcons[file.fileType];

  return (
    <div className="group relative flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-all duration-200 hover:shadow-sm animate-scale-in">
      {/* Preview / Icon */}
      <div className="relative flex-shrink-0 h-12 w-12 rounded-lg overflow-hidden">
        {file.preview ? (
          <img
            src={file.preview}
            alt={file.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className={cn("h-full w-full flex items-center justify-center rounded-lg", fileTypeBgColors[file.fileType])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</span>
          <span className="text-[10px] text-muted-foreground">•</span>
          <span className="text-[10px] text-muted-foreground capitalize">{file.fileType}</span>
        </div>
      </div>

      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(file.id);
        }}
        className="h-8 w-8 min-h-0 min-w-0 opacity-60 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default FilePreviewCard;
