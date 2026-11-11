"""Chat model catalogue. Add a model here and it appears in the chat dropdown — no other code changes needed.

provider must be one of: openai | anthropic | gemini (served through the shared LLM router in routers/pandi.py).
"""

CHAT_MODELS: list[dict[str, str]] = [
    {"id": "gpt-5.1", "provider": "openai", "model": "gpt-5.1", "label": "OpenAI · GPT-5.1"},
    {"id": "claude-sonnet-5-5", "provider": "anthropic", "model": "claude-sonnet-5-5", "label": "Claude · Sonnet 5.5"},
    {"id": "claude-opus-5-5", "provider": "anthropic", "model": "claude-opus-5-5", "label": "Claude · Opus 5.5"},
    {"id": "claude-haiku-4-5-20251001", "provider": "anthropic", "model": "claude-haiku-4-5-20251001", "label": "Claude · Haiku 4.5 (fast)"},
    {"id": "gemini-3-flash-preview", "provider": "gemini", "model": "gemini-3-flash-preview", "label": "Gemini · 3 Flash"},
    {"id": "gemini-3.1-pro-preview", "provider": "gemini", "model": "gemini-3.1-pro-preview", "label": "Gemini · 3.1 Pro"},
]

DEFAULT_MODEL = "gpt-5.1"  # OpenAI is the main model
FALLBACK_MODEL = "gemini-3-flash-preview"  # used when the chosen model fails before streaming any text
SEARCH_MODELS = ["gemini-3-flash-preview", "gemini-3.1-pro-preview"]  # built-in live search (Google grounding)
DIRECT_OPENAI_MODEL = "gpt-4.1"  # model id used when calling OpenAI with the owner's own OPENAI_API_KEY

# Image models: tried in order. "own" = owner's OPENAI_API_KEY, "emergent" = Emergent universal key.
IMAGE_MODELS: list[tuple[str, str]] = [("own", "gpt-image-1"), ("emergent", "gpt-image-2")]
