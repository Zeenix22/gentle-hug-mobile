import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Magic Bytes Signatures ─────────────────────────────────────────────────
const SIGNATURES: Record<string, { bytes: number[]; offset?: number }[]> = {
  jpeg: [{ bytes: [0xFF, 0xD8, 0xFF] }],
  png: [{ bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }],
  gif: [{ bytes: [0x47, 0x49, 0x46, 0x38] }],
  webp: [{ bytes: [0x52, 0x49, 0x46, 0x46] }],
  pdf: [{ bytes: [0x25, 0x50, 0x44, 0x46] }],
  mp4: [{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }],
  mov: [{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }],
};

const EXT_TO_FORMAT: Record<string, string> = {
  jpg: "jpeg", jpeg: "jpeg", png: "png", gif: "gif", webp: "webp",
  pdf: "pdf", mp4: "mp4", mov: "mov", avi: "avi",
  doc: "doc", docx: "docx",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function matchesMagicBytes(uint8: Uint8Array, format: string): boolean {
  const sigs = SIGNATURES[format];
  if (!sigs) return true;
  return sigs.some((sig) => {
    const offset = sig.offset ?? 0;
    return sig.bytes.every((b, i) => uint8[offset + i] === b);
  });
}

function computeByteEntropy(uint8: Uint8Array, sampleSize = 65536): number {
  const len = Math.min(uint8.length, sampleSize);
  const freq = new Float64Array(256);
  for (let i = 0; i < len; i++) freq[uint8[i]]++;
  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (freq[i] === 0) continue;
    const p = freq[i] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function extractJpegExif(uint8: Uint8Array): Record<string, string> {
  const exif: Record<string, string> = { Format: "JPEG" };
  let app1Offset = -1;
  for (let i = 2; i < Math.min(uint8.length, 65536) - 1; i++) {
    if (uint8[i] === 0xFF && uint8[i + 1] === 0xE1) { app1Offset = i; break; }
  }
  if (app1Offset === -1) { exif["EXIF Data"] = "Stripped"; return exif; }
  exif["EXIF Data"] = "Present";

  const exifStart = app1Offset + 4;
  if (uint8[exifStart] === 0x45 && uint8[exifStart + 1] === 0x78) {
    const tiffStart = exifStart + 6;
    const isLittleEndian = uint8[tiffStart] === 0x49;
    const readU16 = (off: number) => isLittleEndian ? uint8[off] | (uint8[off + 1] << 8) : (uint8[off] << 8) | uint8[off + 1];
    const readU32 = (off: number) => isLittleEndian ? uint8[off] | (uint8[off + 1] << 8) | (uint8[off + 2] << 16) | (uint8[off + 3] << 24) : (uint8[off] << 24) | (uint8[off + 1] << 16) | (uint8[off + 2] << 8) | uint8[off + 3];
    const readString = (off: number, len: number) => { let s = ""; for (let i = 0; i < len; i++) { const c = uint8[off + i]; if (c === 0) break; s += String.fromCharCode(c); } return s.trim(); };

    const ifd0Offset = tiffStart + readU32(tiffStart + 4);
    const entryCount = readU16(ifd0Offset);
    const TAG_MAP: Record<number, string> = {
      0x010F: "Camera Make", 0x0110: "Camera Model", 0x0112: "Orientation",
      0x0131: "Software", 0x0132: "Date/Time", 0x9003: "Date Original",
      0x920A: "Focal Length", 0xA002: "Image Width", 0xA003: "Image Height",
    };
    const safeLimit = Math.min(uint8.length, 262144);

    for (let i = 0; i < Math.min(entryCount, 40); i++) {
      const entryOff = ifd0Offset + 2 + i * 12;
      if (entryOff + 12 > safeLimit) break;
      const tag = readU16(entryOff);
      const type = readU16(entryOff + 2);
      const count = readU32(entryOff + 4);
      const valueOff = entryOff + 8;
      const label = TAG_MAP[tag];
      if (!label) continue;
      if (type === 2 && count > 0) {
        const strOff = count > 4 ? tiffStart + readU32(valueOff) : valueOff;
        if (strOff + count < safeLimit) exif[label] = readString(strOff, count);
      }
      if (type === 3) exif[label] = String(readU16(valueOff));
    }

    for (let i = 0; i < Math.min(entryCount, 40); i++) {
      const entryOff = ifd0Offset + 2 + i * 12;
      if (entryOff + 12 > safeLimit) break;
      const tag = readU16(entryOff);
      if (tag === 0x8769) {
        const subIfdOff = tiffStart + readU32(entryOff + 8);
        if (subIfdOff + 2 < safeLimit) {
          const subCount = readU16(subIfdOff);
          for (let j = 0; j < Math.min(subCount, 60); j++) {
            const se = subIfdOff + 2 + j * 12;
            if (se + 12 > safeLimit) break;
            const st = readU16(se);
            const stype = readU16(se + 2);
            const scount = readU32(se + 4);
            const sval = se + 8;
            const lbl = TAG_MAP[st];
            if (!lbl) continue;
            if (stype === 2 && scount > 0) {
              const so = scount > 4 ? tiffStart + readU32(sval) : sval;
              if (so + scount < safeLimit) exif[lbl] = readString(so, scount);
            }
            if (stype === 3) exif[lbl] = String(readU16(sval));
            if (stype === 4) exif[lbl] = String(readU32(sval));
          }
        }
        break;
      }
    }
  }
  return exif;
}

function extractPngMetadata(uint8: Uint8Array): Record<string, string> {
  const meta: Record<string, string> = { Format: "PNG" };
  if (uint8.length > 24) {
    const w = (uint8[16] << 24) | (uint8[17] << 16) | (uint8[18] << 8) | uint8[19];
    const h = (uint8[20] << 24) | (uint8[21] << 16) | (uint8[22] << 8) | uint8[23];
    meta["Dimensions"] = `${w} × ${h}`;
    meta["Bit Depth"] = String(uint8[24]);
    const colorTypes: Record<number, string> = { 0: "Grayscale", 2: "RGB", 3: "Indexed", 4: "Grayscale+Alpha", 6: "RGBA" };
    meta["Color Type"] = colorTypes[uint8[25]] || String(uint8[25]);
  }
  const decoder = new TextDecoder();
  let offset = 8;
  while (offset + 8 < uint8.length && offset < 262144) {
    const chunkLen = (uint8[offset] << 24) | (uint8[offset + 1] << 16) | (uint8[offset + 2] << 8) | uint8[offset + 3];
    const chunkType = decoder.decode(uint8.slice(offset + 4, offset + 8));
    if (chunkType === "tEXt" || chunkType === "iTXt") {
      const chunkData = uint8.slice(offset + 8, offset + 8 + Math.min(chunkLen, 512));
      const nullIdx = chunkData.indexOf(0);
      if (nullIdx > 0) {
        const key = decoder.decode(chunkData.slice(0, nullIdx));
        const val = decoder.decode(chunkData.slice(nullIdx + 1, Math.min(nullIdx + 200, chunkData.length)));
        if (key && val) meta[key] = val.substring(0, 100);
      }
    }
    if (chunkType === "IEND") break;
    offset += 12 + chunkLen;
  }
  return meta;
}

// ─── AI Vision Analysis ─────────────────────────────────────────────────────

interface AIAnalysisResult {
  aiScore: number;
  isAIGenerated: boolean;
  isManipulated: boolean;
  manipulationTypes: string[];
  reasoning: string;
  findings: { category: string; finding: string; severity: "low" | "medium" | "high"; description: string }[];
}

async function analyzeImageWithAI(
  uint8: Uint8Array,
  mimeType: string,
  fileName: string,
  heuristicFindings: string,
): Promise<AIAnalysisResult | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.warn("LOVABLE_API_KEY not set — skipping AI analysis");
    return null;
  }

  // Convert image to base64 for vision model
  const base64 = btoa(String.fromCharCode(...uint8.slice(0, Math.min(uint8.length, 4_000_000))));
  const mediaType = mimeType || "image/jpeg";

  const systemPrompt = `You are an expert digital forensics analyst specializing in image authenticity verification. 
Analyze the provided image for signs of:
1. AI generation (Stable Diffusion, Midjourney, DALL-E, etc.)
2. Digital manipulation (Photoshop, splicing, cloning, retouching)
3. Deepfake indicators
4. Screenshot artifacts vs original captures
5. Re-compression or re-encoding signs

Be precise and technical. Look for: unnatural textures, inconsistent lighting/shadows, warped geometry, repeated patterns, AI hallucination artifacts (extra fingers, distorted text, impossible reflections), inconsistent noise grain, edge anomalies, and metadata inconsistencies.`;

  const userPrompt = `Analyze this image "${fileName}" for authenticity. Here are preliminary heuristic findings:
${heuristicFindings}

Provide your analysis using the suggest_authenticity_analysis tool.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: `data:${mediaType};base64,${base64}` } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_authenticity_analysis",
              description: "Return structured image authenticity analysis results",
              parameters: {
                type: "object",
                properties: {
                  authenticity_score: {
                    type: "number",
                    description: "Score 0-100 where 100 is fully authentic, 0 is clearly fake/AI-generated",
                  },
                  is_ai_generated: {
                    type: "boolean",
                    description: "Whether the image appears to be AI-generated",
                  },
                  is_manipulated: {
                    type: "boolean",
                    description: "Whether the image shows signs of digital manipulation",
                  },
                  manipulation_types: {
                    type: "array",
                    items: { type: "string" },
                    description: "Types of manipulation detected, e.g. 'splicing', 'cloning', 'retouching', 'AI generation'",
                  },
                  reasoning: {
                    type: "string",
                    description: "Detailed explanation of the analysis reasoning",
                  },
                  findings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: { type: "string" },
                        finding: { type: "string" },
                        severity: { type: "string", enum: ["low", "medium", "high"] },
                        description: { type: "string" },
                      },
                      required: ["category", "finding", "severity", "description"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["authenticity_score", "is_ai_generated", "is_manipulated", "manipulation_types", "reasoning", "findings"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_authenticity_analysis" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);
      return null;
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response");
      return null;
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    return {
      aiScore: Math.max(0, Math.min(100, parsed.authenticity_score)),
      isAIGenerated: parsed.is_ai_generated,
      isManipulated: parsed.is_manipulated,
      manipulationTypes: parsed.manipulation_types || [],
      reasoning: parsed.reasoning,
      findings: parsed.findings || [],
    };
  } catch (err) {
    console.error("AI analysis error:", err);
    return null;
  }
}

// ─── Analysis Engine ────────────────────────────────────────────────────────

interface Finding {
  category: string;
  finding: string;
  severity: "low" | "medium" | "high";
  description: string;
}

interface AnalysisResult {
  confidenceScore: number;
  authenticityLevel: string;
  summary: string;
  details: Finding[];
  exifData: Record<string, string>;
  hashInfo: { sha256: string; md5: string; isModified: boolean };
}

function runHeuristicAnalysis(
  uint8: Uint8Array,
  fileType: string,
  fileName: string,
  fileSize: number,
  mimeType: string,
): AnalysisResult {
  const details: Finding[] = [];
  let score = 85;

  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const format = EXT_TO_FORMAT[ext] || ext;
  const magicValid = matchesMagicBytes(uint8, format);

  if (!magicValid) {
    details.push({ category: "File Structure", finding: "Magic bytes mismatch", severity: "high", description: `The file's binary signature doesn't match the expected format for .${ext}. This strongly suggests the file has been renamed or tampered with.` });
    score -= 30;
  } else {
    details.push({ category: "File Structure", finding: "Valid file signature", severity: "low", description: `Binary header matches the expected ${format.toUpperCase()} format.` });
  }

  const mimeMap: Record<string, string[]> = {
    jpg: ["image/jpeg"], jpeg: ["image/jpeg"], png: ["image/png"],
    gif: ["image/gif"], webp: ["image/webp"], mp4: ["video/mp4"],
    mov: ["video/quicktime"], pdf: ["application/pdf"],
  };
  const expectedMimes = mimeMap[ext];
  if (expectedMimes && mimeType && !expectedMimes.includes(mimeType)) {
    details.push({ category: "Content Type", finding: "MIME type mismatch", severity: "high", description: `Extension .${ext} doesn't match content type "${mimeType}". This could indicate file tampering or renaming.` });
    score -= 20;
  } else if (expectedMimes) {
    details.push({ category: "Content Type", finding: "Extension matches content", severity: "low", description: "File extension is consistent with the actual file content." });
  }

  if (fileType === "image") {
    if (fileSize < 5000) {
      details.push({ category: "File Size", finding: "Extremely small image", severity: "high", description: "Image is under 5KB — likely a placeholder, thumbnail, or heavily processed file." });
      score -= 15;
    } else if (fileSize < 50000) {
      details.push({ category: "File Size", finding: "Small image file", severity: "medium", description: "File size is relatively small, which may indicate heavy compression or re-encoding." });
      score -= 5;
    } else if (fileSize > 5000000) {
      details.push({ category: "File Size", finding: "Large original", severity: "low", description: "Large file size suggests high-resolution original capture, typical of authentic cameras." });
      score += 3;
    }
  }

  const entropy = computeByteEntropy(uint8);
  if (fileType === "image") {
    if (entropy < 5.0) {
      details.push({ category: "Entropy Analysis", finding: "Low entropy detected", severity: "medium", description: `Byte entropy is ${entropy.toFixed(2)}/8.0 — unusually low for a natural image, could indicate synthetic or heavily processed content.` });
      score -= 10;
    } else if (entropy > 7.8) {
      details.push({ category: "Entropy Analysis", finding: "Very high entropy", severity: "low", description: `Byte entropy is ${entropy.toFixed(2)}/8.0 — high entropy is consistent with well-compressed photographic content.` });
    } else {
      details.push({ category: "Entropy Analysis", finding: "Normal entropy", severity: "low", description: `Byte entropy is ${entropy.toFixed(2)}/8.0 — within expected range for this file type.` });
    }
  }

  let exifData: Record<string, string> = {};
  if (fileType === "image") {
    if (uint8[0] === 0xFF && uint8[1] === 0xD8) {
      exifData = extractJpegExif(uint8);
      if (exifData["EXIF Data"] === "Present") {
        details.push({ category: "Metadata Integrity", finding: "EXIF data present", severity: "low", description: "Original camera metadata found. This is a strong indicator of an authentic, unprocessed photo." });
        score += 5;
        if (exifData["Software"]) {
          const sw = exifData["Software"].toLowerCase();
          const editSoftware = ["photoshop", "gimp", "lightroom", "snapseed", "picsart", "canva", "afterlight"];
          if (editSoftware.some((s) => sw.includes(s))) {
            details.push({ category: "Editing Software", finding: `Edited with ${exifData["Software"]}`, severity: "medium", description: `The image was last processed by "${exifData["Software"]}", indicating it has been edited.` });
            score -= 15;
          }
        }
        if (exifData["Camera Make"] || exifData["Camera Model"]) {
          const camera = [exifData["Camera Make"], exifData["Camera Model"]].filter(Boolean).join(" ");
          exifData["Camera"] = camera;
          details.push({ category: "Camera Verification", finding: `Camera: ${camera}`, severity: "low", description: "Camera make/model data is present, consistent with an original photograph." });
          score += 3;
        }
      } else {
        details.push({ category: "Metadata Integrity", finding: "EXIF data stripped", severity: "medium", description: "EXIF metadata has been removed. Common in re-saved, screenshotted, or social media-shared images." });
        score -= 10;
      }
    } else if (uint8[0] === 0x89 && uint8[1] === 0x50) {
      exifData = extractPngMetadata(uint8);
      const aiMarkers = ["stable diffusion", "midjourney", "dall-e", "comfyui", "automatic1111", "novelai", "dreamstudio"];
      const allMeta = Object.entries(exifData).map(([k, v]) => `${k}:${v}`.toLowerCase()).join(" ");
      if (aiMarkers.some((m) => allMeta.includes(m))) {
        details.push({ category: "AI Generation", finding: "AI generation markers detected", severity: "high", description: "The file's metadata contains references to AI image generation tools. This image is very likely AI-generated." });
        score -= 35;
      } else if (exifData["parameters"]) {
        details.push({ category: "AI Generation", finding: "Generation parameters found", severity: "high", description: "The image contains embedded generation parameters typical of AI image generators like Stable Diffusion." });
        score -= 35;
      } else {
        details.push({ category: "AI Generation", finding: "No AI markers detected", severity: "low", description: "No known AI generation tool signatures found in the file metadata." });
      }
    } else if (uint8[0] === 0x47 && uint8[1] === 0x49) {
      exifData = { Format: "GIF" };
      details.push({ category: "Metadata", finding: "GIF format", severity: "low", description: "GIF files have limited metadata. Analysis based on file structure." });
    }
  } else if (fileType === "document") {
    exifData = { Format: format.toUpperCase() };
    if (format === "pdf") {
      const header = new TextDecoder().decode(uint8.slice(0, 20));
      const versionMatch = header.match(/%PDF-(\d\.\d)/);
      if (versionMatch) exifData["PDF Version"] = versionMatch[1];
      details.push({ category: "Document Analysis", finding: "PDF structure validated", severity: "low", description: `Valid PDF ${versionMatch ? `v${versionMatch[1]}` : ""} structure detected.` });
    }
  } else if (fileType === "video") {
    exifData = { Format: format.toUpperCase() };
    details.push({ category: "Video Analysis", finding: "Container format verified", severity: "low", description: `Valid ${format.toUpperCase()} container structure detected. Deep frame analysis requires specialized tooling.` });
  }

  if (fileType === "image" && uint8.length > 10000) {
    const blockSize = 64;
    const sampleRegion = uint8.slice(Math.floor(uint8.length * 0.2), Math.min(Math.floor(uint8.length * 0.8), uint8.length));
    const blockHashes = new Set<string>();
    let duplicateBlocks = 0;
    const stride = Math.max(1, Math.floor(sampleRegion.length / 500));
    for (let i = 0; i < sampleRegion.length - blockSize; i += stride) {
      const block = sampleRegion.slice(i, i + blockSize);
      let sum = 0, xor = 0;
      for (let j = 0; j < blockSize; j++) { sum += block[j]; xor ^= block[j]; }
      const key = `${sum}:${xor}`;
      if (blockHashes.has(key)) duplicateBlocks++;
      else blockHashes.add(key);
    }
    const dupRatio = duplicateBlocks / Math.max(blockHashes.size, 1);
    if (dupRatio > 0.3) {
      details.push({ category: "Copy-Move Detection", finding: "Repeated patterns detected", severity: "medium", description: `${(dupRatio * 100).toFixed(0)}% of sampled blocks appear duplicated. Could indicate copy-move manipulation or uniform backgrounds.` });
      score -= 10;
    } else {
      details.push({ category: "Copy-Move Detection", finding: "No suspicious patterns", severity: "low", description: "Block-level analysis shows normal variation consistent with authentic imagery." });
    }
  }

  exifData["File Size"] = fileSize >= 1048576 ? `${(fileSize / 1048576).toFixed(1)} MB` : `${(fileSize / 1024).toFixed(1)} KB`;
  score = Math.max(0, Math.min(100, score));

  let authenticityLevel: string;
  let summary: string;
  if (score >= 80) { authenticityLevel = "authentic"; summary = "This file appears to be authentic. No significant signs of manipulation or AI generation were detected."; }
  else if (score >= 55) { authenticityLevel = "suspicious"; summary = "Some indicators suggest this file may have been modified or processed. Manual verification is recommended."; }
  else if (score >= 30) { authenticityLevel = "manipulated"; summary = "Multiple indicators suggest this file has been significantly manipulated, edited, or artificially generated."; }
  else { authenticityLevel = "manipulated"; summary = "Strong evidence of manipulation or artificial generation. This file should not be considered authentic."; }

  return { confidenceScore: score, authenticityLevel, summary, details, exifData, hashInfo: { sha256: "", md5: "n/a", isModified: authenticityLevel !== "authentic" } };
}

