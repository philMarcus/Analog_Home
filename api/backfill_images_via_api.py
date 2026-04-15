"""Backfill legacy data-URI images by re-publishing them through /publish.

No DB access required — uses the public API. The /publish endpoint's
ON CONFLICT (id) DO UPDATE branch overwrites the row in place when we
send the same id.

Usage:
    API_URL=https://api.analog-i.ai python backfill_images_via_api.py
"""
import base64
import os
import sys

import requests


def parse_data_uri(uri: str) -> tuple[bytes, str]:
    if not uri.startswith("data:"):
        raise ValueError("not a data URI")
    header, b64 = uri.split(",", 1)
    mime = header[5:].split(";", 1)[0] or "image/jpeg"
    return base64.b64decode(b64), mime


def main() -> int:
    api = os.environ.get("API_URL", "https://api.marcusrecursives.com").rstrip("/")
    print(f"API: {api}")

    # Fetch image artifacts with image data inlined.
    r = requests.get(
        f"{api}/artifacts",
        params={"artifact_type": "image", "limit": 50, "sort": "desc", "include_images": "true"},
        timeout=30,
    )
    r.raise_for_status()
    arts = r.json()
    print(f"Fetched {len(arts)} image artifacts.")

    legacy = [a for a in arts if (a.get("image_url") or "").startswith("data:")]
    print(f"Legacy data-URI artifacts: {len(legacy)}")
    if not legacy:
        return 0

    converted = 0
    failed = 0
    total_bytes = 0
    for art in legacy:
        artifact_id = art["id"]
        try:
            data, mime = parse_data_uri(art["image_url"])
        except Exception as e:
            print(f"  [SKIP] id={artifact_id}: parse failed ({e})")
            failed += 1
            continue

        b64 = base64.b64encode(data).decode("ascii")

        # Re-publish with the same id. /publish ON CONFLICT (id) DO UPDATE
        # will overwrite the row in place: image_data populated, image_url
        # cleared, all other metadata preserved verbatim.
        payload = {
            "id": artifact_id,
            "brain": art.get("brain", ""),
            "cycle": art.get("cycle"),
            "artifact_type": art.get("artifact_type", "image"),
            "title": art.get("title", ""),
            "body_markdown": art.get("body_markdown", ""),
            "monologue_public": art.get("monologue_public", ""),
            "channel": art.get("channel", ""),
            "source_platform": art.get("source_platform", ""),
            "source_id": art.get("source_id", ""),
            "source_parent_id": art.get("source_parent_id", ""),
            "source_url": art.get("source_url", ""),
            "search_queries": art.get("search_queries", ""),
            "temperature": art.get("temperature"),
            "run_id": art.get("run_id", ""),
            "image_url": "",  # clear the legacy data URI
            "image_data_b64": b64,
            "image_mime": mime,
        }

        try:
            resp = requests.post(f"{api}/publish", json=payload, timeout=60)
            if resp.status_code >= 400:
                print(f"  [FAIL] id={artifact_id}: HTTP {resp.status_code} {resp.text[:200]}")
                failed += 1
                continue
        except Exception as e:
            print(f"  [FAIL] id={artifact_id}: {e}")
            failed += 1
            continue

        converted += 1
        total_bytes += len(data)
        print(f"  [OK]   id={artifact_id}: {len(data):,} bytes ({mime})")

    print()
    print(f"Done. Converted: {converted}  Failed: {failed}")
    print(f"Total binary uploaded: {total_bytes:,} bytes")

    # Verify: re-fetch and count remaining legacy URIs.
    r = requests.get(
        f"{api}/artifacts",
        params={"artifact_type": "image", "limit": 50, "include_images": "true"},
        timeout=30,
    )
    if r.ok:
        remaining = sum(1 for a in r.json() if (a.get("image_url") or "").startswith("data:"))
        print(f"Legacy data URIs remaining: {remaining}")

    return 0 if failed == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
