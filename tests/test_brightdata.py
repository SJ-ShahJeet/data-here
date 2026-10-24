import json

import pytest

from datahere import brightdata as bd


@pytest.fixture
def offline(tmp_path, monkeypatch):
    monkeypatch.setattr(bd, "CACHE_DIR", tmp_path)
    monkeypatch.setattr(bd, "OFFLINE", True)
    monkeypatch.setattr(bd.httpx, "request", lambda *a, **k: pytest.fail("network call"))
    return tmp_path


def seed(kind, key, value):
    p = bd._cache_path(kind, key)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(value))


HTML = """<html><head><style>.x{}</style><script>var a=1</script></head><body>
<nav>Menu Home</nav><h1>Forkast</h1>  <p>Great   food,
fast.</p><footer>Copyright</footer></body></html>"""


def test_page_text_from_cache_strips_noise(offline):
    seed("unlocker", {"zone": "web_unlocker1", "url": "https://a.com"}, HTML)
    assert bd.page_text("https://a.com") == "Forkast Great food, fast."
    assert bd.page_text("https://a.com", max_chars=7) == "Forkast"


def test_offline_cache_miss_raises(offline):
    with pytest.raises(RuntimeError, match="OFFLINE"):
        bd.fetch("https://missing.com")
    with pytest.raises(RuntimeError, match="OFFLINE"):
        bd.linkedin_profiles(["https://linkedin.com/in/nobody"])


def test_search_helpers_from_cache(offline):
    q = lambda s: {"zone": "serp_api1",
                   "url": f"https://www.google.com/search?q={bd.quote_plus(s)}&num=10&brd_json=1"}
    seed("serp", q("Forkast official site"), [
        {"title": "Forkast | LinkedIn", "url": "https://www.linkedin.com/company/forkast", "snippet": ""},
        {"title": "Forkast", "url": "https://www.forkastrestaurants.com/about", "snippet": ""},
    ])
    assert bd.find_company_domain("Forkast") == "forkastrestaurants.com"
    seed("serp", q('site:linkedin.com/in "Jane Doe" "Forkast"'), [
        {"title": "John Roe - Forkast", "url": "https://www.linkedin.com/in/jroe", "snippet": ""},
        {"title": "Jane DOE - CEO", "url": "https://www.linkedin.com/in/janedoe?trk=x", "snippet": ""},
    ])
    assert bd.find_linkedin_url("Jane Doe", "Forkast") == "https://www.linkedin.com/in/janedoe"
    with pytest.raises(RuntimeError):  # different query -> cache miss
        bd.find_linkedin_url("Jane Doe", "Other")


def test_dataset_cache_per_url(offline):
    seed("linkedin_posts", "https://linkedin.com/in/a", [{"id": i} for i in range(9)])
    assert len(bd.linkedin_posts(["https://linkedin.com/in/a"], limit_per_profile=3)) == 3