// ─── Edge Function Handler ──────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
    if (!anonKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    let user;
    try {
      const { data, error: authError } = await userClient.auth.getUser();
      if (authError || !data?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      user = data.user;
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { analysisId } = await req.json();
    if (!analysisId) {
      return new Response(JSON.stringify({ error: "Missing analysisId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: analysis, error: fetchError } = await adminClient
      .from("analyses").select("*").eq("id", analysisId).eq("user_id", user.id).single();

    if (fetchError || !analysis) {
      return new Response(JSON.stringify({ error: "Analysis not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient.from("analyses").update({ status: "processing" }).eq("id", analysisId);

    const { data: fileData, error: downloadError } = await adminClient.storage.from("uploads").download(analysis.storage_path);

    if (downloadError || !fileData) {
      await adminClient.from("analyses").update({ status: "failed", summary: "Failed to download file for analysis." }).eq("id", analysisId);
      return new Response(JSON.stringify({ error: "File download failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // Compute SHA-256
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const sha256 = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

    // Run heuristic analysis
    const result = runHeuristicAnalysis(uint8, analysis.file_type, analysis.file_name, analysis.file_size, fileData.type);
    result.hashInfo.sha256 = sha256;
    result.exifData["SHA-256"] = sha256.substring(0, 16) + "...";

    // Run AI vision analysis for images
    if (analysis.file_type === "image") {
      const heuristicSummary = result.details.map((d) => `[${d.severity}] ${d.category}: ${d.finding}`).join("\n");

      const aiResult = await analyzeImageWithAI(uint8, fileData.type, analysis.file_name, heuristicSummary);

      if (aiResult) {
        // Merge AI findings into details
        for (const f of aiResult.findings) {
          result.details.push({
            category: `AI Vision: ${f.category}`,
            finding: f.finding,
            severity: f.severity,
            description: f.description,
          });
        }

        // Add AI reasoning as a finding
        result.details.push({
          category: "AI Vision Summary",
          finding: aiResult.isAIGenerated ? "Likely AI-generated" : aiResult.isManipulated ? "Signs of manipulation" : "Appears authentic",
          severity: aiResult.isAIGenerated ? "high" : aiResult.isManipulated ? "medium" : "low",
          description: aiResult.reasoning,
        });

        if (aiResult.manipulationTypes.length > 0) {
          result.exifData["Detected Manipulations"] = aiResult.manipulationTypes.join(", ");
        }

        // Blend scores: 40% heuristic + 60% AI for a more genuine score
        const blendedScore = Math.round(result.confidenceScore * 0.4 + aiResult.aiScore * 0.6);
        result.confidenceScore = Math.max(0, Math.min(100, blendedScore));

        // Re-determine authenticity level based on blended score
        if (result.confidenceScore >= 80) {
          result.authenticityLevel = "authentic";
          result.summary = "AI vision analysis and heuristic checks both indicate this image is authentic with no significant signs of manipulation.";
        } else if (result.confidenceScore >= 55) {
          result.authenticityLevel = "suspicious";
          result.summary = "AI analysis detected some indicators of possible modification or processing. Manual review is recommended.";
        } else if (result.confidenceScore >= 30) {
          result.authenticityLevel = "manipulated";
          result.summary = "AI analysis found significant evidence of manipulation or artificial generation in this image.";
        } else {
          result.authenticityLevel = "manipulated";
          result.summary = "AI analysis strongly indicates this image is AI-generated or heavily manipulated. It should not be considered authentic.";
        }

        result.exifData["AI Analysis"] = "Completed";
        result.exifData["AI Score"] = `${aiResult.aiScore}/100`;
        result.hashInfo.isModified = result.authenticityLevel !== "authentic";
      }
    }

    // Persist results
    await adminClient.from("analyses").update({
      status: "completed",
      authenticity_level: result.authenticityLevel,
      confidence_score: result.confidenceScore,
      summary: result.summary,
      details: result.details,
      exif_data: result.exifData,
      hash_info: result.hashInfo,
      completed_at: new Date().toISOString(),
    }).eq("id", analysisId);

    return new Response(
      JSON.stringify({
        success: true, analysisId,
        authenticityLevel: result.authenticityLevel,
        confidenceScore: result.confidenceScore,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Process file error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
