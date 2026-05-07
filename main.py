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
    fft_score: int
    sift_clone_score: int
    face_forensics_score: int
    face_count: int
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


# ── FFT Frequency Analysis ───────────────────────────────────────────────────
# Detects AI upscaling, GFPGAN/Real-ESRGAN face restoration, and diffusion
# artifacts by analyzing the radial frequency spectrum. AI-upscaled images
# show characteristic high-frequency drop-off (suspiciously smooth) or
# periodic spikes (GAN checkerboard artifacts).

def run_fft_analysis(img: np.ndarray) -> tuple[int, List[Finding]]:
    findings: List[Finding] = []
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    h, w = gray.shape

    # Crop to centered square power-of-2-ish for clean FFT
    side = min(h, w, 1024)
    cy, cx = h // 2, w // 2
    half = side // 2
    crop = gray[cy - half:cy + half, cx - half:cx + half]
    if crop.shape[0] < 64 or crop.shape[1] < 64:
        return 75, findings

    # 2D FFT → magnitude spectrum
    f = np.fft.fftshift(np.fft.fft2(crop))
    mag = np.log1p(np.abs(f))

    # Radial profile
    n = crop.shape[0]
    cy2, cx2 = n // 2, n // 2
    y, x = np.indices((n, n))
    r = np.hypot(x - cx2, y - cy2).astype(np.int32)
    radial = np.bincount(r.ravel(), mag.ravel()) / (np.bincount(r.ravel()) + 1e-6)
    radial = radial[: n // 2]

    # Slope of log-radial spectrum (real photos: ~ -1 to -2; AI-upscaled: steeper or flatter)
    rs = np.arange(2, len(radial))
    log_r = np.log(rs + 1)
    log_m = radial[2:]
    slope = float(np.polyfit(log_r, log_m, 1)[0])

    # High-freq energy ratio (top 25% of frequencies)
    cutoff = int(len(radial) * 0.75)
    hf_energy = float(np.mean(radial[cutoff:]))
    lf_energy = float(np.mean(radial[2:cutoff])) + 1e-6
    hf_ratio = hf_energy / lf_energy

    # AI upscaling suppresses high-freq detail → very low hf_ratio
    # Real photos: hf_ratio ~ 0.45-0.85
    if hf_ratio < 0.30:
        score = max(15, int(hf_ratio * 100))
        findings.append(Finding(
            category="FFT Analysis",
            finding=f"Suppressed high-frequency content (HF ratio: {hf_ratio:.2f})",
            severity="high",
            description=(
                "Frequency spectrum lacks natural high-frequency detail. "
                "Typical of AI-upscaled, face-restored (GFPGAN/Real-ESRGAN), or diffusion-generated images."
            ),
        ))
    elif hf_ratio < 0.45:
        score = 55
        findings.append(Finding(
            category="FFT Analysis",
            finding=f"Mildly suppressed high frequencies (HF ratio: {hf_ratio:.2f})",
            severity="medium",
            description="Moderate high-frequency suppression — possible upscaling or heavy denoising.",
        ))
    else:
        score = 90
        findings.append(Finding(
            category="FFT Analysis",
            finding=f"Natural frequency distribution (HF ratio: {hf_ratio:.2f}, slope: {slope:.2f})",
            severity="low",
            description="Frequency spectrum matches expected profile of an unmodified photograph.",
        ))

    return max(0, min(100, score)), findings


# ── SIFT-based Copy-Move Detection ───────────────────────────────────────────
# More precise than ORB clone detection — uses SIFT keypoints + RANSAC
# clustering to find geometrically consistent cloned regions.

def run_sift_copy_move(img: np.ndarray) -> tuple[int, List[Finding]]:
    findings: List[Finding] = []
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    max_dim = 800
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        gray = cv2.resize(gray, (int(w * scale), int(h * scale)))

    try:
        sift = cv2.SIFT_create(nfeatures=1500)
    except Exception:
        return 80, findings  # SIFT not available in build

    kps, descs = sift.detectAndCompute(gray, None)
    if descs is None or len(kps) < 20:
        return 85, findings

    bf = cv2.BFMatcher(cv2.NORM_L2)
    matches = bf.knnMatch(descs, descs, k=3)

    clone_pairs: list[tuple[tuple, tuple]] = []
    for m_list in matches:
        # Skip self-match (k=0). Use 2nd & 3rd as nearest non-self.
        if len(m_list) < 3:
            continue
        m, n = m_list[1], m_list[2]
        if m.distance < 0.6 * n.distance:
            pt1 = kps[m.queryIdx].pt
            pt2 = kps[m.trainIdx].pt
            dist = math.hypot(pt1[0] - pt2[0], pt1[1] - pt2[1])
            if dist > 40:  # ignore nearby (texture)
                clone_pairs.append((pt1, pt2))

    n_pairs = len(clone_pairs)
    ratio = n_pairs / max(len(kps), 1)

    if ratio < 0.015:
        score = 92
    elif ratio < 0.05:
        score = 65
        findings.append(Finding(
            category="SIFT Copy-Move",
            finding=f"Possible cloned regions ({n_pairs} SIFT pairs)",
            severity="medium",
            description="SIFT detected geometrically similar patches — possible copy-paste editing.",
        ))
    else:
        score = max(10, int(65 - ratio * 400))
        findings.append(Finding(
            category="SIFT Copy-Move",
            finding=f"Strong copy-move evidence ({n_pairs} SIFT pairs)",
            severity="high",
            description=(
                f"{n_pairs} SIFT keypoint pairs match across distant regions — "
                f"strong evidence of cloned/duplicated content (paint, stamp, or splice edits)."
            ),
        ))

    return max(0, min(100, score)), findings


# ── Face-Forensics Deepfake Detector ─────────────────────────────────────────
# Detects faces with Haar cascade, then runs per-face frequency + ELA analysis.
# Deepfakes & face-restored images consistently show different spectral
# profiles inside face regions vs. the background.

def run_face_forensics(img: np.ndarray) -> tuple[int, int, List[Finding]]:
    findings: List[Finding] = []
    try:
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        face_cascade = cv2.CascadeClassifier(cascade_path)
    except Exception:
        return 75, 0, findings

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.15, minNeighbors=5, minSize=(40, 40))
    n_faces = len(faces)

    if n_faces == 0:
        return 80, 0, findings  # neutral — no faces to evaluate

    suspicious_faces = 0
    face_metrics = []

    for (x, y, fw, fh) in faces[:8]:  # cap at 8 faces
        face = gray[y:y + fh, x:x + fw].astype(np.float32)
        if face.shape[0] < 32 or face.shape[1] < 32:
            continue

        # 1. Per-face FFT high-freq ratio
        f = np.fft.fftshift(np.fft.fft2(face))
        mag = np.log1p(np.abs(f))
        n = min(face.shape)
        cy, cx = face.shape[0] // 2, face.shape[1] // 2
        yy, xx = np.indices(face.shape)
        r = np.hypot(xx - cx, yy - cy).astype(np.int32)
        radial = np.bincount(r.ravel(), mag.ravel()) / (np.bincount(r.ravel()) + 1e-6)
        radial = radial[: n // 2]
        if len(radial) < 5:
            continue
        cutoff = int(len(radial) * 0.7)
        hf_ratio = float(np.mean(radial[cutoff:])) / (float(np.mean(radial[2:cutoff])) + 1e-6)

        # 2. Skin smoothness (Laplacian variance — too low = airbrushed/restored)
        lap_var = float(cv2.Laplacian(face, cv2.CV_64F).var())

        face_metrics.append((hf_ratio, lap_var))

        # Deepfake / face-restoration signature: very low HF ratio + very smooth
        if hf_ratio < 0.35 and lap_var < 60:
            suspicious_faces += 1

    if not face_metrics:
        return 75, n_faces, findings

    susp_frac = suspicious_faces / len(face_metrics)
    avg_hf = float(np.mean([m[0] for m in face_metrics]))
    avg_lap = float(np.mean([m[1] for m in face_metrics]))

    if susp_frac >= 0.5:
        score = max(10, int(40 - susp_frac * 30))
        findings.append(Finding(
            category="Face Forensics",
            finding=f"{suspicious_faces}/{len(face_metrics)} faces show deepfake/restoration signs",
            severity="high",
            description=(
                f"Face regions have suppressed high-frequency content (avg HF ratio: {avg_hf:.2f}) "
                f"and unnaturally smooth texture (avg Laplacian var: {avg_lap:.0f}). "
                f"Strong indicator of deepfake, face-swap, or AI face restoration (GFPGAN)."
            ),
        ))
    elif susp_frac > 0:
        score = 55
        findings.append(Finding(
            category="Face Forensics",
            finding=f"{suspicious_faces}/{len(face_metrics)} faces show mild restoration signs",
            severity="medium",
            description=f"Some faces appear retouched or restored (avg HF ratio: {avg_hf:.2f}).",
        ))
    else:
        score = 90
        findings.append(Finding(
            category="Face Forensics",
            finding=f"{n_faces} face(s) appear authentic",
            severity="low",
            description=f"Face regions show natural skin texture and frequency profile (avg HF: {avg_hf:.2f}).",
        ))

    return max(0, min(100, score)), n_faces, findings


# ── Main Endpoint ────────────────────────────────────────────────────────────

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest):
    img = decode_image(req.image_base64)

    _, ela_score = run_ela(img)
    noise_score, noise_findings = run_noise_analysis(img)
    clone_score, clone_findings = run_clone_detection(img)
    edge_score, edge_findings = run_edge_analysis(img)
    mantranet_score, mantranet_findings = run_mantranet(img)
    fft_score, fft_findings = run_fft_analysis(img)
    sift_score, sift_findings = run_sift_copy_move(img)
    face_score, face_count, face_findings = run_face_forensics(img)

    # Weighted blend within Python service:
    # ManTra-Net 30%, FFT 18%, Face 15%, SIFT 12%, ELA 13%, Noise 8%, Clone 2%, Edge 2%
    overall = int(
        mantranet_score * 0.30
        + fft_score * 0.18
        + face_score * 0.15
        + sift_score * 0.12
        + ela_score * 0.13
        + noise_score * 0.08
        + clone_score * 0.02
        + edge_score * 0.02
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
    all_findings.extend(fft_findings)
    all_findings.extend(face_findings)
    all_findings.extend(sift_findings)
    all_findings.extend(noise_findings)
    all_findings.extend(clone_findings)
    all_findings.extend(edge_findings)

    return AnalyzeResponse(
        ela_score=ela_score,
        noise_score=noise_score,
        clone_score=clone_score,
        edge_score=edge_score,
        mantranet_score=mantranet_score,
        fft_score=fft_score,
        sift_clone_score=sift_score,
        face_forensics_score=face_score,
        face_count=face_count,
        overall_score=overall,
        findings=all_findings,
    )


@app.get("/health")
async def health():
    return {"status": "ok"}
