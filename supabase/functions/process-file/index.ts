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
    const CHUNK = 8192;
    let base64 = "";
    const len = Math.min(uint8.length, 10_000_000);
    for (let i = 0; i < len; i += CHUNK) {
      base64 += btoa(String.fromCharCode(...uint8.slice(i, Math.min(i + CHUNK, len))));
    }

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

// ─── AI Vision Analysis (Lovable AI Gateway / Gemini) ───────────────────────

interface AIVisionResult {
  aiScore: number; // 0-100 where 100 = definitely human, 0 = definitely AI
  isAIGenerated: boolean;
  confidence: number;
  analysis: string;
  findings: { category: string; finding: string; severity: "low" | "medium" | "high"; description: string }[];
}

async function analyzeWithAIVision(uint8: Uint8Array, mimeType: string): Promise<AIVisionResult | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.log("LOVABLE_API_KEY not set — skipping AI Vision analysis");
    return null;
  }

  try {
    const CHUNK = 8192;
    let base64 = "";
    const len = Math.min(uint8.length, 4_000_000); // 4MB limit for vision
    for (let i = 0; i < len; i += CHUNK) {
      base64 += btoa(String.fromCharCode(...uint8.slice(i, Math.min(i + CHUNK, len))));
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert AI image forensics analyst. Analyze the provided image and determine if it is:
1. AI-generated (by tools like Midjourney, DALL-E, Stable Diffusion, Flux, etc.)
2. Digitally manipulated/edited (Photoshop, face-swap, etc.)
3. An authentic/real photograph

Look for these specific indicators:
- Unnatural textures, too-smooth skin, plastic-like surfaces
- Inconsistent lighting and shadows
- Distorted or melted backgrounds, objects, text
- Anatomical errors (extra fingers, asymmetric features, weird ears/teeth)
- Repetitive patterns or artifacts typical of diffusion models
- Too-perfect symmetry or unnaturally uniform details
- Lack of natural camera noise/grain
- Inconsistent depth of field
- Signs of deepfake (face boundary artifacts, inconsistent skin tone)

You MUST respond with ONLY valid JSON in this exact format:
{
  "human_score": <number 0-100, where 100 means definitely real/human-created, 0 means definitely AI>,
  "is_ai": <boolean>,
  "confidence": <number 0.0-1.0>,
  "verdict": "<one of: authentic, ai_generated, manipulated, uncertain>",
  "reasoning": "<2-3 sentence explanation>",
  "indicators": ["<list of specific indicators found>"]
}`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this image for AI generation or manipulation. Be thorough and precise." },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType || "image/jpeg"};base64,${base64}`,
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Vision API error:", response.status, errText.substring(0, 500));
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    console.log("AI Vision raw response:", content.substring(0, 500));

    // Parse JSON from the response (handle markdown code blocks)
    let parsed: any;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      parsed = JSON.parse(jsonStr.trim());
    } catch {
      console.error("Failed to parse AI Vision JSON:", content.substring(0, 300));
      return null;
    }

    const humanScore = Math.max(0, Math.min(100, Math.round(parsed.human_score ?? 50)));
    const isAI = parsed.is_ai === true;
    const confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0.5));
    const findings: AIVisionResult["findings"] = [];

    const severity: "low" | "medium" | "high" = isAI
      ? (confidence > 0.85 ? "high" : confidence > 0.6 ? "medium" : "low")
      : (confidence > 0.85 ? "low" : "medium");

    findings.push({
      category: "AI Vision Analysis",
      finding: isAI
        ? `Image likely AI-generated (${(100 - humanScore)}% AI probability)`
        : `Image likely authentic (${humanScore}% human probability)`,
      severity,
      description: parsed.reasoning || "AI vision model analysis completed.",
    });

    if (parsed.indicators && Array.isArray(parsed.indicators)) {
      for (const indicator of parsed.indicators.slice(0, 5)) {
        findings.push({
          category: "AI Vision: Indicator",
          finding: String(indicator),
          severity: isAI ? "medium" : "low",
          description: `Detected during visual forensic analysis.`,
        });
      }
    }

    return { aiScore: humanScore, isAIGenerated: isAI, confidence, analysis: parsed.reasoning || "", findings };
  } catch (err) {
    console.error("AI Vision analysis error:", err);
    return null;
  }
}

// ─── Winston AI Detection ───────────────────────────────────────────────────

interface WinstonDetectionResult {
  winstonScore: number;
  isAIGenerated: boolean;
  confidence: number;
  findings: { category: string; finding: string; severity: "low" | "medium" | "high"; description: string }[];
}

