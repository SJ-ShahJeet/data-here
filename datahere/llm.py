"""OpenAI (or TrueFoundry gateway) calls, disk-cached so the demo replays deterministically."""

import hashlib
import json

from openai import OpenAI
from openai.lib._pydantic import to_strict_json_schema
from pydantic import BaseModel

from datahere.config import CACHE_DIR, OFFLINE, env

MODEL = env("OPENAI_MODEL", "gpt-4.1-mini")
_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        # blank OPENAI_BASE_URL in .env would otherwise be picked up by the SDK as ""
        base_url = env("OPENAI_BASE_URL", "https://api.openai.com/v1")
        _client = OpenAI(api_key=env("OPENAI_API_KEY"), base_url=base_url)
    return _client


def _strip_defaults(node):
    # Strict mode rejects "default"; the pydantic model still applies them on validate.
    if isinstance(node, dict):
        return {k: _strip_defaults(v) for k, v in node.items() if k != "default"}
    if isinstance(node, list):
        return [_strip_defaults(v) for v in node]
    return node


def _complete(system: str, prompt: str, response_format: dict | None) -> str:
    key = hashlib.sha256(json.dumps([MODEL, system, prompt, response_format], sort_keys=True).encode()).hexdigest()
    path = CACHE_DIR / "llm" / f"{key}.json"
    if path.exists():
        return json.loads(path.read_text())["content"]
    if OFFLINE:
        raise RuntimeError(f"OFFLINE and LLM cache miss: {path}")
    messages = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": prompt}]
    kwargs = {"response_format": response_format} if response_format else {}
    resp = _get_client().chat.completions.create(model=MODEL, messages=messages, temperature=0, **kwargs)
    content = resp.choices[0].message.content or ""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"content": content}))
    return content


def structured(prompt: str, schema: type[BaseModel], system: str = "") -> BaseModel:
    fmt = {
        "type": "json_schema",
        "json_schema": {"name": schema.__name__, "strict": True, "schema": _strip_defaults(to_strict_json_schema(schema))},
    }
    return schema.model_validate_json(_complete(system, prompt, fmt))


def text(prompt: str, system: str = "") -> str:
    return _complete(system, prompt, None)
