import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";
import { getAcceptString } from "@/utils/file-utils";

interface DropzoneProps {
  isDragging: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClickBrowse: () => void;
  hasFiles: boolean;
}

const Dropzone = ({
  isDragging,
  fileInputRef,
  onDragOver,
  onDragLeave,
  onDrop,
  onInputChange,
  onClickBrowse,
  hasFiles,
}: DropzoneProps) => {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClickBrowse}
      className={cn(
        "relative rounded-xl border-2 border-dashed cursor-pointer transition-all duration-300",
        isDragging
          ? "border-primary bg-primary/10 scale-[1.01] shadow-lg"
          : "border-border hover:border-primary/40 hover:bg-primary/5",
        hasFiles ? "py-6" : "py-12"
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={getAcceptString()}
        onChange={onInputChange}
        className="hidden"
      />

      <div className="flex flex-col items-center justify-center text-center px-4">
        <div
          className={cn(
            "rounded-full p-3 mb-3 transition-all duration-300",
            isDragging
              ? "bg-primary/20 scale-110"
              : "bg-primary/10"
          )}
        >
          <Upload
            className={cn(
              "h-6 w-6 transition-all duration-300",
              isDragging ? "text-primary scale-110" : "text-primary"
            )}
          />
        </div>

        {isDragging ? (
          <p className="text-sm font-semibold text-primary animate-fade-in">
            Drop files here
          </p>
        ) : (
          <>
            <p className="text-sm font-semibold text-foreground">
              {hasFiles ? "Add more files" : "Tap to browse or drag & drop"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Images, videos, and documents up to 50MB
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default Dropzone;