async function analyzeWithWinston(uint8: Uint8Array, mimeType: string): Promise<WinstonDetectionResult | null> {
  const winstonApiKey = Deno.env.get("WINSTON_API_KEY");
  if (!winstonApiKey) {
    console.log("WINSTON_API_KEY not set — skipping Winston AI analysis");
    return null;
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const tempPath = `_winston_temp/${crypto.randomUUID()}.jpg`;
    const blob = new Blob([uint8], { type: mimeType || "image/jpeg" });

    const { error: uploadErr } = await adminClient.storage
      .from("uploads")
      .upload(tempPath, blob, { contentType: mimeType || "image/jpeg", upsert: true });

    if (uploadErr) {
      console.error("Winston temp upload failed:", uploadErr.message);
      return null;
    }

    const { data: signedData, error: signErr } = await adminClient.storage
      .from("uploads")
      .createSignedUrl(tempPath, 300);

    if (signErr || !signedData?.signedUrl) {
      console.error("Winston signed URL failed:", signErr?.message);
      await adminClient.storage.from("uploads").remove([tempPath]);
      return null;
    }

    console.log("Winston: calling API with signed URL");

    const response = await fetch("https://api.gowinston.ai/v2/image-detection", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${winstonApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: signedData.signedUrl }),
    });

    await adminClient.storage.from("uploads").remove([tempPath]).catch(() => {});

    if (!response.ok) {
      const errText = await response.text();
      console.error("Winston AI API error:", response.status, errText.substring(0, 500));
      return null;
    }

    const data = await response.json();
    console.log("Winston raw response:", JSON.stringify(data).substring(0, 500));
    return parseWinstonResponse(data);
  } catch (err) {
    console.error("Winston AI analysis error:", err);
    return null;
  }
}

function parseWinstonResponse(data: any): WinstonDetectionResult {
  const findings: WinstonDetectionResult["findings"] = [];

  try {
    const score = data?.score ?? null;
    const humanProb = data?.human_probability;

    if (score === null && humanProb === undefined) {
      console.warn("Winston response missing score:", JSON.stringify(data).substring(0, 500));
      return { winstonScore: 50, isAIGenerated: false, confidence: 0, findings: [] };
    }

    const winstonScore = Math.round(score ?? (humanProb * 100));
    const isAIGenerated = winstonScore < 50;

    const severity: "low" | "medium" | "high" = isAIGenerated
      ? (winstonScore < 20 ? "high" : winstonScore < 40 ? "medium" : "low")
      : (winstonScore > 80 ? "low" : "medium");

    findings.push({
      category: "AI Detection (Winston AI)",
      finding: isAIGenerated
        ? `Likely AI-generated (human score: ${winstonScore}%)`
        : `Likely human-created (human score: ${winstonScore}%)`,
      severity,
      description: `Winston AI assigns a human probability of ${winstonScore}%. ${isAIGenerated ? "This suggests the image may be AI-generated." : "This suggests the image is likely authentic."}`,
    });

    return { winstonScore, isAIGenerated, confidence: Math.abs(winstonScore - 50) / 50, findings };
  } catch (err) {
    console.error("Error parsing Winston response:", err);
    return { winstonScore: 50, isAIGenerated: false, confidence: 0, findings: [] };
  }
}

// ─── Multi-Engine Score Blending ────────────────────────────────────────────

interface EngineScore {
  name: string;
  score: number;
  weight: number;
}

