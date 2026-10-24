"""Public Luma event page -> attendees. Only what Luma shows logged out: hosts + featured guests.

The full guest list needs a login; that comes from the host's export instead (see D10, D14).
"""

import json
import re

from datahere import brightdata
from datahere.schema import Attendee


def parse_event(html: str) -> tuple[str, list[Attendee]]:
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.S)
    if not m:
        raise ValueError("no __NEXT_DATA__ on page; not a Luma event page?")
    data = json.loads(m.group(1))["props"]["pageProps"]["initialData"]["data"]
    event = (data.get("event") or {}).get("name", "")
    people = []
    for role, users in (("host", data.get("hosts") or []), ("guest", data.get("featured_guests") or [])):
        for u in users:
            handle = u.get("linkedin_handle") or ""
            people.append(Attendee(
                name=u.get("name", "").strip(),
                role=(u.get("bio_short") or role).replace("\n", " ").strip(),
                company="",  # filled from LinkedIn during enrichment
                linkedin_url=f"https://www.linkedin.com{handle}" if handle.startswith("/in/") else "",
            ))
    return event, [p for p in people if p.name]


def public_attendees(event_url: str) -> tuple[str, list[Attendee]]:
    """Fetch through Bright Data (strip personal ?tk= links: we only read the public page)."""
    return parse_event(brightdata.fetch(event_url.split("?")[0]))


def load(event_url: str) -> list[Attendee]:
    """public_attendees + company filled from each LinkedIn profile (batched, cached).
    People whose profile yields no company are dropped: nothing to rank them on."""
    _, people = public_attendees(event_url)
    urls = [p.linkedin_url for p in people if p.linkedin_url]
    by_url = {}
    for r in brightdata.linkedin_profiles(urls) if urls else []:
        cur = r.get("current_company") if isinstance(r.get("current_company"), dict) else {}
        by_url[r.get("input_url") or (r.get("input") or {}).get("url") or r.get("url")] = cur.get("name") or r.get("current_company_name") or ""
    out = [p.model_copy(update={"company": by_url.get(p.linkedin_url, "")}) for p in people]
    return [p for p in out if p.company]
