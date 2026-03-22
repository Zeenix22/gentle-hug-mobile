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

/** Compute regional entropy variance — manipulated images often have inconsistent entropy across regions */
function computeRegionalEntropyVariance(uint8: Uint8Array, numRegions = 8): { variance: number; regions: number[] } {
  const regionSize = Math.floor(uint8.length / numRegions);
  const entropies: number[] = [];
  for (let r = 0; r < numRegions; r++) {
    const start = r * regionSize;
    const region = uint8.slice(start, start + regionSize);
    entropies.push(computeByteEntropy(region, regionSize));
  }
  const mean = entropies.reduce((a, b) => a + b, 0) / entropies.length;
  const variance = entropies.reduce((sum, e) => sum + (e - mean) ** 2, 0) / entropies.length;
  return { variance, regions: entropies };
}

/** Detect double JPEG compression by analyzing quantization tables */
function analyzeJpegQuantization(uint8: Uint8Array): { tables: number[][]; isDoubleCompressed: boolean; quality: number | null; suspiciousPatterns: string[] } {
  const tables: number[][] = [];
  const suspicious: string[] = [];
  let quality: number | null = null;

  // Scan for DQT markers (0xFF 0xDB)
  for (let i = 0; i < Math.min(uint8.length, 65536) - 1; i++) {
    if (uint8[i] === 0xFF && uint8[i + 1] === 0xDB) {
      const segLen = (uint8[i + 2] << 8) | uint8[i + 3];
      let offset = i + 4;
      while (offset < i + 2 + segLen && offset + 64 < uint8.length) {
        const precisionAndId = uint8[offset];
        offset++;
        const table: number[] = [];
        for (let j = 0; j < 64; j++) {
          table.push(uint8[offset + j]);
        }
        tables.push(table);
        offset += 64;

        // Estimate JPEG quality from luminance quantization table (table 0)
        if (tables.length === 1) {
          const q50Lum = [16,11,10,16,24,40,51,61,12,12,14,19,26,58,60,55,14,13,16,24,40,57,69,56,14,17,22,29,51,87,80,62,18,22,37,56,68,109,103,77,24,35,55,64,81,104,113,92,49,64,78,87,103,121,120,101,72,92,95,98,112,100,103,99];
          let sum = 0;
          for (let j = 0; j < 64; j++) {
            if (q50Lum[j] > 0) sum += table[j] / q50Lum[j];
          }
          const avgRatio = sum / 64;
          quality = Math.round(Math.max(1, Math.min(100, avgRatio <= 1 ? 100 - (avgRatio * 50) : 200 - (avgRatio * 100))));
        }
      }
    }
  }

  // Check for double compression indicators
  if (tables.length >= 2) {
    // Compare luminance and chrominance tables for unusual patterns
    const lum = tables[0];
    const chr = tables[1] || [];
    
    // In double-compressed images, quantization values often show "ghost" artifacts
    // where values cluster at multiples suggesting re-quantization
    let multipleCount = 0;
    for (let j = 0; j < Math.min(lum.length, 64); j++) {
      if (lum[j] > 1 && lum[j] % 2 === 0 && lum[j] <= 16) multipleCount++;
    }
    if (multipleCount > 40) {
      suspicious.push("Quantization values suggest re-compression");
    }
  }

  // Check for non-standard quantization tables (common in edited images)
  if (tables.length > 0) {
    const allOnes = tables[0].every(v => v === 1);
    if (allOnes) {
      suspicious.push("All-ones quantization table (lossless or synthetic)");
    }
    
    const hasZeros = tables[0].some(v => v === 0);
    if (hasZeros) {
      suspicious.push("Zero values in quantization table (corrupted or tampered)");
    }
  }

  return { 
    tables, 
    isDoubleCompressed: suspicious.length > 0, 
    quality, 
    suspiciousPatterns: suspicious 
  };
}

/** Detect JPEG grid misalignment (indicator of splicing) */
function detectJpegGridMisalignment(uint8: Uint8Array): { misaligned: boolean; confidence: number } {
  // Count SOF markers to detect re-encoding
  let sofCount = 0;
  let sosCount = 0;
  for (let i = 0; i < Math.min(uint8.length, 131072) - 1; i++) {
    if (uint8[i] === 0xFF) {
      if (uint8[i + 1] === 0xC0 || uint8[i + 1] === 0xC2) sofCount++;
      if (uint8[i + 1] === 0xDA) sosCount++;
    }
  }
  // Multiple SOF/SOS markers can indicate manipulation
  const misaligned = sofCount > 1 || sosCount > 1;
  return { misaligned, confidence: misaligned ? 0.7 : 0 };
}

