import { useState, useCallback, useRef } from "react";
import type { UploadedFile } from "@/types";
import { validateFile, generatePreview, formatFileSize } from "@/utils/file-utils";
import { toast } from "@/hooks/use-toast";

interface UseFileUploadOptions {
  maxFiles?: number;
  onFilesAdded?: (files: UploadedFile[]) => void;
}

export function useFileUpload({ maxFiles = 10, onFilesAdded }: UseFileUploadOptions = {}) {
  const [files, setFiles] = useState<(UploadedFile & { raw: File })[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList);
      const remaining = maxFiles - files.length;

      if (remaining <= 0) {
        toast({
          title: "Limit reached",
          description: `Maximum of ${maxFiles} files allowed.`,
          variant: "destructive",
        });
        return;
      }

      const toProcess = incoming.slice(0, remaining);
      if (incoming.length > remaining) {
        toast({
          title: "Some files skipped",
          description: `Only ${remaining} more file(s) can be added.`,
        });
      }

      const processed: (UploadedFile & { raw: File })[] = [];

      for (const file of toProcess) {
        const validation = validateFile(file);
        if (!validation.valid) {
          toast({
            title: `${file.name}`,
            description: validation.error,
            variant: "destructive",
          });
          continue;
        }

        const preview = await generatePreview(file);
        const id = crypto.randomUUID();

        processed.push({
          id,
          name: file.name,
          size: file.size,
          type: file.type,
          fileType: validation.fileType!,
          preview: preview ?? undefined,
          raw: file,
        });
      }

      if (processed.length > 0) {
        setFiles((prev) => [...prev, ...processed]);
        onFilesAdded?.(processed);
      }
    },
    [files.length, maxFiles, onFilesAdded]
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const clearFiles = useCallback(() => {
    files.forEach((f) => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setFiles([]);
  }, [files]);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files?.length) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        processFiles(e.target.files);
        e.target.value = "";
      }
    },
    [processFiles]
  );

  return {
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
  };
}
