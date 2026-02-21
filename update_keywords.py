#!/usr/bin/env python3
"""
Fetch top trending terms for Kenya and APPEND them to the meta keywords in index.html.
Never overwrites existing keywords — only adds new, unique terms.

Environment Variables:
    INDEX_PATH   - path to index.html (default: index.html)
    TOP_K        - number of trending terms to fetch (default: 20)
    TZ_MINUTES   - timezone offset in minutes for Kenya UTC+3 (default: 180)
    DRY_RUN      - set to "true" to preview changes without writing (default: false)
"""

import os
import sys
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Tuple

try:
    from pytrends.request import TrendReq
except ImportError:
    print("ERROR: pytrends not installed. Run: pip install pytrends")
    sys.exit(2)

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("ERROR: beautifulsoup4 not installed. Run: pip install beautifulsoup4")
    sys.exit(2)

try:
    from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
except ImportError:
    print("ERROR: tenacity not installed. Run: pip install tenacity")
    sys.exit(2)

# ── Configuration ──────────────────────────────────────────────────────────────
INDEX_PATH = os.getenv("INDEX_PATH", "index.html")
TOP_K = int(os.getenv("TOP_K", "20"))
TZ_MINUTES = int(os.getenv("TZ_MINUTES", "180"))
DRY_RUN = os.getenv("DRY_RUN", "false").lower() == "true"

FALLBACK_KEYWORDS = [
    "civic education Kenya", "democracy Kenya", "governance Kenya",
    "citizen rights", "public participation", "devolution", "IEBC",
    "voter registration", "constitution Kenya", "recall254",
    "NASAKA map", "finance bill", "controller of budget",
    "county government", "youth leadership", "social justice",
    "bill tracker", "parliament Kenya", "chapter 6 integrity",
    "human rights Kenya"
][:TOP_K]

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("trends_updater")

# ── Validation ─────────────────────────────────────────────────────────────────
def is_valid_keyword(term: str) -> bool:
    if not term or len(term) < 3 or len(term) > 100:
        return False
    if term.startswith(("http://", "https://", "www.")):
        return False
    if not any(c.isalpha() for c in term):
        return False
    return True

# ── Fetch Trends ───────────────────────────────────────────────────────────────
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=60),
    retry=retry_if_exception_type(Exception),
    before_sleep=lambda rs: logger.warning(
        f"Retry {rs.attempt_number}/3 after: {rs.outcome.exception()}"
    ),
)
def fetch_top_trends(top_k: int) -> List[str]:
    pytrends = TrendReq(hl="en-US", tz=TZ_MINUTES)
    trending_df = pytrends.trending_searches(pn="kenya")

    if trending_df is None or trending_df.empty:
        logger.warning("pytrends returned empty DataFrame")
        return []

    col0 = trending_df.columns[0]
    raw = trending_df[col0].head(top_k).astype(str).tolist()

    valid = [t.strip() for t in raw if is_valid_keyword(t.strip())]
    logger.info(f"Fetched {len(valid)} valid trends out of {len(raw)} raw")
    return valid

# ── Keyword Utilities ──────────────────────────────────────────────────────────
def parse_keywords(kw_string: str) -> List[str]:
    if not kw_string:
        return []
    return [kw.strip() for kw in kw_string.split(",") if kw.strip()]

def merge_keywords(existing: List[str], new_terms: List[str]) -> List[str]:
    existing_lower = {kw.lower() for kw in existing}
    merged = existing[:]
    for term in new_terms:
        if term.lower() not in existing_lower:
            merged.append(term)
            existing_lower.add(term.lower())
            logger.debug(f"Added: {term}")
    return merged

# ── HTML Update ────────────────────────────────────────────────────────────────
def update_meta_keywords(
    html_path: Path, keywords_list: List[str], dry_run: bool = False
) -> Tuple[bool, List[str]]:
    if not html_path.exists():
        raise FileNotFoundError(f"Index file not found: {html_path}")

    original = html_path.read_text(encoding="utf-8")
    soup = BeautifulSoup(original, "html.parser")

    head = soup.head
    if head is None:
        logger.warning("No <head> found — creating one.")
        head = soup.new_tag("head")
        if soup.html:
            soup.html.insert(0, head)

    # ── Meta Keywords ──
    meta_kw = head.find("meta", attrs={"name": "keywords"})
    existing_list = []
    old_content = ""

    if meta_kw and meta_kw.get("content"):
        old_content = meta_kw["content"]
        existing_list = parse_keywords(old_content)

    merged = merge_keywords(existing_list, keywords_list)
    existing_lower = {kw.lower() for kw in existing_list}
    added = [kw for kw in merged if kw.lower() not in existing_lower]
    new_content = ", ".join(merged)

    kw_changed = False
    if meta_kw:
        if old_content.strip() != new_content.strip():
            kw_changed = True
            if not dry_run:
                meta_kw["content"] = new_content
    else:
        kw_changed = True
        if not dry_run:
            new_meta = soup.new_tag("meta")
            new_meta.attrs["name"] = "keywords"
            new_meta.attrs["content"] = new_content
            head.append(new_meta)

    # ── Last Updated ──
    today = datetime.utcnow().strftime("%Y-%m-%d")
    last_upd = head.find("meta", attrs={"name": "last-updated"})
    upd_changed = False

    if last_upd:
        if last_upd.get("content", "") != today:
            upd_changed = True
            if not dry_run:
                last_upd["content"] = today
    else:
        upd_changed = True
        if not dry_run:
            m = soup.new_tag("meta")
            m.attrs["name"] = "last-updated"
            m.attrs["content"] = today
            head.append(m)

    changed = kw_changed or upd_changed
    if changed and not dry_run:
        html_path.write_text(str(soup), encoding="utf-8")
        logger.info(f"Wrote updated HTML to {html_path}")
    elif changed and dry_run:
        logger.info("[DRY RUN] No files written.")
    else:
        logger.info("No changes to write.")

    return changed, added

# ── GitHub Actions Integration ─────────────────────────────────────────────────
def set_github_env(name: str, value: str):
    gh_env = os.getenv("GITHUB_ENV")
    if gh_env:
        with open(gh_env, "a") as f:
            f.write(f"{name}={value}\n")

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    logger.info("=" * 60)
    logger.info(f"Kenya Trends Updater | TOP_K={TOP_K} | DRY_RUN={DRY_RUN}")
    logger.info("=" * 60)

    html_path = Path(INDEX_PATH)

    trends = []
    try:
        trends = fetch_top_trends(TOP_K)
    except Exception as e:
        logger.error(f"All retries failed: {e}")

    if not trends:
        logger.warning("No live trends fetched. Exiting unchanged.")
        sys.exit(0)

    logger.info(f"Trends: {trends[:5]}...")

    try:
        changed, added = update_meta_keywords(html_path, trends, dry_run=DRY_RUN)
    except Exception as e:
        logger.error(f"Failed to update HTML: {e}", exc_info=True)
        sys.exit(1)

    if changed and not DRY_RUN and added:
        snippet = ", ".join(added[:3])
        if len(added) > 3:
            snippet += "..."
        set_github_env("NEW_KEYWORDS_SNIPPET", snippet)
        logger.info(f"Added {len(added)} new keywords: {added[:5]}...")
    else:
        logger.info("No new keywords added.")

    logger.info("Done.")


if __name__ == "__main__":
    main()
