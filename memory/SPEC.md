# PANDI AI — Living Spec

## What it is
A personal AI assistant with two selectable interface skins (AGNI Portal / VAJRA Core), onboarding by name only (no email/password — local device storage + Mongo profile), ChatGPT-style chat with streaming markdown, voice (Jarvis-style browser TTS or ElevenLabs if configured), live web search, file analysis, and a procedural 3D "Hologram Lab" explainer engine. Creator-identity guard: any "who made you" question always answers "I was created by VIGNEASHWAR."

## Onboarding flow (Phase 1)
Name (2–20 chars) → Intro video (muted autoplay, Skip, sound toggle, URL from `GET /api/pandi/settings/intro-video`, default = user-provided WhatsApp video) → Voice or Text choice (requests mic if Voice) → Choose your interface (AGNI Portal fire theme / VAJRA Core blue-cyan theme, live preview cards) → Chat. Returning users (profile + onboarding flags in localStorage) skip straight to Chat.

## Theme system
AGNI Portal is the base CSS (fire colors). VAJRA Core is produced by applying `hue-rotate(158deg) saturate(1.5) brightness(1.08)` (see `frontend/src/lib/theme.ts`) to the whole app root — every existing glow/hud component works unchanged in both skins. Theme + voice_mode are stored per-profile (`Profile.theme`, `Profile.voice_mode`) and in localStorage; changeable in Settings (reloads the app to apply).

## AI core
- Primary model: GPT-5.1 (openai). Fallback: Gemini 3 Flash. Live web-search questions force Gemini 3.1 Pro (Google Search grounding is Gemini-only).
- If the primary model throws before any text is streamed, the backend automatically retries once with the fallback model (`backend/routers/pandi.py::_stream_chat`).
- System prompt instructs: say "I'm not sure" instead of guessing; for decision questions, list 2–4 options scored on Cost/Risk/Benefit, then pick one in bold.
- All models route through `EMERGENT_LLM_KEY` (Emergent universal key).

## Reliability
- Per-profile rate limit: 20 chat requests / 60s → 429.
- Global FastAPI exception handler → clean 500 JSON instead of a raw traceback.
- `GET /api/pandi/health` health check.
- Frontend `ErrorBoundary` (App.tsx) shows a Retry button instead of a blank screen on a render crash.
- Voice input: native browser SpeechRecognition where available; MediaRecorder + `POST /api/voice/transcribe` (Whisper via the Emergent key) fallback otherwise. Transcript always lands in the text box for review before sending.

## Data model additions (Phase 1)
- `Profile`: added `voice_mode: "voice"|"text"`, `theme: "agni"|"vajra"`.
- New `IntroVideoResponse { video_url }`, `TranscribeResponse { text }`.
- `pandi_settings` collection, doc `{key: "app", intro_video_url}` — will be written by the Phase 3 Owner Console.

## 3D Creation Engine (Phase 2, partial — "CREATE 3D" tab)
- `POST /api/creation/generate {profile_id, prompt}` → one GPT-5.1 call produces a structured design brief (category, proportions, parts, materials, honest limitations) as 8-20 labelled primitive shapes, reusing the existing `SceneSpec(scene="custom")` renderer (same `VirtualLab` viewer as the Hologram Lab — rotate/zoom/wireframe/exploded view all work unchanged). Falls back to Gemini 3 Flash if GPT-5.1 fails, then to a single labelled placeholder box if both fail — never crashes.
- One `gpt-image-1` call (via `OpenAIImageGeneration`) produces a concept reference image (base64 data URL, stored inline) alongside the 3D model.
- No Tripo/paid 3D-generation key is configured: every result carries an explicit on-screen limitation note that this is a procedural primitive-shape model, not a photorealistic scan, and that true photorealism needs an external paid service.
- `GET /api/creation/gallery/{profile_id}` + `GET /api/creation/{id}` persist/reopen past creations (`pandi_creations` collection) — shown as a thumbnail gallery under the viewer.
- GLB export and Tripo-based photoreal generation are NOT implemented (would need a Tripo API key) — deferred, consistent with the user's "no external keys/charges" instruction.

- Phase 2 (3D creation via Tripo/parametric fallback) and Phase 3 (Owner Console, admin code `123P456P`) are NOT started — waiting for user's "continue".
- ElevenLabs voice cloning stays on browser-TTS fallback until `ELEVENLABS_API_KEY` is provided.
- Tripo API key not yet provided — Phase 2 will use the parametric Three.js fallback first per user's explicit instruction.
