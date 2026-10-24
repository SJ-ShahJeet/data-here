export function changedNumericPaths(prev: unknown, next: unknown): string[] {
  const changed: string[] = [];

  function walk(p: unknown, n: unknown, path: string): void {
    // If both are plain objects, descend by keys of next
    if (
      p !== null &&
      typeof p === "object" &&
      !Array.isArray(p) &&
      n !== null &&
      typeof n === "object" &&
      !Array.isArray(n)
    ) {
      const nextObj = n as Record<string, unknown>;
      for (const key in nextObj) {
        const newPath = path ? `${path}.${key}` : key;
        walk((p as Record<string, unknown>)[key], nextObj[key], newPath);
      }
    }
    // If both are arrays, descend by indices
    else if (Array.isArray(p) && Array.isArray(n)) {
      const len = Math.min(p.length, n.length);
      for (let i = 0; i < len; i++) {
        const newPath = path ? `${path}.${i}` : String(i);
        walk(p[i], n[i], newPath);
      }
    }
    // If both are finite numbers and they differ, report the path
    else if (typeof p === "number" && typeof n === "number" && isFinite(p) && isFinite(n) && p !== n) {
      changed.push(path);
    }
  }

  walk(prev, next, "");
  return changed.sort();
}
