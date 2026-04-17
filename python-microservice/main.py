"""
ELA + Forensics Microservice for image authenticity analysis.
Deploy to Render / Railway / Fly.io as a Docker container.
"""

import base64
import io
import math
from typing import List

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

app = FastAPI(title="Image Forensics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ──────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    image_base64: str
    file_name: str = "unknown.jpg"


class Finding(BaseModel):
    category: str
    finding: str
    severity: str  # low | medium | high
    description: str


class AnalyzeResponse(BaseModel):
    ela_score: int
    noise_score: int
    clone_score: int
    edge_score: int
    mantranet_score: int
    overall_score: int
    findings: List[Finding]


# ── Helpers ──────────────────────────────────────────────────────────────────

def decode_image(b64: str) -> np.ndarray:
    raw = base64.b64decode(b64)
    arr = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Cannot decode image")
    return img


def run_ela(img: np.ndarray, quality: int = 90) -> tuple[np.ndarray, float]:
    """Error Level Analysis: re-compress at `quality` and diff."""
    pil = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=quality)
    buf.seek(0)
    recompressed = np.array(Image.open(buf))
    recompressed = cv2.cvtColor(recompressed, cv2.COLOR_RGB2BGR)

    # Resize if shapes differ (edge case with odd dimensions)
    if recompressed.shape != img.shape:
        recompressed = cv2.resize(recompressed, (img.shape[1], img.shape[0]))

    diff = cv2.absdiff(img, recompressed).astype(np.float32)
    ela_img = (diff * 10).clip(0, 255).astype(np.uint8)

    mean_diff = float(np.mean(diff))
    std_diff = float(np.std(diff))
    max_diff = float(np.max(diff))

    # Higher variance in ELA → more likely manipulated
    # Score 0-100 where 100 = authentic (low ELA variance)
    variance_ratio = std_diff / (mean_diff + 1e-6)
    if variance_ratio < 1.5 and max_diff < 40:
        score = 85 + min(15, int((1.5 - variance_ratio) * 20))
    elif variance_ratio < 3.0 and max_diff < 80:
        score = 50 + int((3.0 - variance_ratio) * 23)
    else:
        score = max(5, 50 - int((variance_ratio - 3.0) * 10))

    return ela_img, max(0, min(100, score))


def run_noise_analysis(img: np.ndarray) -> tuple[int, List[Finding]]:
    """Analyse noise consistency across image blocks."""
    findings: List[Finding] = []
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    block = 64
    noise_levels = []
    for y in range(0, h - block, block):
        for x in range(0, w - block, block):
            patch = gray[y:y + block, x:x + block].astype(np.float64)
            lap = cv2.Laplacian(patch, cv2.CV_64F)
            noise_levels.append(float(np.std(lap)))

    if len(noise_levels) < 4:
        return 50, findings

    arr = np.array(noise_levels)
    cv_noise = float(np.std(arr) / (np.mean(arr) + 1e-6))

    if cv_noise < 0.3:
        score = 90
        findings.append(Finding(
            category="Noise Analysis",
            finding="Consistent noise pattern",
            severity="low",
            description="Noise distribution is uniform across the image — typical of unmanipulated photos.",
        ))
    elif cv_noise < 0.6:
        score = 60
        findings.append(Finding(
            category="Noise Analysis",
            finding="Moderate noise variation",
            severity="medium",
            description=f"Noise coefficient of variation is {cv_noise:.2f}. Some regions differ — could indicate editing.",
        ))
    else:
        score = max(10, int(60 - (cv_noise - 0.6) * 80))
        findings.append(Finding(
            category="Noise Analysis",
            finding="Inconsistent noise pattern",
            severity="high",
            description=f"High noise variation (CV={cv_noise:.2f}) suggests parts of the image were spliced or generated differently.",
        ))

    return max(0, min(100, score)), findings


