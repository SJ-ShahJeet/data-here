export function fmtBytes(n: number): string {
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + " MB";
  if (n >= 1024) return (n / 1024).toFixed(1) + " KB";
  return n + " B";
}

export function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * One reading for every timestamp on the page.
 *
 * The sources disagree by origin: the engine stamps UTC (`…T05:29:09Z`) while git
 * reports a local offset (`…T23:16:17-06:00`). Rendering both raw put two numbers
 * side by side that could not be compared without doing timezone arithmetic in
 * your head — on a panel that had already computed the comparison and printed the
 * answer two lines above. Normalising to one local form removes the arithmetic.
 *
 * An unparseable value is returned untouched rather than hidden: a real string the
 * engine wrote is more useful than a dash that erases it.
 */
export function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
