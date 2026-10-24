import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { watchMemory, WATCH_DEBOUNCE_MS, WATCHED_KEYS } from "./watch";
import { HOME_DIR, OWNED_PATHS } from "./mg-config";
import { makeSandbox, Sandbox } from "../tests/sandbox";

/**
 * Wait until `probe()` is true, or give up after `timeoutMs`.
 *
 * These tests previously used fixed sleeps: 100ms for chokidar's initial scan,
 * then 200ms for the event. That 200ms has to cover awaitWriteFinish's 120ms
 * stability threshold plus the debounce, leaving almost no slack — so under
 * full-suite parallel load the watcher was not ready when the write landed and
 * the event was missed. Polling removes the race instead of lengthening the
 * sleep, and still returns immediately in the common case.
 */
async function waitFor(probe: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (probe()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
}


// The watched directories as sandbox-relative paths. They live inside
// memory-graph's single home, which is what the registry resolves to.
const WATCHED_RELS = WATCHED_KEYS.map((key) => `${HOME_DIR}/${OWNED_PATHS[key]}`);

describe("watchMemory", () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = makeSandbox();
    // Preemptively create the watched directories themselves (empty) so a
    // test's later file-adds don't ALSO trigger a spurious "addDir" event
    // for the directory's own just-in-time creation, which would land in
    // its own debounce window separate from the files written inside it.
    // Deliberately create directories only, not files: pre-existing files
    // can themselves surface a spurious "change" event shortly after the
    // watcher starts on some fsevents backends even with ignoreInitial,
    // which would pollute callCount before the test's real writes happen.
    WATCHED_RELS.forEach((dir) => {
      sandbox.mkdir(dir);
    });
  });

  afterEach(() => {
    sandbox.cleanup();
  });

  it("calls onChange when watched files change", async () => {
    const onChange = new Promise<void>((resolve) => {
      const spy = () => resolve();
      watchMemory(sandbox.root, spy, { debounceMs: 50 });
    });

    setTimeout(() => {
      sandbox.write(`${HOME_DIR}/memory/test.yaml`, "test: data");
    }, 100);

    await Promise.race([
      onChange,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 2000)
      ),
    ]);
  });

  it("debounces multiple file changes within window", async () => {
    let callCount = 0;
    const watcher = watchMemory(sandbox.root, () => callCount++, {
      debounceMs: 50,
    });

    // Wait for the watcher (and chokidar's own initial-scan bookkeeping) to
    // fully stabilize before the assertions-relevant writes happen, so no
    // stray startup event bleeds into this window's count.
    await new Promise((r) => setTimeout(r, 300));

    // Rapid file changes
    sandbox.write(`${HOME_DIR}/memory/file1.yaml`, "data1");
    sandbox.write(`${HOME_DIR}/memory/file2.yaml`, "data2");
    sandbox.write(`${HOME_DIR}/memory/file3.yaml`, "data3");

    // Wait for debounce + chokidar's awaitWriteFinish polling to settle.
    await new Promise((r) => setTimeout(r, 500));

    expect(callCount).toBe(1);
    await watcher.close();
  });

  it("uses WATCH_DEBOUNCE_MS as default", async () => {
    expect(WATCH_DEBOUNCE_MS).toBe(250);
  });

  it("closes watcher cleanly", async () => {
    const watcher = watchMemory(sandbox.root, () => {}, {
      debounceMs: 50,
    });
    await expect(watcher.close()).resolves.toBeUndefined();
  });

  it("tolerates non-existent directories", async () => {
    const emptyRoot = sandbox.root; // will have no watched dirs initially
    const watcher = watchMemory(emptyRoot, () => {}, { debounceMs: 50 });
    await new Promise((r) => setTimeout(r, 300));
    await watcher.close();
  });

  it("watches memory directory", async () => {
    let called = false;
    const watcher = watchMemory(sandbox.root, () => {
      called = true;
    }, { debounceMs: 50 });

    await new Promise((r) => setTimeout(r, 300));
    sandbox.write(`${HOME_DIR}/memory/state.yaml`, "test");
    await waitFor(() => called);

    expect(called).toBe(true);
    await watcher.close();
  });

  it("watches sessions directory", async () => {
    let called = false;
    const watcher = watchMemory(sandbox.root, () => {
      called = true;
    }, { debounceMs: 50 });

    await new Promise((r) => setTimeout(r, 300));
    sandbox.write(`${HOME_DIR}/sessions/session.yaml`, "test");
    await waitFor(() => called);

    expect(called).toBe(true);
    await watcher.close();
  });

  it("watches graphify-out directory", async () => {
    let called = false;
    const watcher = watchMemory(sandbox.root, () => {
      called = true;
    }, { debounceMs: 50 });

    await new Promise((r) => setTimeout(r, 300));
    sandbox.write(`${HOME_DIR}/graphify-out/output.json`, "{}");
    await waitFor(() => called);

    expect(called).toBe(true);
    await watcher.close();
  });

  it("ignores .git and .next directories", async () => {
    let callCount = 0;
    const watcher = watchMemory(sandbox.root, () => callCount++, {
      debounceMs: 50,
    });

    // Wait for the watcher (and chokidar's own initial-scan bookkeeping) to
    // fully stabilize before the assertions-relevant writes happen, so no
    // stray startup event bleeds into this window's count.
    await new Promise((r) => setTimeout(r, 300));

    // These should be ignored
    sandbox.write(".git/HEAD", "ref: refs/heads/main");
    sandbox.write(".next/build-id", "12345");

    await new Promise((r) => setTimeout(r, 400));

    expect(callCount).toBe(0);
    await watcher.close();
  });
});
