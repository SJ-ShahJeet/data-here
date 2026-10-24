"""Story-mode app: enter your website + an event (Luma link or attendee sheet), watch it run, step through the outcome.

Repeat inputs replay from cache in seconds (stage-safe); new inputs run live through Bright Data + OpenAI.
Runs on 127.0.0.1 only. Uploads and results go to data/ (gitignored): they hold real attendee data.
"""

import io
import sys
import threading
import uuid
from pathlib import Path

import uvicorn
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import FileResponse, JSONResponse
from starlette.routing import Route

from datahere import luma, pipeline, story

DATA = Path("data")
JOBS: dict[str, dict] = {}
RUN_LOCK = threading.Lock()  # ponytail: one run at a time (pipeline prints progress to a shared stdout); a queue if several users


class _Tee(io.TextIOBase):
    """Copies pipeline print() lines into the job log while still writing to the console."""

    def __init__(self, job: dict, console):
        self.job, self.console = job, console

    def write(self, s: str) -> int:
        self.console.write(s)
        for line in s.splitlines():
            if line.strip() and not line.startswith("HTTP Request"):
                self.job["log"].append(line.strip())
        return len(s)


def _run(job: dict, seller: str, source: str, event: str, deep: int) -> None:
    with RUN_LOCK:
        console, sys.stdout = sys.stdout, _Tee(job, sys.stdout)
        try:
            job["status"] = "running"
            job["stats"] = pipeline.run(seller, source, event, deep)
            job["log"].append("building the story…")
            story.build(seller, event, DATA / "story" / job["id"])
            job["status"] = "done"
        except Exception as e:  # surface any failure to the page instead of a silent spinner
            job["status"], job["error"] = "error", f"{type(e).__name__}: {e}"
        finally:
            sys.stdout = console


async def index(request: Request):
    return FileResponse(Path(__file__).with_name("story.html"))


async def start(request: Request):
    form = await request.form()
    seller = (form.get("website") or "").strip()
    event_url = (form.get("event_url") or "").strip()
    event = (form.get("event_name") or "").strip()
    sheet = form.get("sheet")
    if not seller:
        return JSONResponse({"error": "Enter your company website."}, status_code=400)
    if not seller.startswith("http"):
        seller = "https://" + seller
    if sheet is not None and getattr(sheet, "filename", ""):
        suffix = Path(sheet.filename).suffix.lower()
        if suffix not in (".xlsx", ".csv"):
            return JSONResponse({"error": "Attendee sheet must be .xlsx or .csv."}, status_code=400)
        source = DATA / "uploads" / f"{uuid.uuid4().hex[:8]}{suffix}"
        source.parent.mkdir(parents=True, exist_ok=True)
        source.write_bytes(await sheet.read())
        event = event or Path(sheet.filename).stem.replace("_", " ")
    elif event_url.startswith("http"):
        source = event_url.split("?")[0]  # drop personal ?tk= links: public page only
        if not event:
            try:
                event = luma.public_attendees(source)[0]
            except Exception as e:
                return JSONResponse({"error": f"Could not read that event page: {e}"}, status_code=400)
    else:
        return JSONResponse({"error": "Add an event link or upload an attendee sheet."}, status_code=400)
    if RUN_LOCK.locked():
        return JSONResponse({"error": "A run is already in progress; try again when it finishes."}, status_code=409)

    deep = int(form.get("deep") or 30)
    job = {"id": uuid.uuid4().hex[:10], "status": "queued", "log": [], "error": None, "event": event, "seller": seller}
    JOBS[job["id"]] = job
    threading.Thread(target=_run, args=(job, seller, str(source), event, deep), daemon=True).start()
    return JSONResponse({"id": job["id"], "event": event})


async def status(request: Request):
    job = JOBS.get(request.path_params["id"])
    if not job:
        return JSONResponse({"error": "unknown job"}, status_code=404)
    return JSONResponse({k: job[k] for k in ("status", "error", "event")} | {"log": job["log"][-12:], "lines": len(job["log"])})


async def result(request: Request):
    path = DATA / "story" / request.path_params["id"] / "story.json"
    return FileResponse(path) if path.exists() else JSONResponse({"error": "not ready"}, status_code=404)


app = Starlette(routes=[
    Route("/", index),
    Route("/api/run", start, methods=["POST"]),
    Route("/api/jobs/{id}", status),
    Route("/api/jobs/{id}/story", result),
])


def serve(port: int = 8100) -> None:
    print(f"data-here story mode: http://127.0.0.1:{port}")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
