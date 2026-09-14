"""
Provider shortlist logic.

For the hackathon demo, the shortlist is seeded from a local JSON file
(providers.json) rather than a live business directory -- see the README
for why, and for how to replace this with a real directory integration
after the hackathon.

Each provider entry:
{
    "id": "provider_plaster_1",
    "name": "Ravi Plastering & Repairs",
    "category": "home_repair",
    "phone": "+91XXXXXXXXXX"   # must be E.164, and a number you own or
                                # are authorized to call -- see CALL-E docs
}
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Provider:
    id: str
    name: str
    category: str
    phone: str


class ProviderDirectoryError(Exception):
    pass


def load_providers(path: str | Path) -> list[Provider]:
    path = Path(path)
    if not path.exists():
        raise ProviderDirectoryError(
            f"Provider file not found: {path}. Copy providers.example.json "
            "to providers.json and fill in real, authorized phone numbers."
        )
    with path.open("r", encoding="utf-8") as f:
        raw = json.load(f)

    providers = []
    for entry in raw:
        try:
            providers.append(
                Provider(
                    id=entry["id"],
                    name=entry["name"],
                    category=entry["category"],
                    phone=entry["phone"],
                )
            )
        except KeyError as e:
            raise ProviderDirectoryError(
                f"Provider entry missing required field {e}: {entry}"
            ) from e
    return providers


def shortlist_for_category(
    providers: list[Provider], category: str, limit: int = 3
) -> list[Provider]:
    matches = [p for p in providers if p.category == category]
    if not matches:
        # Fall back to any provider tagged "general" rather than failing
        # outright -- keeps the demo resilient to an unseen category.
        matches = [p for p in providers if p.category == "general"]
    return matches[:limit]


# Very small keyword classifier. This is intentionally simple: CALL-E is
# the part of this system that needs to be "genuinely used and called at
# runtime" per the hackathon's judging criteria -- the category classifier
# is ordinary application logic, not something to over-engineer for a demo.
CATEGORY_KEYWORDS = {
    "home_repair": [
        "plaster", "wall", "leak", "pipe", "plumb", "electric", "wiring",
        "ac", "air condition", "repair", "fix", "broken",
    ],
}


def classify_need(need_text: str) -> str:
    text = need_text.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            return category
    return "general"
