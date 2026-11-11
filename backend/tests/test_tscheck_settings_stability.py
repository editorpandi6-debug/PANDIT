"""Settings stability regression: voice/status with fish_audio provider, and intro-video setting.

Criterion: GET /api/voice/status returns 200 with provider fish_audio and configured true using
the already-existing saved key (no real TTS call made). API intro setting continues to return the
new MP4 URL.
"""


def test_voice_status_fish_audio_configured(client):
    resp = client.get("/voice/status")
    assert resp.status_code == 200, f"expected 200, got {resp.status_code}: {resp.text[:300]}"
    body = resp.json()
    assert body.get("provider") == "fish_audio", f"unexpected provider: {body}"
    assert body.get("configured") is True, f"expected configured=true: {body}"


def test_intro_video_setting_returns_new_mp4(client):
    resp = client.get("/pandi/settings/intro-video")
    assert resp.status_code == 200, f"expected 200, got {resp.status_code}: {resp.text[:300]}"
    body = resp.json()
    url = body.get("video_url", "")
    assert "235864699c4b259d_WhatsApp" in url, f"unexpected intro video url: {url}"
    assert url.lower().endswith(".mp4") or ".mp4" in url.lower(), f"expected mp4 asset: {url}"
