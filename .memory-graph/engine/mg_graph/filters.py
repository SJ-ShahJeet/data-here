"""File filtering logic for graph projection: tests, generated files, vendored code."""

from __future__ import annotations


EXCLUDED_DIR_NAMES: frozenset[str] = frozenset({
    "node_modules", "__pycache__", ".git", "dist", "build", ".next",
    "vendor", "third_party", ".venv", "venv", "graphify-out",
    ".mypy_cache", ".pytest_cache"
})

TEST_PATH_PARTS: frozenset[str] = frozenset({
    "tests", "test", "__tests__", "spec", "e2e"
})

TEST_BASENAME_SUFFIXES: tuple[str, ...] = (
    "_test.py", ".test.ts", ".test.tsx", ".test.js", ".spec.ts", ".spec.tsx", ".spec.js",
    "_test.sh", "-test.sh",
)

# Shell test runners live in scripts/, not tests/, and are named with a hyphen
# rather than the `test_` Python convention — scripts/test-static.sh. Without
# this they rank as core: a checker that greps 34 engine files reads as a hub.
TEST_BASENAME_PREFIXES: tuple[str, ...] = ("test_", "test-")

# Shared fixture modules that live in a test tree but are not themselves tests.
# Every test depends on them, so their blast radius is real and they belong in
# the ranking — tests/helpers.py owns sandbox_repo(), the single most-called
# symbol in this repo.
TEST_FIXTURE_BASENAMES: frozenset[str] = frozenset({
    "conftest.py", "helpers.py", "helper.py", "fixtures.py", "factories.py",
    "helpers.ts", "helpers.tsx", "fixtures.ts", "fixtures.tsx",
    "test-utils.ts", "test-utils.tsx", "setup.ts",
})

GENERATED_SUFFIXES: tuple[str, ...] = (
    ".generated.ts", ".generated.tsx", ".gen.py", "_pb2.py", ".d.ts", ".min.js"
)

BARREL_NAMES: frozenset[str] = frozenset({
    "__init__.py", "index.ts", "index.tsx", "index.js", "index.jsx"
})

TYPE_ONLY_WEIGHT: float = 0.25


def _normalize(path: str) -> str:
    """Normalize path: backslashes to forward slashes, strip leading './'."""
    normalized = str(path).replace("\\", "/").strip()
    if normalized.startswith("./"):
        normalized = normalized[2:]
    return normalized


def is_test(source_file: str) -> bool:
    """True when the file is a test file by path or basename convention."""
    if not source_file:
        return False
    normalized = _normalize(source_file)

    # Check if any directory component is in TEST_PATH_PARTS
    parts = normalized.split("/")
    if any(part in TEST_PATH_PARTS for part in parts):
        return True

    # Check if basename starts with a test-runner prefix
    basename = parts[-1]
    if basename.startswith(TEST_BASENAME_PREFIXES) or basename == "test.sh":
        return True

    # Check if basename ends with any TEST_BASENAME_SUFFIXES
    if any(basename.endswith(suffix) for suffix in TEST_BASENAME_SUFFIXES):
        return True

    return False


def is_test_fixture(source_file: str) -> bool:
    """True for a shared fixture module inside a test tree.

    A fixture is infrastructure, not a test: `tests/helpers.py` has no
    assertions and 97 call sites. Excluding it hid the highest-blast-radius
    file in the repo from the ranking it exists to feed.
    """
    if not source_file:
        return False
    basename = _normalize(source_file).rsplit("/", 1)[-1]
    return basename in TEST_FIXTURE_BASENAMES


def is_generated(source_file: str) -> bool:
    """True when the file is generated or vendored (by basename suffix)."""
    if not source_file:
        return False
    normalized = _normalize(source_file)
    basename = normalized.rsplit("/", 1)[-1]
    return any(basename.endswith(suffix) for suffix in GENERATED_SUFFIXES)


def is_excluded(source_file: str) -> bool:
    """True when the file should be excluded from ranking."""
    if not source_file:
        return True

    if is_test(source_file) and not is_test_fixture(source_file):
        return True

    if is_generated(source_file):
        return True

    normalized = _normalize(source_file)
    parts = normalized.split("/")
    return any(part in EXCLUDED_DIR_NAMES for part in parts)


def is_barrel(source_file: str) -> bool:
    """True when the file is a barrel/index re-export file."""
    if not source_file:
        return False
    normalized = _normalize(source_file)
    basename = normalized.rsplit("/", 1)[-1]
    return basename in BARREL_NAMES


def type_only_weight(kind: str) -> float:
    """Return weight multiplier for edge based on target node kind."""
    if str(kind).strip() == "type":
        return TYPE_ONLY_WEIGHT
    return 1.0
