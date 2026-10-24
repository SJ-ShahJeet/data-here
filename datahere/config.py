import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def env(name: str, default: str = "") -> str:
    return os.getenv(name) or default


OFFLINE = env("OFFLINE", "0") == "1"
CACHE_DIR = Path(env("CACHE_DIR", "cache"))
