"""Dedicated live web search (Tavily). Active only when TAVILY_API_KEY is set; otherwise the chat
router uses the built-in Google-grounded search instead."""

import logging
import os
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)


@dataclass
class SearchItem:
    title: str
    url: str
    snippet: str
    published_date: str | None


def dedicated_search_enabled() -> bool:
    return bool(os.environ.get("TAVILY_API_KEY", "").strip())


async def web_search(query: str, safe: bool) -> list[SearchItem] | None:
    """Returns results, or None when the dedicated search is not configured or failed."""
    key = os.environ.get("TAVILY_API_KEY", "").strip()
    if not key:
        return None
    payload = {
        "query": query[:400],
        "search_depth": "basic",
        "topic": "general",
        "max_results": 6,
        "safe_search": safe,
        "include_published_date": True,
        "include_answer": False,
        "include_raw_content": False,
    }
    try:
        async with httpx.AsyncClient(base_url="https://api.tavily.com", timeout=httpx.Timeout(15.0)) as client:
            res = await client.post("/search", json=payload, headers={"Authorization": f"Bearer {key}"})
            res.raise_for_status()
            data = res.json()
    except httpx.HTTPError as exc:
        logger.warning("Dedicated web search failed: %s", type(exc).__name__)
        return None
    return [
        SearchItem(title=str(x.get("title") or ""), url=str(x.get("url") or ""), snippet=str(x.get("content") or "")[:700], published_date=x.get("published_date"))
        for x in data.get("results", [])
        if x.get("url")
    ]


def search_context(items: list[SearchItem]) -> str:
    """Results as clearly delimited, untrusted source data for the model."""
    return "\n".join(
        f"SOURCE {i}:\nTITLE: {x.title}\nURL: {x.url}\nPUBLISHED: {x.published_date or 'unknown'}\nSNIPPET: {x.snippet}" for i, x in enumerate(items, 1)
    )
