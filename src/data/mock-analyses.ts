import type { AnalysisResult } from "@/types";

// Mock analysis results for development
export const mockAnalysisResults: AnalysisResult[] = [
  {
    id: "a1b2c3",
    fileId: "f1",
    fileName: "profile_photo.jpg",
    fileType: "image",
    status: "completed",
    authenticityLevel: "authentic",
    confidenceScore: 92,
    summary: "AI vision analysis and heuristic checks both indicate this image is authentic with no significant signs of manipulation.",
    details: [
      { category: "File Structure", finding: "Valid file signature", severity: "low", description: "Binary header matches the expected JPEG format." },
      { category: "Content Type", finding: "Extension matches content", severity: "low", description: "File extension is consistent with the actual file content." },
      { category: "Entropy Analysis", finding: "Very high entropy", severity: "low", description: "Byte entropy is 7.92/8.0 — high entropy is consistent with well-compressed photographic content." },
      { category: "Metadata Integrity", finding: "EXIF data present", severity: "low", description: "Original camera metadata found. This is a strong indicator of an authentic, unprocessed photo." },
      { category: "Camera Verification", finding: "Camera: Apple iPhone 15 Pro", severity: "low", description: "Camera make/model data is present, consistent with an original photograph." },
      { category: "Copy-Move Detection", finding: "No suspicious patterns", severity: "low", description: "Block-level analysis shows normal variation consistent with authentic imagery." },
      { category: "AI Vision: Texture Analysis", finding: "Natural textures confirmed", severity: "low", description: "Skin, hair, and background textures are consistent with real-world photography." },
      { category: "AI Vision: Lighting", finding: "Consistent lighting", severity: "low", description: "Shadow directions and highlight falloff are physically plausible and consistent." },
      { category: "AI Vision Summary", finding: "Appears authentic", severity: "low", description: "No visual indicators of AI generation, splicing, or deepfake manipulation detected. The image exhibits natural noise grain, consistent JPEG compression, and realistic geometric perspective." },
    ],
    exifData: {
      "Camera": "Apple iPhone 15 Pro",
      "Date Taken": "2026-02-15 14:32:08",
      "Resolution": "4032 × 3024",
      "File Size": "3.2 MB",
      "GPS Location": "37.7749° N, 122.4194° W",
      "ISO": "100",
      "Aperture": "f/1.8",
      "Shutter Speed": "1/120s",
      "Software": "iOS 19.3",
      "Color Space": "sRGB",
      "AI Analysis": "Completed",
      "AI Score": "90/100",
      "SHA-256": "e3b0c44298fc1c14...",
    },
    hashInfo: { md5: "d41d8cd98f00b204e9800998ecf8427e", sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", isModified: false },
    createdAt: "2026-03-08T10:15:00Z",
    completedAt: "2026-03-08T10:15:28Z",
  },
  {
    id: "d4e5f6",
    fileId: "f2",
    fileName: "news_screenshot.png",
    fileType: "image",
    status: "completed",
    authenticityLevel: "manipulated",
    confidenceScore: 18,
    summary: "AI analysis found significant evidence of manipulation or artificial generation in this image.",
    details: [
      { category: "File Structure", finding: "Valid file signature", severity: "low", description: "Binary header matches the expected PNG format." },
      { category: "Metadata Integrity", finding: "EXIF data stripped", severity: "medium", description: "EXIF metadata has been removed. Common in re-saved, screenshotted, or social media-shared images." },
      { category: "Editing Software", finding: "Edited with Adobe Photoshop 2026", severity: "medium", description: "The image was last processed by \"Adobe Photoshop 2026\", indicating it has been edited." },
      { category: "Copy-Move Detection", finding: "Repeated patterns detected", severity: "medium", description: "34% of sampled blocks appear duplicated. Could indicate copy-move manipulation or uniform backgrounds." },
      { category: "AI Vision: Splicing", finding: "Composited regions detected", severity: "high", description: "Error level analysis reveals inconsistent compression levels across regions, indicating spliced elements from different sources." },
      { category: "AI Vision: Clone Stamp", finding: "Cloned areas in lower-left", severity: "high", description: "Two regions in the lower-left quadrant show identical pixel patterns rotated 3°, consistent with clone stamp tool usage." },
      { category: "AI Vision: Inpainting", finding: "AI inpainting detected", severity: "high", description: "A rectangular region shows texture generation patterns consistent with AI-assisted content-aware fill." },
      { category: "AI Vision Summary", finding: "Signs of manipulation", severity: "high", description: "Multiple manipulation techniques detected including splicing, clone stamping, and AI inpainting. The image has been significantly altered from its original state. Compression artifacts are inconsistent across regions." },
    ],
    exifData: {
      "Software": "Adobe Photoshop 2026",
      "Date Modified": "2026-03-07 22:45:12",
      "Resolution": "1920 × 1080",
      "File Size": "1.8 MB",
      "Color Space": "sRGB",
      "Detected Manipulations": "splicing, cloning, AI inpainting",
      "AI Analysis": "Completed",
      "AI Score": "15/100",
      "SHA-256": "b5f2c3d4e5a6b7c8...",
    },
    hashInfo: { md5: "a3f2b8c1d4e5f6789012345678901234", sha256: "b5f2c3d4e5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2", isModified: true },
    createdAt: "2026-03-07T22:50:00Z",
    completedAt: "2026-03-07T22:50:35Z",
  },
  {
    id: "g7h8i9",
    fileId: "f3",
    fileName: "interview_clip.mp4",
    fileType: "video",
    status: "completed",
    authenticityLevel: "suspicious",
    confidenceScore: 58,
    summary: "Some indicators suggest this file may have been modified or processed. Manual verification is recommended.",
    details: [
      { category: "File Structure", finding: "Valid file signature", severity: "low", description: "Binary header matches the expected MP4 format." },
      { category: "Video Analysis", finding: "Container format verified", severity: "low", description: "Valid MP4 container structure detected. Deep frame analysis requires specialized tooling." },
      { category: "Deepfake Detection", finding: "Suspicious", severity: "medium", description: "Facial landmark tracking shows slight inconsistencies in lip-sync during 0:15-0:23." },
      { category: "Audio Analysis", finding: "Inconclusive", severity: "medium", description: "Audio spectral analysis shows minor artifacts that could be from compression or manipulation." },
    ],
    exifData: {
      "Duration": "0:45",
      "Resolution": "1920 × 1080",
      "Frame Rate": "30 fps",
      "File Size": "12.4 MB",
      "Codec": "H.264",
      "SHA-256": "1a2b3c4d5e6f7a8b...",
    },
    hashInfo: { md5: "f1e2d3c4b5a6978801234567890abcde", sha256: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2", isModified: false },
    createdAt: "2026-03-06T16:20:00Z",
    completedAt: "2026-03-06T16:21:12Z",
  },
  {
    id: "j0k1l2",
    fileId: "f4",
    fileName: "contract_scan.pdf",
    fileType: "document",
    status: "completed",
    authenticityLevel: "authentic",
    confidenceScore: 87,
    summary: "This document appears genuine with consistent formatting and metadata. No signs of text manipulation or page substitution detected.",
    details: [
      { category: "File Structure", finding: "Valid file signature", severity: "low", description: "Binary header matches the expected PDF format." },
      { category: "Document Analysis", finding: "PDF structure validated", severity: "low", description: "Valid PDF v1.7 structure detected." },
      { category: "Text Integrity", finding: "Consistent", severity: "low", description: "Font metrics and spacing are uniform throughout the document." },
    ],
    exifData: {
      "Creator": "Microsoft Word",
      "Date Created": "2026-01-10 09:00:00",
      "Pages": "5",
      "File Size": "245 KB",
      "SHA-256": "fedcba0987654321...",
    },
    hashInfo: { md5: "abcdef1234567890abcdef1234567890", sha256: "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321", isModified: false },
    createdAt: "2026-03-05T09:10:00Z",
    completedAt: "2026-03-05T09:10:18Z",
  },
  {
    id: "m3n4o5",
    fileId: "f5",
    fileName: "headshot_ai.webp",
    fileType: "image",
    status: "completed",
    authenticityLevel: "manipulated",
    confidenceScore: 8,
    summary: "AI analysis strongly indicates this image is AI-generated or heavily manipulated. It should not be considered authentic.",
    details: [
      { category: "File Structure", finding: "Valid file signature", severity: "low", description: "Binary header matches the expected WEBP format." },
      { category: "Metadata Integrity", finding: "EXIF data stripped", severity: "medium", description: "EXIF metadata has been removed. Common in re-saved, screenshotted, or social media-shared images." },
      { category: "Entropy Analysis", finding: "Low entropy detected", severity: "medium", description: "Byte entropy is 4.82/8.0 — unusually low for a natural image, could indicate synthetic or heavily processed content." },
      { category: "AI Vision: Generation Artifacts", finding: "Diffusion model artifacts", severity: "high", description: "Hair strands show characteristic 'melting' patterns and ear geometry is asymmetric in ways typical of diffusion-model outputs." },
      { category: "AI Vision: Texture", finding: "Synthetic skin texture", severity: "high", description: "Skin pore patterns are too regular and uniform, lacking the natural randomness found in real photographs." },
      { category: "AI Vision: Background", finding: "Impossible geometry", severity: "high", description: "Background elements show perspective inconsistencies and impossible object intersections typical of AI hallucination." },
      { category: "AI Vision Summary", finding: "Likely AI-generated", severity: "high", description: "Image matches signatures of Stable Diffusion / DALL-E class models with high confidence. Characteristic artifacts in fine details (hair, ears, teeth), synthetic texture patterns, and the absence of any camera metadata all point to AI generation." },
    ],
    exifData: {
      "Resolution": "1024 × 1024",
      "File Size": "892 KB",
      "Color Space": "sRGB",
      "AI Analysis": "Completed",
      "AI Score": "5/100",
      "SHA-256": "abcdef1234567890...",
    },
    hashInfo: { md5: "1234abcd5678efgh9012ijkl3456mnop", sha256: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890", isModified: false },
    createdAt: "2026-03-04T14:00:00Z",
    completedAt: "2026-03-04T14:00:22Z",
  },
];

/** Look up a mock analysis by ID, or by a dynamic mock ID */
export function getMockAnalysis(id: string): AnalysisResult | undefined {
  return mockAnalysisResults.find((a) => a.id === id);
}

/** Generate a mock analysis result from an uploaded file for unauthenticated users */
export function generateMockAnalysis(
  id: string,
  fileName: string,
  fileType: "image" | "video" | "document",
  fileSize: number,
): AnalysisResult {
  const isImage = fileType === "image";
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  // Randomize scores to make it interesting
  const heuristicScore = 60 + Math.floor(Math.random() * 35);
  const aiScore = isImage ? 50 + Math.floor(Math.random() * 45) : 0;
  const blendedScore = isImage
    ? Math.round(heuristicScore * 0.4 + aiScore * 0.6)
    : heuristicScore;

  const level = blendedScore >= 80 ? "authentic" : blendedScore >= 55 ? "suspicious" : "manipulated";

  const summaryMap = {
    authentic: "AI vision analysis and heuristic checks both indicate this file is authentic with no significant signs of manipulation.",
    suspicious: "AI analysis detected some indicators of possible modification or processing. Manual review is recommended.",
    manipulated: "AI analysis found significant evidence of manipulation or artificial generation.",
  };

  const details: AnalysisResult["details"] = [
    { category: "File Structure", finding: "Valid file signature", severity: "low", description: `Binary header matches the expected ${ext.toUpperCase()} format.` },
    { category: "Content Type", finding: "Extension matches content", severity: "low", description: "File extension is consistent with the actual file content." },
  ];

  if (isImage) {
    details.push(
      { category: "Entropy Analysis", finding: "Normal entropy", severity: "low", description: "Byte entropy is 7.41/8.0 — within expected range for this file type." },
      { category: "Copy-Move Detection", finding: "No suspicious patterns", severity: "low", description: "Block-level analysis shows normal variation consistent with authentic imagery." },
      { category: "AI Vision: Texture Analysis", finding: heuristicScore > 75 ? "Natural textures confirmed" : "Some anomalies detected", severity: heuristicScore > 75 ? "low" : "medium", description: heuristicScore > 75 ? "Textures are consistent with real-world photography." : "Some texture regions show patterns that could indicate processing." },
      { category: "AI Vision: Lighting", finding: aiScore > 70 ? "Consistent lighting" : "Minor inconsistencies", severity: aiScore > 70 ? "low" : "medium", description: aiScore > 70 ? "Shadow directions and highlight falloff are physically plausible." : "Some lighting angles appear slightly inconsistent across regions." },
      { category: "AI Vision Summary", finding: level === "authentic" ? "Appears authentic" : level === "suspicious" ? "Inconclusive — needs review" : "Signs of manipulation", severity: level === "authentic" ? "low" : level === "suspicious" ? "medium" : "high", description: `AI vision analysis completed with a score of ${aiScore}/100. ${summaryMap[level]}` },
    );
  }

  const fileSizeStr = fileSize >= 1048576 ? `${(fileSize / 1048576).toFixed(1)} MB` : `${(fileSize / 1024).toFixed(1)} KB`;
  const sha256 = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, "0")).join("");

  const exifData: Record<string, string> = {
    "Format": ext.toUpperCase(),
    "File Size": fileSizeStr,
    "SHA-256": sha256.substring(0, 16) + "...",
  };

  if (isImage) {
    exifData["AI Analysis"] = "Completed";
    exifData["AI Score"] = `${aiScore}/100`;
  }

  return {
    id,
    fileId: id,
    fileName,
    fileType,
    status: "completed",
    authenticityLevel: level as AnalysisResult["authenticityLevel"],
    confidenceScore: blendedScore,
    summary: summaryMap[level],
    details,
    exifData,
    hashInfo: {
      sha256,
      md5: "n/a",
      isModified: level !== "authentic",
    },
    createdAt: new Date().toISOString(),
    completedAt: new Date(Date.now() + Math.floor(Math.random() * 5000) + 3000).toISOString(),
  };
}
