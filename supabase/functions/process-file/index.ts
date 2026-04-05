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

// ─── Python Microservice Integration (ELA) ──────────────────────────────────

interface PythonAnalysisResult {
  ela_score: number;
  noise_score: number;
  clone_score: number;
  edge_score: number;
  overall_score: number;
  findings: { category: string; finding: string; severity: string; description: string }[];
}

async function callPythonELA(uint8: Uint8Array, fileName: string): Promise<PythonAnalysisResult | null> {
  const pythonUrl = Deno.env.get("PYTHON_ANALYSIS_URL");
  if (!pythonUrl) {
    console.log("PYTHON_ANALYSIS_URL not set — skipping ELA analysis");
    return null;
  }

  try {
    const base64 = btoa(String.fromCharCode(...uint8.slice(0, Math.min(uint8.length, 10_000_000))));
    
    const response = await fetch(`${pythonUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_base64: base64, file_name: fileName }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Python ELA service error:", response.status, errText);
      return null;
    }

    return await response.json() as PythonAnalysisResult;
  } catch (err) {
    console.error("Python ELA service call failed:", err);
    return null;
  }
}

// ─── Hugging Face AI Detection ──────────────────────────────────────────────

interface HFDetectionResult {
  hfScore: number;
  isAIGenerated: boolean;
  confidence: number;
  rawLabel: string;
  findings: { category: string; finding: string; severity: "low" | "medium" | "high"; description: string }[];
}

async function analyzeWithHuggingFace(uint8: Uint8Array, mimeType: string): Promise<HFDetectionResult | null> {
  const hfApiKey = Deno.env.get("HF_API_KEY");
  if (!hfApiKey) {
    console.warn("HF_API_KEY not set — skipping Hugging Face analysis");
    return null;
  }

  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/hungnh1201/ai-image-detector",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfApiKey}`,
          "Content-Type": mimeType || "image/jpeg",
        },
        body: uint8,
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Hugging Face API error:", response.status, errText);

      if (response.status === 503) {
        console.log("Model loading, retrying in 20s...");
        await new Promise(r => setTimeout(r, 20000));
        const retryResponse = await fetch(
          "https://api-inference.huggingface.co/models/hungnh1201/ai-image-detector",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${hfApiKey}`,
              "Content-Type": mimeType || "image/jpeg",
            },
            body: uint8,
          }
        );
        if (!retryResponse.ok) {
          console.error("HF retry failed:", retryResponse.status);
          return null;
        }
        const retryData = await retryResponse.json();
        return parseHFResponse(retryData);
      }
      return null;
    }

    const data = await response.json();
    return parseHFResponse(data);
  } catch (err) {
    console.error("Hugging Face analysis error:", err);
    return null;
  }
}

function parseHFResponse(data: any[]): HFDetectionResult {
  const findings: HFDetectionResult["findings"] = [];
  
  let humanScore = 0;
  let artificialScore = 0;

  for (const item of data) {
    const label = (item.label || "").toLowerCase();
    if (label === "human" || label === "real") {
      humanScore = item.score;
    } else if (label === "artificial" || label === "ai" || label === "fake") {
      artificialScore = item.score;
    }
  }

  if (humanScore === 0 && artificialScore > 0) humanScore = 1 - artificialScore;
  if (artificialScore === 0 && humanScore > 0) artificialScore = 1 - humanScore;

  const isAIGenerated = artificialScore > humanScore;
  const confidence = Math.max(humanScore, artificialScore);
  const hfScore = Math.round(humanScore * 100);
  const topLabel = isAIGenerated ? "AI-Generated" : "Human-Created";

  if (isAIGenerated) {
    const severity = confidence > 0.85 ? "high" : confidence > 0.6 ? "medium" : "low";
    findings.push({
      category: "AI Detection (Hugging Face)",
      finding: `Image classified as AI-generated (${(artificialScore * 100).toFixed(1)}% confidence)`,
      severity,
      description: `The AI image detector model identifies this image as artificially generated with ${(artificialScore * 100).toFixed(1)}% confidence.`,
    });
  } else {
    const severity = confidence > 0.85 ? "low" : confidence > 0.6 ? "low" : "medium";
    findings.push({
      category: "AI Detection (Hugging Face)",
      finding: `Image classified as human-created (${(humanScore * 100).toFixed(1)}% confidence)`,
      severity,
      description: `The AI image detector model identifies this image as human-created/authentic with ${(humanScore * 100).toFixed(1)}% confidence.`,
    });
  }

  if (confidence < 0.6) {
    findings.push({
      category: "AI Detection (Hugging Face)",
      finding: "Low confidence detection",
      severity: "medium",
      description: `Model confidence is only ${(confidence * 100).toFixed(1)}% — the result is uncertain.`,
    });
  }

  return { hfScore, isAIGenerated, confidence, rawLabel: topLabel, findings };
}

// ─── Metadata Extraction ────────────────────────────────────────────────────

interface MetadataResult {
  exifData: Record<string, string>;
  metadataFindings: { category: string; finding: string; severity: "low" | "medium" | "high"; description: string }[];
}

function extractMetadata(
  uint8: Uint8Array,
  fileType: string,
  fileName: string,
  fileSize: number,
  mimeType: string,
): MetadataResult {
  const findings: MetadataResult["metadataFindings"] = [];
  let exifData: Record<string, string> = {};

  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const format = EXT_TO_FORMAT[ext] || ext;
  const magicValid = matchesMagicBytes(uint8, format);

  if (!magicValid) {
    findings.push({ category: "File Structure", finding: "Magic bytes mismatch", severity: "high", description: `Binary signature doesn't match .${ext} format.` });
  }

  if (fileType === "image") {
    if (uint8[0] === 0xFF && uint8[1] === 0xD8) {
      exifData = extractJpegExif(uint8);
      if (exifData["EXIF Data"] === "Present") {
        findings.push({ category: "Metadata", finding: "EXIF data present", severity: "low", description: "Original camera metadata found." });
        if (exifData["Camera Make"] || exifData["Camera Model"]) {
          exifData["Camera"] = [exifData["Camera Make"], exifData["Camera Model"]].filter(Boolean).join(" ");
        }
        if (exifData["Software"]) {
          findings.push({ category: "Metadata", finding: `Software: ${exifData["Software"]}`, severity: "low", description: `Image was processed by "${exifData["Software"]}".` });
        }
      } else {
        findings.push({ category: "Metadata", finding: "EXIF data stripped", severity: "medium", description: "No camera metadata found." });
      }
    } else if (uint8[0] === 0x89 && uint8[1] === 0x50) {
      exifData = extractPngMetadata(uint8);
    } else if (uint8[0] === 0x47 && uint8[1] === 0x49) {
      exifData = { Format: "GIF" };
    }
  } else if (fileType === "document") {
    exifData = { Format: format.toUpperCase() };
    if (format === "pdf") {
      const header = new TextDecoder().decode(uint8.slice(0, 20));
      const versionMatch = header.match(/%PDF-(\d\.\d)/);
      if (versionMatch) exifData["PDF Version"] = versionMatch[1];
    }
  } else if (fileType === "video") {
    exifData = { Format: format.toUpperCase() };
  }

  exifData["File Size"] = fileSize >= 1048576 ? `${(fileSize / 1048576).toFixed(1)} MB` : `${(fileSize / 1024).toFixed(1)} KB`;

  return { exifData, metadataFindings: findings };
}

// ─── Direct Analysis (no DB, for guest users) ──────────────────────────────

async function handleDirectAnalysis(req: Request): Promise<Response> {
  try {
    const contentType = req.headers.get("content-type") || "";
    
    let fileBytes: Uint8Array;
    let fileName = "uploaded-file";
    let fileType = "image";
    let mimeType = "image/jpeg";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return new Response(JSON.stringify({ error: "No file provided" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      fileBytes = new Uint8Array(await file.arrayBuffer());
      fileName = file.name;
      mimeType = file.type || "image/jpeg";
      
      if (mimeType.startsWith("image/")) fileType = "image";
      else if (mimeType.startsWith("video/")) fileType = "video";
      else fileType = "document";
    } else {
      // JSON body with base64
      const body = await req.json();
      if (!body.imageBase64) {
        return new Response(JSON.stringify({ error: "No imageBase64 provided" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const binaryStr = atob(body.imageBase64);
      fileBytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) fileBytes[i] = binaryStr.charCodeAt(i);
      fileName = body.fileName || "uploaded-file";
      fileType = body.fileType || "image";
      mimeType = body.mimeType || "image/jpeg";
    }

    console.log(`Direct analysis: ${fileName} (${fileBytes.length} bytes, type=${fileType})`);

    // Compute SHA-256
    const hashBuffer = await crypto.subtle.digest("SHA-256", fileBytes);
    const sha256 = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

    // Extract metadata
    const { exifData, metadataFindings } = extractMetadata(fileBytes, fileType, fileName, fileBytes.length, mimeType);
    exifData["SHA-256"] = sha256.substring(0, 16) + "...";

    const allFindings = [...metadataFindings];

    let elaScore: number | null = null;
    let hfScore: number | null = null;
    let finalScore = 50;

    if (fileType === "image") {
      const [pythonResult, hfResult] = await Promise.all([
        callPythonELA(fileBytes, fileName),
        analyzeWithHuggingFace(fileBytes, mimeType),
      ]);

      if (pythonResult) {
        elaScore = pythonResult.overall_score;
        for (const f of pythonResult.findings) {
          allFindings.push({ category: `ELA: ${f.category}`, finding: f.finding, severity: f.severity as "low" | "medium" | "high", description: f.description });
        }
        exifData["ELA Score"] = `${pythonResult.ela_score}/100`;
        exifData["Noise Consistency"] = `${pythonResult.noise_score}/100`;
        exifData["Clone Detection"] = `${pythonResult.clone_score}/100`;
        exifData["ELA Analysis"] = "Completed";
      }

      if (hfResult) {
        hfScore = hfResult.hfScore;
        for (const f of hfResult.findings) allFindings.push(f);
        exifData["HF AI Detection"] = hfResult.rawLabel;
        exifData["HF Score"] = `${hfResult.hfScore}/100`;
        exifData["HF Confidence"] = `${(hfResult.confidence * 100).toFixed(1)}%`;
      }

      if (elaScore !== null && hfScore !== null) {
        finalScore = Math.round(elaScore * 0.5 + hfScore * 0.5);
        exifData["Scoring Method"] = "50% ELA + 50% Hugging Face";
      } else if (hfScore !== null) {
        finalScore = hfScore;
        exifData["Scoring Method"] = "100% Hugging Face (ELA unavailable)";
      } else if (elaScore !== null) {
        finalScore = elaScore;
        exifData["Scoring Method"] = "100% ELA (HF unavailable)";
      } else {
        finalScore = 50;
        exifData["Scoring Method"] = "Default (no analysis engines available)";
        allFindings.push({ category: "Analysis Status", finding: "No analysis engines available", severity: "high", description: "Neither ELA nor Hugging Face were available." });
      }
    } else {
      finalScore = 50;
      allFindings.push({ category: "File Type", finding: `${fileType} analysis`, severity: "low", description: `Deep analysis is only available for images.` });
    }

    finalScore = Math.max(0, Math.min(100, finalScore));

    let authenticityLevel: string;
    let summary: string;
    if (finalScore >= 75) {
      authenticityLevel = "authentic";
      summary = "Analysis indicates this image is authentic with high confidence.";
    } else if (finalScore >= 35) {
      authenticityLevel = "suspicious";
      summary = "Analysis shows indicators of possible modification or AI generation.";
    } else {
      authenticityLevel = "manipulated";
      summary = "Analysis strongly indicates this image is AI-generated or heavily manipulated.";
    }

    const result = {
      id: crypto.randomUUID(),
      fileName,
      fileType,
      status: "completed",
      authenticityLevel,
      confidenceScore: finalScore,
      summary,
      details: allFindings,
      exifData,
      hashInfo: { sha256, md5: "n/a", isModified: authenticityLevel !== "authentic" },
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Direct analysis error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

// ─── Edge Function Handler ──────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check if this is a direct/guest analysis (query param or header)
    const url = new URL(req.url);
    const isGuest = url.searchParams.get("guest") === "true";

    if (isGuest) {
      return handleDirectAnalysis(req);
    }

    // ── Authenticated flow (existing) ──
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
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
      await adminClient.from("analyses").update({ status: "failed", summary: "Failed to download file." }).eq("id", analysisId);
      return new Response(JSON.stringify({ error: "File download failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const sha256 = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

    const { exifData, metadataFindings } = extractMetadata(uint8, analysis.file_type, analysis.file_name, analysis.file_size, fileData.type);
    exifData["SHA-256"] = sha256.substring(0, 16) + "...";

    const allFindings = [...metadataFindings];

    let elaScore: number | null = null;
    let hfScore: number | null = null;
    let finalScore = 50;

    if (analysis.file_type === "image") {
      const [pythonResult, hfResult] = await Promise.all([
        callPythonELA(uint8, analysis.file_name),
        analyzeWithHuggingFace(uint8, fileData.type),
      ]);

      if (pythonResult) {
        elaScore = pythonResult.overall_score;
        for (const f of pythonResult.findings) {
          allFindings.push({ category: `ELA: ${f.category}`, finding: f.finding, severity: f.severity as "low" | "medium" | "high", description: f.description });
        }
        exifData["ELA Score"] = `${pythonResult.ela_score}/100`;
        exifData["Noise Consistency"] = `${pythonResult.noise_score}/100`;
        exifData["Clone Detection"] = `${pythonResult.clone_score}/100`;
        exifData["ELA Analysis"] = "Completed";
      }

      if (hfResult) {
        hfScore = hfResult.hfScore;
        for (const f of hfResult.findings) allFindings.push(f);
        exifData["HF AI Detection"] = hfResult.rawLabel;
        exifData["HF Score"] = `${hfResult.hfScore}/100`;
        exifData["HF Confidence"] = `${(hfResult.confidence * 100).toFixed(1)}%`;
      }

      if (elaScore !== null && hfScore !== null) {
        finalScore = Math.round(elaScore * 0.5 + hfScore * 0.5);
        exifData["Scoring Method"] = "50% ELA + 50% Hugging Face";
      } else if (hfScore !== null) {
        finalScore = hfScore;
        exifData["Scoring Method"] = "100% Hugging Face (ELA unavailable)";
      } else if (elaScore !== null) {
        finalScore = elaScore;
        exifData["Scoring Method"] = "100% ELA (HF unavailable)";
      } else {
        finalScore = 50;
        exifData["Scoring Method"] = "Default (no analysis engines available)";
        allFindings.push({ category: "Analysis Status", finding: "No analysis engines available", severity: "high", description: "Neither ELA nor HF were available." });
      }
    } else {
      finalScore = 50;
      allFindings.push({ category: "File Type", finding: `${analysis.file_type} analysis`, severity: "low", description: `Deep analysis is only available for images.` });
    }

    finalScore = Math.max(0, Math.min(100, finalScore));

    let authenticityLevel: string;
    let summary: string;
    if (finalScore >= 75) {
      authenticityLevel = "authentic";
      summary = "Analysis indicates this image is authentic with high confidence.";
    } else if (finalScore >= 35) {
      authenticityLevel = "suspicious";
      summary = "Analysis shows indicators of possible modification or AI generation.";
    } else {
      authenticityLevel = "manipulated";
      summary = "Analysis strongly indicates this image is AI-generated or heavily manipulated.";
    }

    const hashInfo = { sha256, md5: "n/a", isModified: authenticityLevel !== "authentic" };

    await adminClient.from("analyses").update({
      status: "completed",
      authenticity_level: authenticityLevel,
      confidence_score: finalScore,
      summary,
      details: allFindings,
      exif_data: exifData,
      hash_info: hashInfo,
      completed_at: new Date().toISOString(),
    }).eq("id", analysisId);

    return new Response(
      JSON.stringify({ success: true, analysisId, authenticityLevel, confidenceScore: finalScore }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Process file error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
