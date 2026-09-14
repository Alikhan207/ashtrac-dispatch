"""
Structured result schemas passed to CALL-E's Calls API.

These are JSON Schema objects sent as `result_schema` on each call task.
CALL-E extracts a result matching this schema from the completed call's
transcript/evidence. If it can't produce a schema-valid result, the API
returns `structured_result: null` -- our orchestration logic in dispatch.py
treats that the same as "unknown", never as a silent failure to ignore.

See: docs "Calls" guide, section "Structured results".
"""

PROVIDER_CALL_RESULT_SCHEMA = {
    "type": "object",
    "required": ["availability", "eta", "price", "evidence"],
    "properties": {
        "availability": {
            "type": "string",
            "enum": ["yes", "no", "unknown"],
            "description": (
                "Whether the provider can take on the job described in the "
                "task. Use 'yes' only when the provider clearly confirms "
                "they can help. Use 'no' when they clearly decline or say "
                "they are unavailable/fully booked. Use 'unknown' if the "
                "call did not reach a person, the recipient did not answer "
                "the question, or the evidence is ambiguous."
            ),
        },
        "eta": {
            "type": "string",
            "description": (
                "The estimated arrival time or availability window stated "
                "by the provider (e.g. '4-6 PM today', 'tomorrow morning'), "
                "or an empty string if no time was given."
            ),
        },
        "price": {
            "type": "string",
            "description": (
                "The price or price range quoted by the provider, in "
                "whatever currency/unit they stated, or an empty string if "
                "no price was given."
            ),
        },
        "evidence": {
            "type": "string",
            "description": (
                "A short paraphrase from the call that supports the "
                "availability answer, so the decision can be audited."
            ),
        },
    },
    "additionalProperties": False,
}
