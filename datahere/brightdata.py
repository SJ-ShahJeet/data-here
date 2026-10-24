"""Bright Data client: every byte of live web data comes through here. Disk-cached.

Endpoints (verified against docs.brightdata.com on 2026-10-24):
- Web Unlocker: POST https://api.brightdata.com/request  {zone, url, format:"raw"} -> raw HTML
  (products/web-unlocker/send-your-first-request)
- SERP API: same endpoint, SERP zone, url=https://www.google.com/search?q=...&brd_json=1 ->
  parsed JSON; results in "organic": [{link, title, description, rank, ...}]
  (products/serp-api/send-your-first-request, products/serp-api/parsed-json-results)
- Web Scraper API (async, products/scrapers/scrapers-library/async-requests):
  POST /datasets/v3/trigger?dataset_id=..&include_errors=true[&type=discover_new&discover_by=..]
       body {"input": [{url}], "limit_per_input": N}  -> {"snapshot_id"}
  GET  /datasets/v3/progress/{id} -> status: starting|running|ready|failed|canceled
  GET  /datasets/v3/snapshot/{id}?format=json -> list of records (202 while still building)
- Datasets (docs.brightdata.com/scrapers/linkedin.com.json):
  gd_l1viktl72bvl7bjuj0 LinkedIn people profiles, collect_by_url, input {url}
  gd_lyy3tktm25m4avu764 LinkedIn posts; we use discover_by=profile_url, input {url: profile}
  (optional start_date, end_date, only_authored_posts)
"""

import hashlib
import json
import os
import tempfile
import time
from urllib.parse import quote_plus, urlparse

import httpx
from selectolax.lexbor import LexborHTMLParser as HTMLParser

from datahere.config import CACHE_DIR, OFFLINE, env

API = "https://api.brightdata.com"
POLL_TIMEOUT = float(env("BRIGHTDATA_POLL_TIMEOUT", "300"))
POLL_INTERVAL = float(env("BRIGHTDATA_POLL_INTERVAL", "5"))

SKIP_DOMAINS = {
    "linkedin", "facebook", "yelp", "wikipedia", "crunchbase", "instagram", "doordash",
    "ubereats", "x", "twitter", "tripadvisor", "glassdoor", "indeed", "zoominfo",
}


def _cache_path(kind: str, key):
    h = hashlib.sha256(json.dumps(key, sort_keys=True).encode()).hexdigest()
    return CACHE_DIR / "brightdata" / kind / f"{h}.json"