function computeBlendedScore(engines: EngineScore[]): { finalScore: number; method: string } {
  if (engines.length === 0) {
    return { finalScore: 50, method: "Default (no analysis engines available)" };
  }

  const totalWeight = engines.reduce((sum, e) => sum + e.weight, 0);
  const weightedSum = engines.reduce((sum, e) => sum + e.score * e.weight, 0);
  const finalScore = Math.round(weightedSum / totalWeight);

  const parts = engines.map(e => {
    const pct = Math.round((e.weight / totalWeight) * 100);
    return `${pct}% ${e.name}`;
  });
  const method = parts.join(" + ");

  return { finalScore: Math.max(0, Math.min(100, finalScore)), method };
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

// ─── Run All Analysis Engines ───────────────────────────────────────────────

type Finding = { category: string; finding: string; severity: "low" | "medium" | "high"; description: string };

async function runAllEngines(
  uint8: Uint8Array,
  fileName: string,
  mimeType: string,
): Promise<{
  engines: EngineScore[];
  findings: Finding[];
  exifExtras: Record<string, string>;
}> {
  const findings: Finding[] = [];
  const exifExtras: Record<string, string> = {};
  const engines: EngineScore[] = [];

  // Run 3 engines in parallel: ELA, AI Vision (Gemini), Winston AI
  const [pythonResult, aiVisionResult, winstonResult] = await Promise.all([
    callPythonELA(uint8, fileName),
    analyzeWithAIVision(uint8, mimeType),
    analyzeWithWinston(uint8, mimeType),
  ]);

  // ELA (weight: 25)
  if (pythonResult) {
    engines.push({ name: "ELA", score: pythonResult.overall_score, weight: 25 });
    for (const f of pythonResult.findings) {
      findings.push({ category: `ELA: ${f.category}`, finding: f.finding, severity: f.severity as "low" | "medium" | "high", description: f.description });
    }
    exifExtras["ELA Score"] = `${pythonResult.ela_score}/100`;
    exifExtras["Noise Consistency"] = `${pythonResult.noise_score}/100`;
    exifExtras["Clone Detection"] = `${pythonResult.clone_score}/100`;
    exifExtras["ELA Analysis"] = "Completed";
  }

  // AI Vision / Gemini (weight: 40)
  if (aiVisionResult) {
    engines.push({ name: "AI Vision", score: aiVisionResult.aiScore, weight: 40 });
    for (const f of aiVisionResult.findings) findings.push(f);
    exifExtras["AI Vision Score"] = `${aiVisionResult.aiScore}/100`;
    exifExtras["AI Vision Verdict"] = aiVisionResult.isAIGenerated ? "AI-Generated" : "Human-Created";
  }

  // Winston AI (weight: 35)
  if (winstonResult) {
    engines.push({ name: "Winston AI", score: winstonResult.winstonScore, weight: 35 });
    for (const f of winstonResult.findings) findings.push(f);
    exifExtras["Winston Score"] = `${winstonResult.winstonScore}/100`;
    exifExtras["Winston AI Detection"] = winstonResult.isAIGenerated ? "AI-Generated" : "Human-Created";
  }

  const engineNames = engines.map(e => e.name).join(", ");
  console.log(`Engines completed: ${engineNames || "none"} (${engines.length}/3)`);

  return { engines, findings, exifExtras };
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

    const hashBuffer = await crypto.subtle.digest("SHA-256", fileBytes);
    const sha256 = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

    const { exifData, metadataFindings } = extractMetadata(fileBytes, fileType, fileName, fileBytes.length, mimeType);
    exifData["SHA-256"] = sha256.substring(0, 16) + "...";

    const allFindings: Finding[] = [...metadataFindings];
    let finalScore = 50;
    let scoringMethod = "Default (no analysis engines available)";

    if (fileType === "image") {
      const { engines, findings, exifExtras } = await runAllEngines(fileBytes, fileName, mimeType);
      allFindings.push(...findings);
      Object.assign(exifData, exifExtras);

      const blended = computeBlendedScore(engines);
      finalScore = blended.finalScore;
      scoringMethod = blended.method;

      if (engines.length === 0) {
        allFindings.push({ category: "Analysis Status", finding: "No analysis engines available", severity: "high", description: "None of the detection engines (ELA, AI Vision, Winston) were available." });
      }
    } else {
      allFindings.push({ category: "File Type", finding: `${fileType} analysis`, severity: "low", description: "Deep analysis is only available for images." });
    }

    exifData["Scoring Method"] = scoringMethod;
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
    const url = new URL(req.url);
    const isGuest = url.searchParams.get("guest") === "true";

    if (isGuest) {
      return handleDirectAnalysis(req);
    }

    // ── Authenticated flow ──
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

    const allFindings: Finding[] = [...metadataFindings];
    let finalScore = 50;
    let scoringMethod = "Default (no analysis engines available)";

    if (analysis.file_type === "image") {
      const { engines, findings, exifExtras } = await runAllEngines(uint8, analysis.file_name, fileData.type);
      allFindings.push(...findings);
      Object.assign(exifData, exifExtras);

      const blended = computeBlendedScore(engines);
      finalScore = blended.finalScore;
      scoringMethod = blended.method;

      if (engines.length === 0) {
        allFindings.push({ category: "Analysis Status", finding: "No analysis engines available", severity: "high", description: "None of the detection engines were available." });
      }
    } else {
      allFindings.push({ category: "File Type", finding: `${analysis.file_type} analysis`, severity: "low", description: "Deep analysis is only available for images." });
    }

    exifData["Scoring Method"] = scoringMethod;
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
