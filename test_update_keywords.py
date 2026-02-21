"""
Tests for update_keywords.py — keyword validation, merge logic, and HTML updates.
"""

import os
import tempfile
from pathlib import Path

import pytest

from update_keywords import (
    is_valid_keyword,
    parse_keywords,
    merge_keywords,
    update_meta_keywords,
)


# ── Keyword Validation ─────────────────────────────────────────────────────────

class TestIsValidKeyword:
    def test_valid_terms(self):
        assert is_valid_keyword("voter registration Kenya")
        assert is_valid_keyword("IEBC offices")
        assert is_valid_keyword("2027 election guide")

    def test_empty_or_short(self):
        assert not is_valid_keyword("")
        assert not is_valid_keyword("ab")

    def test_too_long(self):
        assert not is_valid_keyword("x" * 101)

    def test_urls(self):
        assert not is_valid_keyword("https://example.com")
        assert not is_valid_keyword("www.google.com")

    def test_no_alpha(self):
        assert not is_valid_keyword("12345")
        assert not is_valid_keyword("!!!???")


# ── Parse Keywords ─────────────────────────────────────────────────────────────

class TestParseKeywords:
    def test_basic(self):
        assert parse_keywords("a, b, c") == ["a", "b", "c"]

    def test_empty(self):
        assert parse_keywords("") == []
        assert parse_keywords(None) == []

    def test_trailing_comma(self):
        assert parse_keywords("foo, bar, ") == ["foo", "bar"]


# ── Merge Keywords ─────────────────────────────────────────────────────────────

class TestMergeKeywords:
    def test_adds_new(self):
        result = merge_keywords(["IEBC", "Kenya"], ["democracy", "rights"])
        assert result == ["IEBC", "Kenya", "democracy", "rights"]

    def test_deduplicates_case_insensitive(self):
        result = merge_keywords(["IEBC", "Kenya"], ["iebc", "kenya", "new term"])
        assert result == ["IEBC", "Kenya", "new term"]

    def test_preserves_original_order(self):
        result = merge_keywords(["a", "b", "c"], ["c", "d"])
        assert result == ["a", "b", "c", "d"]


# ── HTML Update ────────────────────────────────────────────────────────────────

class TestUpdateMetaKeywords:
    def _make_html(self, keywords_content: str = None) -> Path:
        content = """<!DOCTYPE html><html><head>
        <title>Test</title>
        """
        if keywords_content is not None:
            content += f'<meta name="keywords" content="{keywords_content}" />\n'
        content += "</head><body></body></html>"

        tmp = tempfile.NamedTemporaryFile(
            mode="w", suffix=".html", delete=False, encoding="utf-8"
        )
        tmp.write(content)
        tmp.close()
        return Path(tmp.name)

    def test_creates_meta_when_missing(self):
        p = self._make_html(keywords_content=None)
        try:
            changed, added = update_meta_keywords(p, ["IEBC", "Kenya"])
            assert changed
            assert "IEBC" in added
            text = p.read_text(encoding="utf-8")
            assert 'name="keywords"' in text
            assert "IEBC" in text
        finally:
            os.unlink(p)

    def test_appends_without_overwriting(self):
        p = self._make_html("existing, keywords")
        try:
            changed, added = update_meta_keywords(p, ["new term"])
            assert changed
            text = p.read_text(encoding="utf-8")
            assert "existing" in text
            assert "keywords" in text
            assert "new term" in text
        finally:
            os.unlink(p)

    def test_no_change_when_all_exist(self):
        p = self._make_html("existing, keywords")
        try:
            changed, added = update_meta_keywords(p, ["existing", "keywords"])
            # changed may be True due to last-updated meta. Verify no keywords added.
            assert added == []
        finally:
            os.unlink(p)

    def test_dry_run(self):
        p = self._make_html("original")
        try:
            original_text = p.read_text(encoding="utf-8")
            changed, added = update_meta_keywords(p, ["brand new"], dry_run=True)
            assert changed  # Would have changed
            after_text = p.read_text(encoding="utf-8")
            assert original_text == after_text  # But file unchanged
        finally:
            os.unlink(p)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
