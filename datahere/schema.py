"""Shared data contracts. Every module imports from here; change with care."""

from typing import Literal

from pydantic import BaseModel, Field


class Attendee(BaseModel):
    name: str
    role: str = ""
    company: str
    linkedin_url: str = ""  # known up front (e.g. Luma profile); skips the search step


class ICP(BaseModel):
    segments: list[str] = Field(default_factory=list)  # e.g. ["fast casual", "QSR"]
    min_locations: int | None = None
    max_locations: int | None = None
    buyer_roles: list[str] = Field(default_factory=list)  # e.g. ["cfo", "vp operations"]
    pain_topics: list[str] = Field(default_factory=list)  # e.g. ["pricing", "margins"]
    disqualify: list[str] = Field(default_factory=list)  # e.g. ["vendor", "single location"]


class SellerProfile(BaseModel):
    url: str
    name: str
    summary: str
    icp: ICP
    customers: list[str] = Field(default_factory=list)  # lookalike anchors


CompanyKind = Literal["operator", "vendor", "association", "media", "investor", "other"]


class Signal(BaseModel):
    kind: Literal["post", "job", "news", "site"]
    topic: str  # one of ICP.pain_topics when it matches, else a short keyword
    text: str  # evidence snippet, <= 300 chars
    url: str = ""
    date: str = ""  # ISO date when known


class CompanyInfo(BaseModel):
    name: str
    domain: str = ""
    kind: CompanyKind = "other"
    segment: str = ""  # e.g. "fast casual"
    locations: int | None = None
    summary: str = ""
    signals: list[Signal] = Field(default_factory=list)


class PersonProfile(BaseModel):
    name: str
    company: str
    title: str = ""
    linkedin_url: str = ""
    headline: str = ""
    email: str = ""
    signals: list[Signal] = Field(default_factory=list)  # their posts, tagged by topic


class Reason(BaseModel):
    factor: Literal["fit", "intent", "lookalike", "warmth"]
    points: float
    text: str  # human sentence, e.g. "fast casual, 60 locations"
    path: list[str]  # graph path as node labels, e.g. ["Priya", "WORKS_AT", "Chain X", "IS", "fast casual"]


class Match(BaseModel):
    person_id: str
    name: str
    title: str
    company: str
    email: str = ""
    score: float
    reasons: list[Reason]
    warm_intro: str | None = None  # name of who can introduce you
    hook: str | None = None  # best intent signal text to open with


class Note(BaseModel):
    """Parsed from free text like 'Met Sam at Tech Week. She can help with fundraising.'"""

    person: str
    company: str = ""
    met_at: str = ""
    can_help_with: list[str] = Field(default_factory=list)
    knows: list[str] = Field(default_factory=list)  # other people this person knows
