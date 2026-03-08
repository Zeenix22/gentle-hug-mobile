// Core TypeScript interfaces for Truth Buddy

export type FileType = 'image' | 'video' | 'document';

export type AnalysisStatus = 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';

export type AuthenticityLevel = 'authentic' | 'suspicious' | 'manipulated' | 'uncertain';

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  fileType: FileType;
  preview?: string;
}

export interface AnalysisResult {
  id: string;
  fileId: string;
  fileName: string;
  fileType: FileType;
  status: AnalysisStatus;
  authenticityLevel: AuthenticityLevel;
  confidenceScore: number; // 0-100
  summary: string;
  details: AnalysisDetail[];
  exifData?: Record<string, string>;
  hashInfo?: HashInfo;
  createdAt: string;
  completedAt?: string;
}

export interface AnalysisDetail {
  category: string;
  finding: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface HashInfo {
  md5: string;
  sha256: string;
  isModified: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
  totalAnalyses: number;
  plan: 'free' | 'pro' | 'enterprise';
}

export interface NavItem {
  label: string;
  path: string;
  icon: string;
}
