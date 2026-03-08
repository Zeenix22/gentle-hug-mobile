import type { FileType } from "@/types";

// Supported MIME types mapped to file categories
const SUPPORTED_TYPES: Record<string, FileType> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/gif": "image",
  "image/webp": "image",
  "video/mp4": "video",
  "video/quicktime": "video",
  "video/x-msvideo": "video",
  "application/pdf": "document",
  "application/msword": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
};

const SUPPORTED_EXTENSIONS: Record<string, FileType> = {
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image",
  mp4: "video", mov: "video", avi: "video",
  pdf: "document", doc: "document", docx: "document",
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  fileType?: FileType;
}

export function validateFile(file: File): FileValidationResult {
  // Check size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.` };
  }

  if (file.size === 0) {
    return { valid: false, error: "File is empty." };
  }

  // Check type by MIME
  const fileType = SUPPORTED_TYPES[file.type];
  if (fileType) {
    return { valid: true, fileType };
  }

  // Fallback: check extension
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && SUPPORTED_EXTENSIONS[ext]) {
    return { valid: true, fileType: SUPPORTED_EXTENSIONS[ext] };
  }

  return {
    valid: false,
    error: `Unsupported file type. Supported: JPG, PNG, GIF, WEBP, MP4, MOV, AVI, PDF, DOC, DOCX.`,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

export function getFileTypeFromMime(mimeType: string): FileType | null {
  return SUPPORTED_TYPES[mimeType] || null;
}

export function getAcceptString(): string {
  return Object.keys(SUPPORTED_TYPES).join(",");
}

export function generatePreview(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) {
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export async function generateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
