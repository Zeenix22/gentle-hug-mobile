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
  findings: { category: string; finding: string; severity: string; description: string }[];
}

import { uint8ToBase64, validateBase64 } from "./encoding.ts";
export { uint8ToBase64, validateBase64 };

async function callPythonELA(uint8: Uint8Array, fileName: string): Promise<PythonAnalysisResult | null> {
  const pythonUrl = Deno.env.get("PYTHON_ANALYSIS_URL");
  if (!pythonUrl) {
    console.log("PYTHON_ANALYSIS_URL not set — skipping ELA analysis");
    return null;
  }

  try {
    const expectedBytes = Math.min(uint8.length, 10_000_000);
    const base64 = uint8ToBase64(uint8);

    // Validate before posting — catches malformed/chunk-encoded base64 locally
    // instead of paying a network round-trip to get "Cannot decode image".
    const validation = validateBase64(base64, expectedBytes);
    if (!validation.ok) {
      console.error(
        `Base64 validation failed for ${fileName}: ${validation.reason} ` +
        `(b64.length=${base64.length}, expectedBytes=${expectedBytes})`,
      );
      return null;
    }

    // Use the lightweight /ela endpoint (ELA only — robust, fast, never 500s
    // on PNG/odd inputs because heavy engines like SIFT/FFT/Face are skipped).
    const response = await fetch(`${pythonUrl}/ela`, {
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

// ─── Sightengine (deepfake + AI-generated image detection) ─────────────────

interface SightengineResult {
  score: number; // 0-100 (higher = more authentic)
  deepfakeProb: number;
  aiGenProb: number;
  findings: Finding[];
}

async function callSightengine(
  uint8: Uint8Array,
  fileName: string,
  mimeType: string,
): Promise<SightengineResult | null> {
  const apiUser = Deno.env.get("SIGHTENGINE_API_USER");
  const apiSecret = Deno.env.get("SIGHTENGINE_API_SECRET");
  if (!apiUser || !apiSecret) {
    console.log("Sightengine credentials not set — skipping AI/deepfake detection");
    return null;
  }

  try {
    const form = new FormData();
    form.append("media", new Blob([uint8], { type: mimeType || "image/jpeg" }), fileName);
    form.append("models", "deepfake,genai");
    form.append("api_user", apiUser);
    form.append("api_secret", apiSecret);

    const resp = await fetch("https://api.sightengine.com/1.0/check.json", {
      method: "POST",
      body: form,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Sightengine error:", resp.status, errText);
      return null;
    }

    const data = await resp.json();
    if (data.status !== "success") {
      console.error("Sightengine non-success:", JSON.stringify(data));
      return null;
    }

    const deepfakeProb = Number(data?.type?.deepfake ?? 0);
    const aiGenProb = Number(data?.type?.ai_generated ?? 0);

    // Higher probability of fake → lower authenticity score.
    // Take the max signal between deepfake and AI-generated.
    const maxFake = Math.max(deepfakeProb, aiGenProb);
    const score = Math.round((1 - maxFake) * 100);

    const findings: Finding[] = [];

    if (deepfakeProb >= 0.5) {
      findings.push({
        category: "Deepfake Detection",
        finding: `Deepfake probability: ${(deepfakeProb * 100).toFixed(1)}%`,
        severity: deepfakeProb >= 0.8 ? "high" : "medium",
        description: "Sightengine's deepfake model detected face manipulation or face-swap artifacts.",
      });
    } else {
      findings.push({
        category: "Deepfake Detection",
        finding: `Low deepfake signal (${(deepfakeProb * 100).toFixed(1)}%)`,
        severity: "low",
        description: "No significant face-swap or deepfake artifacts detected.",
      });
    }

    if (aiGenProb >= 0.5) {
      findings.push({
        category: "AI-Generated Detection",
        finding: `AI-generated probability: ${(aiGenProb * 100).toFixed(1)}%`,
        severity: aiGenProb >= 0.8 ? "high" : "medium",
        description: "Sightengine's genai model flagged this image as likely generated by AI (Midjourney, Stable Diffusion, DALL·E, Flux, etc.).",
      });
    } else {
      findings.push({
        category: "AI-Generated Detection",
        finding: `Low AI-generation signal (${(aiGenProb * 100).toFixed(1)}%)`,
        severity: "low",
        description: "No strong indicators of diffusion- or GAN-generated content.",
      });
    }

    return { score, deepfakeProb, aiGenProb, findings };
  } catch (err) {
    console.error("Sightengine call failed:", err);
    return null;
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
        findings.push({ category: "Metadata", finding: "EXIF data absent", severity: "low", description: "No camera metadata found — common for screenshots and re-exported images." });
      }
    } else if (uint8[0] === 0x89 && uint8[1] === 0x50) {
      exifData = extractPngMetadata(uint8);
    } else if (uint8[0] === 0x47 && uint8[1] === 0x49) {
      exifData = { Format: "GIF" };
    }

    // C2PA / Content Credentials provenance check (scans first 256KB for c2pa marker)
    const scanLen = Math.min(uint8.length, 262144);
    const decoder = new TextDecoder("utf-8", { fatal: false });
    const head = decoder.decode(uint8.slice(0, scanLen));
    const hasC2pa = /c2pa|jumbf|contentauth|urn:uuid:c2pa/i.test(head);
    const aiSoftware = /(midjourney|stable\s*diffusion|dall-?e|firefly|leonardo|runway|flux|sora|gfpgan|real-?esrgan|topaz|gigapixel)/i;
    const swMatch = (exifData["Software"] || "").match(aiSoftware) || head.match(aiSoftware);

    if (hasC2pa) {
      exifData["C2PA Provenance"] = "Present";
      findings.push({
        category: "Provenance (C2PA)",
        finding: "C2PA Content Credentials detected",
        severity: swMatch ? "high" : "low",
        description: swMatch
          ? `Content Credentials manifest indicates AI involvement (${swMatch[0]}).`
          : "Image carries a C2PA manifest documenting its origin/edit history.",
      });
    } else {
      exifData["C2PA Provenance"] = "Absent";
    }

    if (swMatch) {
      exifData["AI Tool Detected"] = swMatch[0];
      findings.push({
        category: "Provenance",
        finding: `AI tool signature: ${swMatch[0]}`,
        severity: "high",
        description: `Metadata or embedded markers reference "${swMatch[0]}", a known AI generation/restoration tool.`,
      });
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

function computeExifScore(exifData: Record<string, string>): { score: number; finding: Finding } {
  const aiTool = exifData["AI Tool Detected"];
  const c2pa = exifData["C2PA Provenance"] === "Present";
  const exifPresent = exifData["EXIF Data"] === "Present";
  const hasCamera = !!(exifData["Camera Make"] || exifData["Camera Model"] || exifData["Camera"]);
  const software = exifData["Software"];

  let score = 70;
  let severity: "low" | "medium" | "high" = "low";
  let finding = "EXIF metadata analyzed";
  let description = "Metadata signals evaluated for authenticity.";

  if (aiTool) {
    score = 5;
    severity = "high";
    finding = `AI tool signature in metadata: ${aiTool}`;
    description = `Metadata references "${aiTool}", a known AI generation/restoration tool. Strong evidence of synthetic origin.`;
  } else if (hasCamera && exifPresent) {
    score = 92;
    finding = "Authentic camera EXIF present";
    description = `Original camera metadata found (${[exifData["Camera Make"], exifData["Camera Model"]].filter(Boolean).join(" ") || "camera info"}). Consistent with a real photograph.`;
  } else if (exifPresent && software) {
    // Software-edited isn't necessarily fake — most photos are processed
    score = 70;
    severity = "low";
    finding = `EXIF present, processed by ${software}`;
    description = `Metadata indicates the image was processed by "${software}". Common for legitimate edits (color, crop, export).`;
  } else if (exifPresent) {
    score = 80;
    finding = "EXIF metadata present";
    description = "Image carries EXIF metadata, suggesting an unmanipulated source.";
  } else {
    // Stripped EXIF is the norm for web/social images — DON'T treat as suspicious.
    // Most screenshots, social uploads, and re-exports strip EXIF. Stay neutral.
    score = 65;
    severity = "low";
    finding = "EXIF metadata absent";
    description = "No EXIF metadata found — common for screenshots, social-media uploads, or re-exports. Not by itself a sign of manipulation.";
  }

  if (c2pa && !aiTool) {
    score = Math.min(100, score + 5);
    description += " C2PA Content Credentials present.";
  }

  return {
    score,
    finding: { category: "EXIF Metadata", finding, severity, description },
  };
}

async function runAllEngines(
  uint8: Uint8Array,
  fileName: string,
  _mimeType: string,
  exifData: Record<string, string>,
): Promise<{
  engines: EngineScore[];
  findings: Finding[];
  exifExtras: Record<string, string>;
}> {
  const findings: Finding[] = [];
  const exifExtras: Record<string, string> = {};
  const engines: EngineScore[] = [];

  // Engine 1: EXIF Metadata (weight: 30 — soft signal, easily stripped)
  const exifEval = computeExifScore(exifData);
  engines.push({ name: "EXIF", score: exifEval.score, weight: 20 });
  findings.push(exifEval.finding);
  exifExtras["EXIF Score"] = `${exifEval.score}/100`;

  // Engine 2: ELA via Python microservice (weight: 20 — pixel-level edits)
  const pythonResult = await callPythonELA(uint8, fileName);
  if (pythonResult) {
    engines.push({ name: "ELA", score: pythonResult.ela_score, weight: 20 });
    for (const f of pythonResult.findings) {
      if (!f.category.toLowerCase().includes("ela")) continue;
      findings.push({
        category: `ELA: ${f.category}`,
        finding: f.finding,
        severity: f.severity as "low" | "medium" | "high",
        description: f.description,
      });
    }
    exifExtras["ELA Score"] = `${pythonResult.ela_score}/100`;
    exifExtras["ELA Analysis"] = "Completed";
  } else {
    findings.push({
      category: "ELA",
      finding: "ELA engine unavailable",
      severity: "low",
      description: "The Python ELA microservice did not respond; score blended from available engines only.",
    });
  }

  // Engine 3: Sightengine (weight: 60 — deepfake + AI-generation, strongest signal)
  const sightResult = await callSightengine(uint8, fileName, _mimeType);
  if (sightResult) {
    engines.push({ name: "AI/Deepfake", score: sightResult.score, weight: 60 });
    findings.push(...sightResult.findings);
    exifExtras["AI/Deepfake Score"] = `${sightResult.score}/100`;
    exifExtras["Deepfake Probability"] = `${(sightResult.deepfakeProb * 100).toFixed(1)}%`;
    exifExtras["AI-Generated Probability"] = `${(sightResult.aiGenProb * 100).toFixed(1)}%`;
  } else {
    findings.push({
      category: "AI/Deepfake Detection",
      finding: "Sightengine unavailable",
      severity: "low",
      description: "Sightengine API did not respond or is not configured; score blended from remaining engines.",
    });
  }

  console.log(`Engines completed: ${engines.map(e => e.name).join(", ")} (${engines.length}/3)`);
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
      const { engines, findings, exifExtras } = await runAllEngines(fileBytes, fileName, mimeType, exifData);
      allFindings.push(...findings);
      Object.assign(exifData, exifExtras);

      const blended = computeBlendedScore(engines);
      finalScore = blended.finalScore;
      scoringMethod = blended.method;

      if (engines.length === 0) {
        allFindings.push({ category: "Analysis Status", finding: "No analysis engines available", severity: "high", description: "Neither EXIF nor ELA analysis produced a score." });
      }
    } else {
      allFindings.push({ category: "File Type", finding: `${fileType} analysis`, severity: "low", description: "Deep analysis is only available for images." });
    }

    exifData["Scoring Method"] = scoringMethod;
    finalScore = Math.max(0, Math.min(100, finalScore));

    let authenticityLevel: string;
    let summary: string;
    if (finalScore >= 85) {
      authenticityLevel = "authentic";
      summary = `This image is classified as human-created with a confidence score of ${finalScore}%. No significant signs of AI generation or manipulation were detected.`;
    } else if (finalScore >= 35) {
      authenticityLevel = "suspicious";
      summary = `This image shows signs of digital editing or manipulation. Confidence score: ${finalScore}%. Some elements appear altered while others remain authentic.`;
    } else {
      authenticityLevel = "manipulated";
      summary = `This image is classified as AI-generated with high confidence. Score: ${finalScore}%. Multiple indicators of artificial generation were detected.`;
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
      const { engines, findings, exifExtras } = await runAllEngines(uint8, analysis.file_name, fileData.type, exifData);
      allFindings.push(...findings);
      Object.assign(exifData, exifExtras);

      const blended = computeBlendedScore(engines);
      finalScore = blended.finalScore;
      scoringMethod = blended.method;

      if (engines.length === 0) {
        allFindings.push({ category: "Analysis Status", finding: "No analysis engines available", severity: "high", description: "Neither EXIF nor ELA analysis produced a score." });
      }
    } else {
      allFindings.push({ category: "File Type", finding: `${analysis.file_type} analysis`, severity: "low", description: "Deep analysis is only available for images." });
    }

    exifData["Scoring Method"] = scoringMethod;
    finalScore = Math.max(0, Math.min(100, finalScore));

    let authenticityLevel: string;
    let summary: string;
    if (finalScore >= 85) {
      authenticityLevel = "authentic";
      summary = `This image is classified as human-created with a confidence score of ${finalScore}%. No significant signs of AI generation or manipulation were detected.`;
    } else if (finalScore >= 35) {
      authenticityLevel = "suspicious";
      summary = `This image shows signs of digital editing or manipulation. Confidence score: ${finalScore}%. Some elements appear altered while others remain authentic.`;
    } else {
      authenticityLevel = "manipulated";
      summary = `This image is classified as AI-generated with high confidence. Score: ${finalScore}%. Multiple indicators of artificial generation were detected.`;
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
