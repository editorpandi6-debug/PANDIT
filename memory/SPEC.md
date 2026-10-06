# PANDI AI MARK II Living Spec

## Product
PANDI AI MARK II is a red/black cinematic personal AI assistant created by VIGNASHWAR S. Its primary differentiator is a functional lightweight interactive 3D Explainer Engine that opens for guided science and math scenes instead of decorative animation.

## Current MVP flows
- First visit: title-card MP4 intro with skip/failure recovery -> name and optional avatar -> optional microphone permission -> command deck.
- Returning visit: profile id in localStorage restores the profile from Mongo and opens the command deck.
- Command deck: streamed text chat, live-search toggle, language selector, file upload, persisted session history, profile reset, creator About panel, supplied official voice intro/replay asset.
- Showcase: exactly four cards open Atom, Solar System, Geometry, and Parametric Surface scenes. The Solar System contains Sun plus Mercury through Neptune in correct order, orbital paths, Saturn rings, Earth's Moon, labels, select-able planet facts, animation, speed, rotate/pan/zoom/reset/fullscreen controls, and an educational-scale note.
- Chat heuristic: science/math prompts can open a matching scene; simple arithmetic does not open a scene. Backend Gemini may answer naturally and streams SSE deltas.

## Data model
- `pandi_profiles`: profile_id, name, optional avatar data URL, created_at, updated_at.
- `pandi_messages`: session_id, role, content, created_at, live_search, sources, visual_scene.
- `pandi_files`: file_id, filename, mime_type, size, temporary storage path, created_at.

## Integrations and boundaries
- Gemini 3.1 Pro Preview through the managed EMERGENT_LLM_KEY is configured server-side for streamed chat, Google Search grounding when enabled, and file attachments.
- The supplied MP3 is used as the official intro/replay voice asset. Dynamic voice cloning/TTS is **NOT CONNECTED** because no voice-provider credential or voice ID was supplied; the UI never substitutes browser/system TTS.
- WebXR is capability-detected and safely falls back to interactive desktop/mobile canvas 3D.
- No auth roles exist in this demo MVP; profile identity is local browser storage plus Mongo persistence.