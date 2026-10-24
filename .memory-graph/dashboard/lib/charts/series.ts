import type { Compression } from "../scan/compression";
import type { Sessions } from "../scan/sessions";

export interface Point {
  x: number;
  y: number;
}

export function savingsSeries(data: Compression): Point[] {
  if (data.entries.length === 0) {
    return [];
  }

  let cumulativeSaved = 0;
  return data.entries.map((entry, i) => {
    cumulativeSaved += entry.saved;
    return { x: i, y: cumulativeSaved };
  });
}

export function cadenceSeries(data: Sessions): Point[] {
  if (data.items.length === 0) {
    return [];
  }

  // Group by date, filter out empty strings
  const dateMap = new Map<string, number>();
  for (const item of data.items) {
    if (item.date === "") continue;
    dateMap.set(item.date, (dateMap.get(item.date) ?? 0) + 1);
  }

  if (dateMap.size === 0) {
    return [];
  }

  // Sort dates ascending
  const sortedDates = Array.from(dateMap.keys()).sort();

  // Build points
  return sortedDates.map((date, i) => ({
    x: i,
    y: dateMap.get(date)!,
  }));
}

export function linePath(points: Point[], width: number, height: number, padding?: number): string {
  const padAmount = padding ?? 8;

  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    const cx = Number((width / 2).toFixed(2));
    const cy = Number((height / 2).toFixed(2));
    return `M ${cx} ${cy}`;
  }

  // Find min/max
  let xMin = points[0].x;
  let xMax = points[0].x;
  let yMin = points[0].y;
  let yMax = points[0].y;

  for (const p of points) {
    if (p.x < xMin) xMin = p.x;
    if (p.x > xMax) xMax = p.x;
    if (p.y < yMin) yMin = p.y;
    if (p.y > yMax) yMax = p.y;
  }

  // Convert to screen coordinates
  const screenPoints: Point[] = points.map((p) => {
    let sx: number;
    let sy: number;

    if (xMax === xMin) {
      sx = width / 2;
    } else {
      sx = padAmount + ((p.x - xMin) / (xMax - xMin)) * (width - 2 * padAmount);
    }

    if (yMax === yMin) {
      sy = height / 2;
    } else {
      sy = height - padAmount - ((p.y - yMin) / (yMax - yMin)) * (height - 2 * padAmount);
    }

    return { x: Number(sx.toFixed(2)), y: Number(sy.toFixed(2)) };
  });

  // Build path
  let pathStr = `M ${screenPoints[0].x} ${screenPoints[0].y}`;
  for (let i = 1; i < screenPoints.length; i++) {
    pathStr += ` L ${screenPoints[i].x} ${screenPoints[i].y}`;
  }

  return pathStr;
}