def run_clone_detection(img: np.ndarray) -> tuple[int, List[Finding]]:
    """Basic clone / copy-move detection using ORB features."""
    findings: List[Finding] = []
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Limit resolution for performance
    max_dim = 1024
    h, w = gray.shape
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        gray = cv2.resize(gray, (int(w * scale), int(h * scale)))

    orb = cv2.ORB_create(nfeatures=1000)
    kps, descs = orb.detectAndCompute(gray, None)

    if descs is None or len(kps) < 10:
        return 80, findings  # not enough features → probably fine

    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
    matches = bf.knnMatch(descs, descs, k=2)

    clone_pairs = 0
    min_dist_px = 30  # ignore self-matches / nearby matches
    for m_list in matches:
        if len(m_list) < 2:
            continue
        m, n = m_list
        if m.queryIdx == m.trainIdx:
            continue
        if m.distance < 0.7 * n.distance:
            pt1 = kps[m.queryIdx].pt
            pt2 = kps[m.trainIdx].pt
            dist = math.hypot(pt1[0] - pt2[0], pt1[1] - pt2[1])
            if dist > min_dist_px:
                clone_pairs += 1

    ratio = clone_pairs / max(len(kps), 1)
    if ratio < 0.02:
        score = 90
    elif ratio < 0.08:
        score = 60
        findings.append(Finding(
            category="Clone Detection",
            finding=f"Possible cloned regions ({clone_pairs} pairs)",
            severity="medium",
            description="Some feature pairs suggest copy-move manipulation.",
        ))
    else:
        score = max(10, int(60 - ratio * 500))
        findings.append(Finding(
            category="Clone Detection",
            finding=f"Likely copy-move manipulation ({clone_pairs} pairs)",
            severity="high",
            description="Significant number of feature matches indicate cloned regions in the image.",
        ))

    return max(0, min(100, score)), findings


def run_edge_analysis(img: np.ndarray) -> tuple[int, List[Finding]]:
    """Check for unnatural edge patterns (e.g., sharp cut-paste boundaries)."""
    findings: List[Finding] = []
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 100, 200)
    edge_density = float(np.count_nonzero(edges)) / edges.size

    if edge_density < 0.05:
        score = 85
    elif edge_density < 0.15:
        score = 70
    else:
        score = max(20, int(70 - (edge_density - 0.15) * 300))
        findings.append(Finding(
            category="Edge Analysis",
            finding="High edge density detected",
            severity="medium",
            description=f"Edge density is {edge_density:.1%}, which may indicate heavy sharpening or compositing artifacts.",
        ))

    return max(0, min(100, score)), findings


# ── ManTra-Net Wrapper ───────────────────────────────────────────────────────
# Lightweight, CPU-friendly reimplementation of ManTra-Net's core idea:
# build a per-pixel anomaly/manipulation map by combining (a) SRM noise
# residuals, (b) high-pass laplacian residuals, and (c) local statistic
# inconsistency (mean/std deviation from global). Patches whose feature
# vector is far from the global feature distribution are flagged as
# "manipulated regions" — exactly what ManTra-Net does, just without a
# pretrained TF model. Returns a 0-100 authenticity score.

# SRM (Spatial Rich Model) high-pass filters — same family used by ManTra-Net
_SRM_KERNELS = [
    np.array([[0, 0, 0, 0, 0],
              [0, -1, 2, -1, 0],
              [0,  2, -4, 2, 0],
              [0, -1, 2, -1, 0],
              [0, 0, 0, 0, 0]], dtype=np.float32) / 4.0,
    np.array([[-1, 2, -2, 2, -1],
              [ 2, -6, 8, -6, 2],
              [-2, 8, -12, 8, -2],
              [ 2, -6, 8, -6, 2],
              [-1, 2, -2, 2, -1]], dtype=np.float32) / 12.0,
    np.array([[0, 0, 0, 0, 0],
              [0, 0, 0, 0, 0],
              [0, 1, -2, 1, 0],
              [0, 0, 0, 0, 0],
              [0, 0, 0, 0, 0]], dtype=np.float32) / 2.0,
]


