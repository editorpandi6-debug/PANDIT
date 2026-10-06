# PANDI AI MARK II — Living Spec

## Product
Red holographic ("hologram lab") personal AI assistant created by VIGNASHWAR S. Motto: "Don't just tell the user — show them." Every science/maths answer carries a structured 3D scene rendered live in the Hologram Lab (Three.js via @react-three/fiber), spoken aloud in the official voice.

## Flow (first run)
1. **Splash / name** (`name-screen`): code-drawn red holographic arc reactor (SVG/CSS, `ArcReactor.tsx`), title, "May I know your name?" → CONTINUE is instant (local save + background `PUT /api/pandi/profile/{id}`).
2. **Intro** (`intro-screen`): `/assets/intro.mp4` full screen with SKIP (also Esc/Space). If the video can't play → generated animated boot-up intro (`intro-animated`). Once per browser session; Settings → "Replay intro".
3. **Audio permission** (`permission-screen`): ALLOW MICROPHONE (getUserMedia) → voice sync on; TEXT ONLY → spoken replies off. Stored in `pandi-permission-done`.
4. **Main** (`chat-screen`): header tabs CHAT / HOLOGRAM LAB, sidebar (new chat, searchable/renamable/deletable history per profile, Voice ON/OFF, Memory, Settings, Operator), chat with streaming markdown (GFM + KaTeX), input bar (attach, mic speech-to-text, send), TALK button = hands-free voice mode overlay (listen → send → speak → listen).
Returning users (profile in localStorage) go straight to chat.

## Hologram Lab
- Backend streams SSE: `meta` → optional `scene` (early) → `delta`* → `done` | `error`. The LLM opens visual answers with `<<<PANDI_SCENE>>>{json}<<<END_SCENE>>>` (scene, params, title, steps, stats); backend strips it from the text, falls back to keyword heuristics, persists `scene` on the assistant message.
- Scene types: solar-system (8 planets, Moon, Saturn rings, educational scale note), atom, molecule, states-of-matter, geometry (cube/cuboid/sphere/cylinder/cone/pyramid/prism, dims, V/A formulas, unfold-net), graph (2D/3D), equation (roots + steps), projectile, pendulum, wave, circuit, optics, cell, dna, heart, earth-seasons, moon-phases, eclipse, **custom** (procedural labelled shapes from JSON), generic; frontend-only `core` = idle red reactor hologram.
- Viewer (`virtual-lab`): header "VIRTUAL LAB – <TOPIC> 3D PROJECTION", play/pause, speed, auto-rotate, unfold (boxes), reset, fullscreen, stat chips, steps highlighted in sync with voice progress, click-to-inspect info panel, WebGL/error fallback, off-screen unmount. Labels are WebGL sprites (no DOM portals).
- Lab tab shows the latest scene (or idle core) full size with floating HUD panels and preset prompts.

## Voice
- `POST /api/voice/tts` → ElevenLabs (instant-clone of `/assets/my-voice.mp3`, voice id persisted to `.env` + `pandi_settings`; stock-voice fallback with warning). 503 when `ELEVENLABS_API_KEY` is empty → frontend falls back to browser speechSynthesis. Settings: voice on/off, voice selection (official / browser voices), theme intensity (`--glow`), live search toggle, replay intro, reset profile, About (Created by VIGNASHWAR S.).
- Markdown is stripped before speech; reactor core pulses with live audio level (AnalyserNode) or synthetic pulse.

## API (all under /api)
`GET pandi/health`, `GET pandi/today`, `GET/PUT pandi/profile/{id}`, `PUT pandi/profile/{id}/memory`, `GET pandi/sessions/{profile_id}`, `PATCH/DELETE pandi/sessions/{session_id}`, `GET pandi/history/{session_id}`, `POST pandi/files`, `POST pandi/chat/stream`, `GET voice/status`, `POST voice/tts`, `POST voice/reset`.

## Data (Mongo)
`pandi_profiles` {profile_id, name, avatar_data_url, memory[], created_at, updated_at}; `pandi_sessions` {session_id, profile_id, title, created_at, updated_at}; `pandi_messages` {id, session_id, role, content, created_at, live_search, sources[], scene, attachments[]}; `pandi_files`; `pandi_settings` {key:"voice", voice_id, cloned, detail}.

## Auth
None. Identity = profile id in localStorage (`pandi-profile-id`, `pandi-name`). Seed profile for tests: `tester-profile-1` / "Tester".
