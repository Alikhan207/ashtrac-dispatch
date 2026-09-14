"""
Command-line entry point.

Usage:
    export CALLE_API_KEY="iams_live_..."
    python -m ashtrac_dispatch.cli --need "The plaster on my wall is falling off and my usual contact isn't answering" --providers providers.json

This places REAL phone calls through CALL-E to the phone numbers listed in
your providers.json. Only use numbers you own or are authorized to call.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import uuid

from calle import CalleClient

from .dispatch import dispatch, summarize


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Ashtrac Dispatch: call providers, adapt on 'no', confirm the best option."
    )
    parser.add_argument("--need", required=True, help="The user's stated need, in plain language.")
    parser.add_argument(
        "--providers", default="providers.json",
        help="Path to your provider shortlist JSON file. Default: providers.json",
    )
    parser.add_argument(
        "--category", default=None,
        help="Override automatic category classification (e.g. 'home_repair').",
    )
    parser.add_argument(
        "--max-providers", type=int, default=3,
        help="Maximum number of providers to try before giving up. Default: 3.",
    )
    parser.add_argument(
        "--request-id", default=None,
        help="Stable ID for this dispatch request, used to build idempotency "
             "keys. Default: a random UUID (fine for demo runs; use a real "
             "durable ID -- e.g. an order/ticket ID -- in production).",
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable debug logging.")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    api_key = os.environ.get("CALLE_API_KEY")
    if not api_key:
        print(
            "Error: CALLE_API_KEY is not set. Export it before running:\n"
            "  export CALLE_API_KEY=\"iams_live_...\"\n"
            "Get your key from https://dashboard.heycall-e.com/account/api-keys",
            file=sys.stderr,
        )
        return 2

    client = CalleClient(api_key=api_key)
    request_id = args.request_id or f"demo-{uuid.uuid4().hex[:12]}"

    result = dispatch(
        client=client,
        need_text=args.need,
        providers_path=args.providers,
        request_id=request_id,
        max_providers=args.max_providers,
        category_override=args.category,
    )

    print()
    print(summarize(result))
    return 0 if result.confirmed else 1


if __name__ == "__main__":
    raise SystemExit(main())
