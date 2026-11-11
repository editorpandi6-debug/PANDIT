"""Age-based behaviour shared by chat, live web search and image prompts."""

import re

_ADULT_RE = re.compile(r"\b(nude|naked|nsfw|porn\w*|sex\w*|erotic\w*|lingerie|topless|fetish)\b", re.I)
_MINOR_RE = re.compile(
    r"\b(gore|gory|blood\w*|kill\w*|murder\w*|corpse|dead body|weapon\w*|gun\w*|rifle|knife|stab\w*|drug\w*|cocaine|weed|"
    r"alcohol\w*|beer|vodka|whisky|cigarette\w*|smok\w*|vape\w*|horror|terrif\w*|suicid\w*|self[- ]harm|gambl\w*|bikini|kiss\w*)\b",
    re.I,
)


def age_band(age: int | None) -> str:
    """child (5-12) | teen (13-17, also used for guests whose age is unknown) | adult (18-59) | senior (60+)."""
    if age is None:
        return "teen"
    if age <= 12:
        return "child"
    if age <= 17:
        return "teen"
    if age <= 59:
        return "adult"
    return "senior"


def age_rules(age: int | None) -> str:
    band = age_band(age)
    if band == "child":
        return (
            "AUDIENCE: a child aged 5-12. Use very simple words and short, friendly answers (2-5 short sentences). "
            "Never discuss mature topics (violence, romance, drugs, alcohol, gambling, scary content); gently say it is a topic for a trusted grown-up. "
            "Only use and cite child-safe web results."
        )
    if band == "teen":
        note = "The user's age is unknown (guest), so treat them as a teenager. " if age is None else ""
        return (
            f"AUDIENCE: {note}a student aged 13-17. Give clear, age-appropriate answers with a study-help focus. "
            "Apply strict safety filters: no adult, sexual, graphic or dangerous content; decline politely and suggest a safe alternative."
        )
    if band == "senior":
        return (
            "AUDIENCE: an adult aged 60 or older. Be clear and patient, give step-by-step help, avoid jargon. "
            "Take extra care with health and money questions: give general information, point out risks and scams, and recommend confirming with a doctor or a trusted financial adviser."
        )
    return "AUDIENCE: an adult aged 18-59. Give full answers in a normal tone."


def safe_search_required(age: int | None) -> bool:
    return age_band(age) in ("child", "teen")


def image_prompt_block_reason(prompt: str, age: int | None) -> str | None:
    if _ADULT_RE.search(prompt):
        return "I can't create that picture because it asks for adult content. Try describing something else."
    if age_band(age) in ("child", "teen") and _MINOR_RE.search(prompt):
        return "I can't create that picture because it isn't suitable for this account's age setting. Try a friendlier idea, like animals, space or nature."
    return None


def image_prompt_for_age(prompt: str, age: int | None) -> str:
    if age_band(age) in ("child", "teen"):
        return f"{prompt}\n\nStyle rules: family-friendly, child-safe, bright and positive. No violence, weapons, scary or mature content."
    return prompt