def _write(path, value):
    """Atomic: concurrent threads never see a half-written cache file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    with os.fdopen(fd, "w") as f:
        json.dump(value, f)
    os.replace(tmp, path)


def _cached(kind: str, key, fn):
    """Return cached value for (kind, key); else call fn(), store, return. OFFLINE => cache only."""
    path = _cache_path(kind, key)
    if path.exists():
        return json.loads(path.read_text())
    if OFFLINE:
        raise RuntimeError(f"OFFLINE=1 and no Bright Data cache for {kind}: {key!r} ({path})")
    value = fn()
    _write(path, value)
    return value


def _post(path: str, json_body=None, params=None, method: str = "POST", timeout: float = 90):
    """Authenticated call to api.brightdata.com; 2 retries on 5xx/timeouts. Returns httpx.Response."""
    key = env("BRIGHTDATA_API_KEY")
    if not key:
        raise RuntimeError("BRIGHTDATA_API_KEY is not set")
    headers = {"Authorization": f"Bearer {key}"}
    for attempt in range(3):
        try:
            r = httpx.request(method, API + path, json=json_body, params=params,
                              headers=headers, timeout=timeout)
        except (httpx.TimeoutException, httpx.TransportError) as e:
            if attempt == 2:
                raise RuntimeError(f"Bright Data {path}: {e!r}") from e
        else:
            if r.status_code < 500 or attempt == 2:
                if r.status_code >= 400:
                    raise RuntimeError(f"Bright Data {path} {r.status_code}: {r.text[:500]}")
                return r
        time.sleep(2 * (attempt + 1))


def fetch(url: str) -> str:
    """Web Unlocker: raw HTML of a public page."""
    zone = env("BRIGHTDATA_UNLOCKER_ZONE", "web_unlocker1")
    return _cached("unlocker", {"zone": zone, "url": url},
                   lambda: _post("/request", {"zone": zone, "url": url, "format": "raw"}).text)


def html_to_text(html: str, max_chars: int = 8000) -> str:
    tree = HTMLParser(html)
    for node in tree.css("script, style, nav, footer, noscript, svg"):
        node.decompose()
    root = tree.body or tree.root
    text = " ".join(root.text(separator=" ").split()) if root else ""
    # logos (customers, partners) usually exist only as image alt text
    alts = dict.fromkeys(a for n in tree.css("img[alt]") if (a := (n.attributes.get("alt") or "").strip()))
    if alts:
        text = f"Image labels (logos): {', '.join(alts)}. {text}"
    return text[:max_chars]


def page_text(url: str, max_chars: int = 8000) -> str:
    """fetch() + strip to readable text (selectolax)."""
    return html_to_text(fetch(url), max_chars)


def search(query: str, num: int = 10) -> list[dict]:
    """SERP API (Google). Returns [{"title", "url", "snippet"}]."""
    zone = env("BRIGHTDATA_SERP_ZONE", "serp_api1")
    url = f"https://www.google.com/search?q={quote_plus(query)}&num={num}&brd_json=1"

    def call():
        # Google sometimes answers with an empty body or opaque google.com/goto redirect
        # links instead of real URLs; both clear up on a fresh request.
        results = []
        for _ in range(3):
            r = _post("/request", {"zone": zone, "url": url, "format": "raw"})
            if not r.content.strip():
                continue
            data = r.json()
            if isinstance(data.get("body"), str):  # some zones wrap the payload
                data = json.loads(data["body"])
            results = [{"title": o.get("title", ""), "url": o.get("link", ""),
                        "snippet": o.get("description", "")} for o in data.get("organic", [])]
            if not any("google.com/goto" in x["url"] for x in results):
                break
        return [x for x in results if "google.com/goto" not in x["url"]]

    return _cached("serp", {"zone": zone, "url": url}, call)[:num]


def _domain(url: str) -> str:
    host = urlparse(url).netloc.lower().split(":")[0]
    return host[4:] if host.startswith("www.") else host


def find_company_domain(company: str) -> str:
    """Best-guess homepage domain for a company name, via search()."""
    for r in search(f"{company} official site"):
        d = _domain(r["url"])
        if d and not any(p in SKIP_DOMAINS for p in d.split(".")):
            return d
    return ""


def find_linkedin_url(name: str, company: str) -> str:
    """'site:linkedin.com/in <name> <company>' via search(); '' when not found."""
    last = name.split()[-1].lower() if name.split() else ""
    for r in search(f'site:linkedin.com/in "{name}" "{company}"'):
        if "linkedin.com/in/" in r["url"] and last and last in r["title"].lower():
            return r["url"].split("?")[0]
    return ""


def _dataset(kind: str, dataset_id: str, urls: list[str], params: dict, limit=None) -> dict:
    """Run a dataset job for uncached urls; cache records per input url. Returns {url: [records]}."""
    out, missing = {}, []
    for u in dict.fromkeys(urls):
        p = _cache_path(kind, u)
        if p.exists():
            out[u] = json.loads(p.read_text())
        else:
            missing.append(u)
    if not missing:
        return out
    if OFFLINE:
        raise RuntimeError(f"OFFLINE=1 and no Bright Data cache for {kind}: {missing}")

    body = {"input": [{"url": u} for u in missing], "limit_per_input": limit}
    q = {"dataset_id": dataset_id, "include_errors": "true", **params}
    snap = _post("/datasets/v3/trigger", body, q).json()["snapshot_id"]

    deadline = time.monotonic() + POLL_TIMEOUT
    while True:
        if time.monotonic() > deadline:
            raise RuntimeError(f"Bright Data snapshot {snap} not ready after {POLL_TIMEOUT}s")
        status = _post(f"/datasets/v3/progress/{snap}", method="GET").json().get("status")
        if status in ("failed", "canceled"):
            raise RuntimeError(f"Bright Data snapshot {snap} {status}")
        if status == "ready":
            r = _post(f"/datasets/v3/snapshot/{snap}", params={"format": "json"}, method="GET")
            if r.status_code == 200:
                records = r.json()
                break
        time.sleep(POLL_INTERVAL)

    grouped = {u: [] for u in missing}
    for rec in records:
        if rec.get("error") or rec.get("error_code"):
            continue
        src = (rec.get("input") or {}).get("url") or rec.get("input_url") or rec.get("url")
        if src not in grouped and len(missing) == 1:
            src = missing[0]
        if src in grouped:
            grouped[src].append(rec)
    for u, recs in grouped.items():
        # empty results are cached too, so story-mode replay never hits the network;
        # delete the cache file to retry a profile that came back empty
        _write(_cache_path(kind, u), recs)
        out[u] = recs
    return out


def linkedin_profiles(urls: list[str]) -> list[dict]:
    """Web Scraper API, LinkedIn profiles dataset. Trigger, poll, return records."""
    ds = env("BRIGHTDATA_LINKEDIN_PROFILES_DATASET", "gd_l1viktl72bvl7bjuj0")
    got = _dataset("linkedin_profiles", ds, urls, {})
    return [rec for u in dict.fromkeys(urls) for rec in got.get(u, [])]


def linkedin_posts(profile_urls: list[str], limit_per_profile: int = 5) -> list[dict]:
    """Web Scraper API, LinkedIn posts dataset (recent posts by each profile)."""
    ds = env("BRIGHTDATA_LINKEDIN_POSTS_DATASET", "gd_lyy3tktm25m4avu764")
    got = _dataset("linkedin_posts", ds, profile_urls,
                   {"type": "discover_new", "discover_by": "profile_url"}, limit_per_profile)
    return [rec for u in dict.fromkeys(profile_urls) for rec in got.get(u, [])[:limit_per_profile]]


if __name__ == "__main__":
    if not env("BRIGHTDATA_API_KEY"):
        raise SystemExit("BRIGHTDATA_API_KEY not set; live smoke test skipped")
    print(page_text("https://forkastrestaurants.com")[:300])
    print(search("Forkast restaurants")[:1])