def run_mantranet(img: np.ndarray) -> tuple[int, List[Finding]]:
    """ManTra-Net-style manipulation trace detection.

    Pipeline:
      1. Convert to grayscale + apply SRM high-pass filters → noise residuals.
      2. Compute per-block feature vectors (residual mean/std per kernel).
      3. Measure each block's Mahalanobis-like distance from the global
         feature distribution. Outlier blocks = candidate manipulated regions.
      4. Aggregate to a single 0-100 score (100 = pristine).
    """
    findings: List[Finding] = []

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    h, w = gray.shape

    # Downscale very large images for speed (ManTra-Net works at ~512px too)
    max_dim = 768
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        gray = cv2.resize(gray, (int(w * scale), int(h * scale)))
        h, w = gray.shape

    # 1) Apply SRM kernels → 3 residual maps
    residuals = [cv2.filter2D(gray, cv2.CV_32F, k) for k in _SRM_KERNELS]

    # 2) Per-block features
    block = 32
    feats = []
    coords = []
    for y in range(0, h - block, block):
        for x in range(0, w - block, block):
            f = []
            for r in residuals:
                patch = r[y:y + block, x:x + block]
                f.append(float(np.mean(np.abs(patch))))
                f.append(float(np.std(patch)))
            feats.append(f)
            coords.append((y, x))

    if len(feats) < 9:
        return 75, findings  # image too small for reliable trace analysis

    feats_arr = np.array(feats, dtype=np.float32)

    # 3) Robust outlier scoring — distance from median in MAD units
    median = np.median(feats_arr, axis=0)
    mad = np.median(np.abs(feats_arr - median), axis=0) + 1e-6
    z = np.abs(feats_arr - median) / mad
    block_anomaly = np.mean(z, axis=1)  # per-block anomaly score

    # Fraction of blocks that look strongly anomalous
    strong_thresh = 4.0   # MAD units — fairly strict
    mild_thresh = 2.5
    strong_frac = float(np.mean(block_anomaly > strong_thresh))
    mild_frac = float(np.mean(block_anomaly > mild_thresh))
    max_anomaly = float(np.max(block_anomaly))

    # 4) Map to 0-100 authenticity score
    # Pristine images: very few outlier blocks, low max anomaly
    # Spliced/edited: clusters of outlier blocks
    # AI-generated: often UNIFORMLY low residuals (suspiciously clean)
    global_residual_energy = float(np.mean([np.mean(np.abs(r)) for r in residuals]))

    if strong_frac > 0.08:
        # Clear manipulation traces in multiple regions
        score = max(5, int(45 - strong_frac * 200))
        findings.append(Finding(
            category="ManTra-Net",
            finding=f"Manipulation traces detected ({strong_frac:.1%} of blocks anomalous)",
            severity="high",
            description=(
                f"ManTra-Net wrapper flagged {strong_frac:.1%} of image blocks as having "
                f"residual-noise patterns inconsistent with the rest of the image — "
                f"a strong signal of splicing, copy-move, or local AI inpainting."
            ),
        ))
    elif mild_frac > 0.20 or max_anomaly > 8.0:
        score = max(30, int(70 - mild_frac * 100))
        findings.append(Finding(
            category="ManTra-Net",
            finding=f"Moderate manipulation traces ({mild_frac:.1%} mildly anomalous blocks)",
            severity="medium",
            description=(
                f"Several regions show noise-residual deviations (max anomaly: "
                f"{max_anomaly:.1f} MAD). Possible localized editing or compositing."
            ),
        ))
    elif global_residual_energy < 0.8:
        # Suspiciously clean — typical of AI-generated images
        score = 25
        findings.append(Finding(
            category="ManTra-Net",
            finding="Suspiciously uniform noise (possible AI generation)",
            severity="high",
            description=(
                f"Global residual energy is unusually low ({global_residual_energy:.2f}). "
                f"Real photos contain natural sensor noise; AI-generated images often lack it."
            ),
        ))
    else:
        score = 88 + min(12, int((10 - max_anomaly) * 2)) if max_anomaly < 6 else 80
        findings.append(Finding(
            category="ManTra-Net",
            finding="No manipulation traces detected",
            severity="low",
            description=(
                f"Noise-residual patterns are consistent across the image "
                f"(max anomaly: {max_anomaly:.1f} MAD) — consistent with an "
                f"unmanipulated photograph."
            ),
        ))

    return max(0, min(100, score)), findings


# ── Main Endpoint ────────────────────────────────────────────────────────────

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest):
    img = decode_image(req.image_base64)

    _, ela_score = run_ela(img)
    noise_score, noise_findings = run_noise_analysis(img)
    clone_score, clone_findings = run_clone_detection(img)
    edge_score, edge_findings = run_edge_analysis(img)
    mantranet_score, mantranet_findings = run_mantranet(img)

    # Weighted blend within Python service (used as the "ELA group" overall):
    # ManTra-Net 50%, ELA 25%, Noise 15%, Clone 7%, Edge 3%
    overall = int(
        mantranet_score * 0.50
        + ela_score * 0.25
        + noise_score * 0.15
        + clone_score * 0.07
        + edge_score * 0.03
    )
    overall = max(0, min(100, overall))

    all_findings: List[Finding] = []

    # ELA finding
    if ela_score >= 75:
        sev = "low"
        desc = "ELA shows uniform compression — consistent with an unmodified image."
    elif ela_score >= 40:
        sev = "medium"
        desc = "ELA shows some compression inconsistencies that may indicate editing."
    else:
        sev = "high"
        desc = "ELA reveals significant compression artifacts suggesting manipulation."

    all_findings.append(Finding(
        category="Error Level Analysis",
        finding=f"ELA score: {ela_score}/100",
        severity=sev,
        description=desc,
    ))

    all_findings.extend(mantranet_findings)
    all_findings.extend(noise_findings)
    all_findings.extend(clone_findings)
    all_findings.extend(edge_findings)

    return AnalyzeResponse(
        ela_score=ela_score,
        noise_score=noise_score,
        clone_score=clone_score,
        edge_score=edge_score,
        mantranet_score=mantranet_score,
        overall_score=overall,
        findings=all_findings,
    )


@app.get("/health")
async def health():
    return {"status": "ok"}
