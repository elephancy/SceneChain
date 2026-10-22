#!/usr/bin/env python3
"""Download, normalize, hash, and document the reviewed SceneChain shortlist."""

from __future__ import annotations

import hashlib
import json
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SELECTION = ROOT / "protocol/manifests/selected-sources.json"
PACK = ROOT / "scene-pack/v1"
POLICY_URL = "https://www.metmuseum.org/policies/image-resources"


def run(arguments: list[str]) -> None:
    subprocess.run(arguments, check=True)


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def sha1(path: Path) -> str:
    # Commons publishes SHA-1 source-record checksums; this preserves that format.
    # Artifact and manifest integrity use the separate SHA-256 digest() function.
    # nosemgrep: python.lang.security.insecure-hash-algorithm-sha1
    value = hashlib.sha1(usedforsecurity=False)
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def dimensions(path: Path) -> tuple[int, int]:
    result = subprocess.run([
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height", "-of", "json", str(path),
    ], check=True, capture_output=True, text=True)
    stream = json.loads(result.stdout)["streams"][0]
    return int(stream["width"]), int(stream["height"])


def extension(url: str) -> str:
    suffix = Path(urlparse(url).path).suffix.lower()
    return suffix if suffix in {".jpg", ".jpeg", ".png", ".tif", ".tiff"} else ".img"


def eligible_cells() -> list[int]:
    # Conservative draft: 12 evenly distributed cells in every 6x4 window.
    return [cell for cell in range(384) if ((cell // 24) % 4 * 6 + cell % 6) % 2 == 0]


def windows() -> list[dict[str, int]]:
    return [{"column": column, "row": row} for row in (0, 4, 8, 12) for column in (0, 6, 12, 18)]


def main() -> None:
    document = json.loads(SELECTION.read_text(encoding="utf-8"))
    existing_manifest_path = PACK / "manifest-draft.json"
    existing_manifest = json.loads(existing_manifest_path.read_text(encoding="utf-8")) if existing_manifest_path.exists() else {"scenes": []}
    existing_scenes = {scene["sceneId"]: scene for scene in existing_manifest.get("scenes", [])}
    review_path = PACK / "review-state.json"
    review_state = json.loads(review_path.read_text(encoding="utf-8")) if review_path.exists() else {}
    originals = PACK / "originals"
    canonicals = PACK / "canonical"
    delivery = PACK / "delivery"
    evidence = PACK / "provenance"
    rejected = PACK / "rejected"
    for directory in (originals, canonicals, delivery, evidence, rejected):
        directory.mkdir(parents=True, exist_ok=True)

    policy = evidence / "met-open-access-policy.html"
    policy_pointer = evidence / "met-open-access-policy.url.txt"
    if not policy.exists() and not policy_pointer.exists():
        try:
            run(["curl", "-fsSL", "-A", "Mozilla/5.0 SceneChain-Curation", "--retry", "2", "--max-time", "90", "-o", str(policy), POLICY_URL])
        except subprocess.CalledProcessError:
            policy_pointer.write_text(
                POLICY_URL + "\nCapture deferred after institutional HTTP rate limit.\n",
                encoding="utf-8",
            )

    manifest_scenes: list[dict] = []
    failures: list[str] = []
    for position, scene in enumerate(document["scenes"], 1):
        scene_id = scene["sceneId"]
        print(f"[{position:02d}/48] {scene_id} {scene['family']}: {scene['title']}", flush=True)
        original = originals / f"{scene_id}{extension(scene['primaryImage'])}"
        canonical = canonicals / f"{scene_id}.jpg"
        webp = delivery / f"{scene_id}.webp"
        previous_record = evidence / f"{scene_id}.json"
        if previous_record.exists():
            previous = json.loads(previous_record.read_text(encoding="utf-8"))
            if previous.get("primaryImage") != scene["primaryImage"]:
                review_state.pop(str(scene_id), None)
                for candidate in (Path(previous.get("originalPath", "")), canonical, webp, previous_record):
                    candidate = candidate if candidate.is_absolute() else ROOT / candidate
                    if candidate.is_file():
                        candidate.replace(rejected / f"{scene_id}-{candidate.name}")
        if not original.exists():
            try:
                run(["curl", "-fsSL", "--remove-on-error", "-A", "SceneChain-Curation/0.1",
                     "--retry", "20", "--retry-all-errors", "--retry-delay", "60", "--retry-max-time", "1800",
                     "--max-time", "120", "-o", str(original), scene["primaryImage"]])
            except subprocess.CalledProcessError:
                failures.append(f"{scene_id}: source download deferred after HTTP failure")
                continue
        width, height = dimensions(original)
        if scene.get("originalSha1") and sha1(original) != scene["originalSha1"]:
            failures.append(f"{scene_id}: original SHA-1 does not match the Commons record")
            continue
        if width < 2400 or height < 1600:
            failures.append(f"{scene_id}: original is only {width}x{height}")
            continue
        if not canonical.exists():
            run([
                "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(original),
                "-vf", "scale='if(gt(a,3/2),-1,1920)':'if(gt(a,3/2),1280,-1)',crop=1920:1280",
                "-frames:v", "1", "-q:v", "2", str(canonical),
            ])
        if not webp.exists():
            run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(canonical), "-c:v", "libwebp", "-q:v", "82", str(webp)])
        source_record = dict(scene)
        source_record.update({
            "downloadedAt": datetime.now(UTC).isoformat(),
            "originalPath": str(original.relative_to(ROOT)),
            "originalWidth": width,
            "originalHeight": height,
            "originalSha256": digest(original),
            "canonicalSha256": digest(canonical),
            "deliveryWebpSha256": digest(webp),
            "cropMethod": "center-crop-to-3:2-draft-requires-human-approval",
        })
        (evidence / f"{scene_id}.json").write_text(json.dumps(source_record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        manifest_scenes.append({
            "sceneId": scene_id,
            "version": 1,
            "family": scene["family"],
            "title": scene["title"],
            "canonical": {
                "path": str(canonical.relative_to(PACK)), "width": 1920, "height": 1280,
                "sha256": digest(canonical),
            },
            "source": {
                "institution": "The Metropolitan Museum of Art" if "objectId" in scene else "Wikimedia Commons",
                "url": scene.get("objectUrl") or scene.get("sourcePage"),
                "license": "CC0-1.0",
                "licenseEvidence": scene["licenseEvidence"],
                "downloadedAt": source_record["downloadedAt"],
                "originalSha256": source_record["originalSha256"],
            },
            "eligibleCells": existing_scenes.get(scene_id, {}).get("eligibleCells", eligible_cells()),
            "enrollmentWindows": windows(),
        })

    draft = {
        "packVersion": 1,
        "status": "draft-crops-and-generated-masks-require-human-review",
        "generatedAt": datetime.now(UTC).isoformat(),
        "scenes": manifest_scenes,
    }
    (PACK / "manifest-draft.json").write_text(json.dumps(draft, indent=2) + "\n", encoding="utf-8")
    if review_path.exists() or review_state:
        review_path.write_text(json.dumps(review_state, indent=2) + "\n", encoding="utf-8")
    if failures:
        (PACK / "rejected-dimensions.txt").write_text("\n".join(failures) + "\n", encoding="utf-8")
        print("Deferred scenes:\n" + "\n".join(failures), flush=True)
    print(f"Finalized {len(manifest_scenes)} of 48 draft scenes", flush=True)


if __name__ == "__main__":
    main()