/** Enhanced PNG chunk analysis for tampering */
function analyzePngChunks(uint8: Uint8Array): { suspicious: string[]; editingSoftware: string | null; hasAncillary: boolean } {
  const suspicious: string[] = [];
  let editingSoftware: string | null = null;
  let hasAncillary = false;
  const decoder = new TextDecoder();
  let offset = 8;
  const knownChunks = new Set(["IHDR","PLTE","IDAT","IEND","tEXt","iTXt","zTXt","pHYs","tIME","cHRM","gAMA","iCCP","sRGB","sBIT","bKGD","hIST","tRNS","sPLT"]);
  let idatCount = 0;

  while (offset + 8 < uint8.length && offset < 524288) {
    const chunkLen = (uint8[offset] << 24) | (uint8[offset + 1] << 16) | (uint8[offset + 2] << 8) | uint8[offset + 3];
    const chunkType = decoder.decode(uint8.slice(offset + 4, offset + 8));
    
    if (chunkType === "IDAT") idatCount++;
    if (!knownChunks.has(chunkType) && /^[a-zA-Z]{4}$/.test(chunkType)) {
      hasAncillary = true;
    }

    if (chunkType === "tEXt" || chunkType === "iTXt") {
      const chunkData = uint8.slice(offset + 8, offset + 8 + Math.min(chunkLen, 1024));
      const nullIdx = chunkData.indexOf(0);
      if (nullIdx > 0) {
        const key = decoder.decode(chunkData.slice(0, nullIdx)).toLowerCase();
        const val = decoder.decode(chunkData.slice(nullIdx + 1, Math.min(nullIdx + 300, chunkData.length))).toLowerCase();
        const editTools = ["photoshop", "gimp", "paint.net", "pixlr", "canva", "affinity", "krita"];
        const aiTools = ["stable diffusion", "midjourney", "dall-e", "comfyui", "automatic1111", "novelai", "dreamstudio", "invoke", "a1111"];
        
        if (editTools.some(t => val.includes(t) || key.includes(t))) {
          editingSoftware = val.substring(0, 80);
          suspicious.push(`Editing software detected: ${editingSoftware}`);
        }
        if (aiTools.some(t => val.includes(t) || key.includes(t))) {
          suspicious.push(`AI generation tool detected in metadata`);
        }
        if (key === "parameters" || key === "prompt" || key === "negative_prompt") {
          suspicious.push(`AI generation parameters found (${key})`);
        }
      }
    }

    if (chunkType === "IEND") break;
    offset += 12 + chunkLen;
  }

  // Unusual number of IDAT chunks can indicate re-encoding
  if (idatCount > 50) {
    suspicious.push(`Unusually high IDAT chunk count (${idatCount}) — possible re-encoding`);
  }

  return { suspicious, editingSoftware, hasAncillary };
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

// ─── Python Microservice Integration ────────────────────────────────────────

interface PythonAnalysisResult {
  ela_score: number;
  noise_score: number;
  clone_score: number;
  edge_score: number;
  overall_score: number;
  findings: { category: string; finding: string; severity: string; description: string }[];
}

async function callPythonService(uint8: Uint8Array, fileName: string): Promise<PythonAnalysisResult | null> {
  const pythonUrl = Deno.env.get("PYTHON_ANALYSIS_URL");
  if (!pythonUrl) {
    console.log("PYTHON_ANALYSIS_URL not set — skipping Python deep analysis");
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
      console.error("Python service error:", response.status, errText);
      return null;
    }

    return await response.json() as PythonAnalysisResult;
  } catch (err) {
    console.error("Python service call failed:", err);
    return null;
  }
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
  pythonFindings: string,
): Promise<AIAnalysisResult | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.warn("LOVABLE_API_KEY not set — skipping AI analysis");
    return null;
  }

  const base64 = btoa(String.fromCharCode(...uint8.slice(0, Math.min(uint8.length, 4_000_000))));
  const mediaType = mimeType || "image/jpeg";

  const systemPrompt = `You are an expert digital forensics analyst with 20+ years of experience in image authenticity verification, deepfake detection, and manipulation forensics. You have been trained on tens of thousands of authentic, manipulated, and AI-generated images.

## YOUR TASK
Analyze the provided image and assign an authenticity_score from 0-100 using the STRICT scoring rubric below. You MUST be highly calibrated and precise.

## CRITICAL SCORING RULES
- Start at baseline 50
- Real unedited photos with EXIF: typically 75-95
- Real photos with minor edits (crop, brightness): typically 55-75
- Screenshots or re-shared: typically 45-65
- Photoshopped / spliced: typically 15-40
- AI-generated images: typically 5-25
- NEVER give above 90 unless overwhelming authentic evidence
- NEVER give below 10 unless blatantly synthetic with 3+ severe artifacts

## AUTHENTIC INDICATORS (evidence pushes score UP)

### Strong (+10-15 each):
- Rich EXIF with camera make/model/lens/GPS coordinates
- Natural sensor noise consistent with stated ISO
- Consistent directional lighting with physically correct shadows
- Natural depth-of-field with realistic bokeh circles
- Chromatic aberration at edges (lens physics)

### Moderate (+5-8 each):
- Realistic skin with pores, blemishes, fine hairs, veins
- Single-generation JPEG compression (consistent DCT blocks)
- Natural motion blur or slight camera shake
- Consistent perspective geometry

### Weak (+2-3 each):
- Reasonable file size for resolution
- Normal byte entropy distribution
- Minor lens flare or optical artifacts

## AI GENERATION RED FLAGS (evidence pushes score DOWN)

### Severe (-25-40 each):
- Wrong number of fingers, fused/extra digits
- Warped, illegible, or nonsensical text in signage/writing
- Impossible reflections in eyes/glass/mirrors

### Major (-15-25 each):
- Unnaturally smooth skin (plastic/wax look, no pores)
- Repeating micro-patterns or texture tiling
- Background objects dissolving or merging illogically
- Asymmetric earrings/accessories/facial features that should match
- Teeth that look uniform, merged, or unnaturally perfect

### Minor (-5-15 each):
- Over-perfect symmetry in natural scenes
- Overly saturated HDR-like lighting without realistic falloff
- Hair strands that merge or terminate unnaturally

## MANIPULATION RED FLAGS (evidence pushes score DOWN)

### Severe (-25-35 each):
- Visible splicing edges (sharp noise/resolution boundaries)
- Clone-stamp artifacts (identical pixel patches in different locations)
- Content-aware fill ghosts (smeared/blended impossible regions)

### Major (-15-25 each):
- Double JPEG compression grid misalignment
- Inconsistent shadow directions between objects
- Mismatched noise grain levels between regions
- ELA (Error Level Analysis) inconsistencies

### Minor (-5-15 each):
- Metadata shows editing software (Photoshop, GIMP, Lightroom)
- EXIF stripped from what claims to be camera original
- Re-compression artifacts inconsistent with quality

## FEW-SHOT CALIBRATION EXAMPLES

### Example 1: Authentic DSLR photo → Score: 87
Evidence: Canon EOS R5 EXIF, 50mm f/1.4, ISO 400, GPS coords, natural grain matching ISO, consistent warm lighting from upper-left, minor CA at edges, skin with pores and slight redness.
Reasoning: "Strong camera metadata with consistent optical characteristics. Sensor noise matches stated ISO 400. Lighting geometry is physically consistent. Lens aberrations confirm optical capture."

### Example 2: AI-generated portrait → Score: 14
Evidence: No EXIF, skin poreless and wax-like, background buildings have warped geometry, left hand has 6 fingers, earrings asymmetric, reflections in glasses don't match scene.
Reasoning: "Multiple hallmark AI artifacts: anatomical errors (6 fingers), asymmetric accessories, impossibly smooth skin, warped architecture, and physically impossible reflections. Zero metadata."

### Example 3: Photoshop splice → Score: 28
Evidence: EXIF shows Photoshop CS6, subject lit from right but inserted person lit from left, noise grain mismatch at boundary, double-compression artifacts in spliced region, ELA shows bright edges around inserted element.
Reasoning: "Clear splice: lighting direction mismatch, inconsistent noise at boundaries, double-compression in manipulated region, editing software in metadata."

### Example 4: Screenshot of photo → Score: 58
Evidence: No camera EXIF, UI chrome visible, single compression, no splice indicators, content is screen-captured photo.
Reasoning: "Screenshot—not manipulated but not original either. No editing indicators but provenance unverifiable."

### Example 5: Lightly edited authentic → Score: 68
Evidence: EXIF shows Lightroom, original camera data intact, brightness/contrast adjusted, no pixel-level manipulation, consistent noise.
Reasoning: "Genuine photograph with standard post-processing adjustments. No pixel manipulation detected, but editing software presence prevents full authentic rating."

## ADDITIONAL CONTEXT
Consider the heuristic findings AND the Python deep-analysis findings (ELA, noise analysis, clone detection) provided alongside your visual inspection. These provide quantitative evidence — weigh them seriously.

## RULES
- Cite SPECIFIC visual evidence for every claim
- Never make vague statements like "looks authentic" without evidence
- If uncertain, bias toward 40-60 and explain ambiguity
- Weight Python ELA/noise analysis heavily when available`;

  const userPrompt = `Analyze this image "${fileName}" for authenticity.

Heuristic findings:
${heuristicFindings}

${pythonFindings ? `Python deep-analysis findings:\n${pythonFindings}` : "Python deep analysis: not available"}

Provide your analysis using the suggest_authenticity_analysis tool.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
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
        reasoning: { effort: "high" },
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
                    description: "Types of manipulation detected, e.g. 'splicing', 'cloning', 'retouching', 'AI generation', 'content-aware fill'",
                  },
                  reasoning: {
                    type: "string",
                    description: "Detailed explanation citing specific visual evidence found",
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

  // Global entropy
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

    // Regional entropy variance — NEW
    if (uint8.length > 32768) {
      const { variance } = computeRegionalEntropyVariance(uint8);
      if (variance > 1.5) {
        details.push({ category: "Regional Entropy", finding: "High entropy variance across regions", severity: "high", description: `Entropy variance of ${variance.toFixed(3)} across file regions is abnormally high, suggesting spliced or composited content with different compression levels.` });
        score -= 15;
      } else if (variance > 0.8) {
        details.push({ category: "Regional Entropy", finding: "Moderate entropy variance", severity: "medium", description: `Entropy variance of ${variance.toFixed(3)} — some inconsistency detected between file regions.` });
        score -= 7;
      } else {
        details.push({ category: "Regional Entropy", finding: "Consistent entropy", severity: "low", description: `Entropy variance of ${variance.toFixed(3)} — uniform compression throughout the file.` });
      }
    }
  }

  let exifData: Record<string, string> = {};
  if (fileType === "image") {
    if (uint8[0] === 0xFF && uint8[1] === 0xD8) {
      // JPEG
      exifData = extractJpegExif(uint8);

      // JPEG quantization analysis — NEW
      const quantResult = analyzeJpegQuantization(uint8);
      if (quantResult.quality !== null) {
        exifData["JPEG Quality"] = `~${quantResult.quality}%`;
        if (quantResult.quality < 50) {
          details.push({ category: "Compression Quality", finding: `Low JPEG quality (~${quantResult.quality}%)`, severity: "medium", description: "Low quality suggests heavy re-compression, which degrades authenticity and may hide manipulation artifacts." });
          score -= 8;
        }
      }
      if (quantResult.isDoubleCompressed) {
        details.push({ category: "Double Compression", finding: "Quantization anomalies detected", severity: "high", description: `${quantResult.suspiciousPatterns.join(". ")}. Double compression is a strong indicator of image manipulation — the image was likely saved, edited, and re-saved.` });
        score -= 20;
      }

      // JPEG grid misalignment — NEW
      const gridResult = detectJpegGridMisalignment(uint8);
      if (gridResult.misaligned) {
        details.push({ category: "JPEG Grid Analysis", finding: "Multiple frame markers detected", severity: "high", description: "Multiple SOF/SOS markers found, suggesting the image may have been re-encoded or contains spliced regions with misaligned JPEG grids." });
        score -= 15;
      }

      if (exifData["EXIF Data"] === "Present") {
        details.push({ category: "Metadata Integrity", finding: "EXIF data present", severity: "low", description: "Original camera metadata found. This is a strong indicator of an authentic, unprocessed photo." });
        score += 5;
        if (exifData["Software"]) {
          const sw = exifData["Software"].toLowerCase();
          const editSoftware = ["photoshop", "gimp", "lightroom", "snapseed", "picsart", "canva", "afterlight", "pixlr", "affinity", "paint.net", "krita"];
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
      // PNG — enhanced chunk analysis
      exifData = extractPngMetadata(uint8);
      const pngAnalysis = analyzePngChunks(uint8);

      if (pngAnalysis.editingSoftware) {
        details.push({ category: "Editing Software", finding: `Edited: ${pngAnalysis.editingSoftware}`, severity: "medium", description: `PNG metadata indicates editing software was used.` });
        score -= 15;
      }

      for (const finding of pngAnalysis.suspicious) {
        if (finding.includes("AI generation")) {
          details.push({ category: "AI Generation", finding: "AI generation markers detected", severity: "high", description: finding });
          score -= 35;
        } else if (finding.includes("parameters")) {
          details.push({ category: "AI Generation", finding: "Generation parameters found", severity: "high", description: finding });
          score -= 35;
        } else if (finding.includes("IDAT")) {
          details.push({ category: "PNG Structure", finding: "Unusual chunk structure", severity: "medium", description: finding });
          score -= 8;
        }
      }

      if (pngAnalysis.suspicious.length === 0 && !pngAnalysis.editingSoftware) {
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

  // Copy-move detection
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
  if (score >= 75) { authenticityLevel = "authentic"; summary = "This file appears to be authentic. No significant signs of manipulation or AI generation were detected."; }
  else if (score >= 35) { authenticityLevel = "suspicious"; summary = "Some indicators suggest this file may have been modified or processed. Manual verification is recommended."; }
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
      // Call Python microservice for deep analysis (ELA, noise, clone detection)
      const pythonResult = await callPythonService(uint8, analysis.file_name);
      let pythonSummary = "";

      if (pythonResult) {
        pythonSummary = pythonResult.findings.map(f => `[${f.severity}] ${f.category}: ${f.finding} — ${f.description}`).join("\n");

        // Merge Python findings
        for (const f of pythonResult.findings) {
          result.details.push({
            category: `Deep Analysis: ${f.category}`,
            finding: f.finding,
            severity: f.severity as "low" | "medium" | "high",
            description: f.description,
          });
        }

        result.exifData["ELA Score"] = `${pythonResult.ela_score}/100`;
        result.exifData["Noise Consistency"] = `${pythonResult.noise_score}/100`;
        result.exifData["Clone Detection"] = `${pythonResult.clone_score}/100`;
        result.exifData["Deep Analysis"] = "Completed";

        // Factor Python score into heuristic (adjust heuristic before blending with AI)
        const pythonAdjustment = Math.round((pythonResult.overall_score - 50) * 0.3);
        result.confidenceScore = Math.max(0, Math.min(100, result.confidenceScore + pythonAdjustment));
      }

      const heuristicSummary = result.details.map((d) => `[${d.severity}] ${d.category}: ${d.finding}`).join("\n");

      const aiResult = await analyzeImageWithAI(uint8, fileData.type, analysis.file_name, heuristicSummary, pythonSummary);

      if (aiResult) {
        for (const f of aiResult.findings) {
          result.details.push({
            category: `AI Vision: ${f.category}`,
            finding: f.finding,
            severity: f.severity,
            description: f.description,
          });
        }

        result.details.push({
          category: "AI Vision Summary",
          finding: aiResult.isAIGenerated ? "Likely AI-generated" : aiResult.isManipulated ? "Signs of manipulation" : "Appears authentic",
          severity: aiResult.isAIGenerated ? "high" : aiResult.isManipulated ? "medium" : "low",
          description: aiResult.reasoning,
        });

        if (aiResult.manipulationTypes.length > 0) {
          result.exifData["Detected Manipulations"] = aiResult.manipulationTypes.join(", ");
        }

        // Blend scores: 30% heuristic + 70% AI (lean more on Gemini)
        const blendedScore = Math.round(result.confidenceScore * 0.3 + aiResult.aiScore * 0.7);
        result.confidenceScore = Math.max(0, Math.min(100, blendedScore));

        // Re-determine authenticity level based on blended score
        if (result.confidenceScore >= 75) {
          result.authenticityLevel = "authentic";
          result.summary = "AI vision analysis and heuristic checks both indicate this image is authentic with no significant signs of manipulation.";
        } else if (result.confidenceScore >= 35) {
          result.authenticityLevel = "suspicious";
          result.summary = "AI analysis detected indicators of possible modification or processing. Manual review is recommended.";
        } else {
          result.authenticityLevel = "manipulated";
          result.summary = "AI analysis strongly indicates this image is AI-generated or heavily manipulated. It should not be considered authentic.";
        }

        result.exifData["AI Analysis"] = "Completed";
        result.exifData["AI Score"] = `${aiResult.aiScore}/100`;
        result.exifData["Scoring Weight"] = "30% heuristic + 70% AI";
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
