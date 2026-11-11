"""Make a browser-compatible copy of the user-supplied intro; keep the original intact.

Requires the ffmpeg executable (offline build tool, not a runtime dependency).
Run: python scripts/prepare_intro_video.py
"""
from pathlib import Path
from tempfile import TemporaryDirectory
import subprocess

import requests


SOURCE = "https://customer-assets-gfyr7b9c.emergentagent.net/job_pandi-ai-mark2/artifacts/235864699c4b259d_WhatsApp%20Video%202026-11-07%20at%2019.07.03.mp4"
OUTPUT = Path(__file__).resolve().parents[1] / "frontend/public/assets/pandi-intro-2026-11.webm"


def main() -> None:
    response = requests.get(SOURCE, timeout=60)
    response.raise_for_status()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory() as directory:
        source = Path(directory) / "intro.mp4"
        source.write_bytes(response.content)
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "warning", "-y", "-i", str(source),
            "-map", "0:v:0", "-map", "0:a?", "-vf", "scale='min(960,iw)':-2,fps=24",
            "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-deadline", "realtime",
            "-cpu-used", "6", "-row-mt", "1", "-threads", "2", "-pix_fmt", "yuv420p",
            "-c:a", "libopus", "-b:a", "96k", str(OUTPUT),
        ], check=True)
    print(f"Prepared {OUTPUT.name}: {OUTPUT.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()