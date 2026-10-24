"use client";

import { useState } from "react";
import type { Compression } from "@/lib/scan/compression";
import { savingsSeries, linePath } from "@/lib/charts/series";
import { useMotionSafe } from "@/hooks/useMotionSafe";
import { DURATION, EASE_HOUSE_CSS } from "@/lib/motion-tokens";

export interface SavingsOverTimeProps {
  data: Compression;
  width?: number;
  height?: number;
}

export function SavingsOverTime(props: SavingsOverTimeProps): React.JSX.Element {
  const width = props.width ?? 640;
  const height = props.height ?? 200;
  const points = savingsSeries(props.data);
  const motionSafe = useMotionSafe();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (points.length === 0) {
    return <p data-testid="chart-empty">No compression events yet</p>;
  }

  const pathStr = linePath(points, width, height);

  return (
    <>
      <svg
        data-testid="chart-savings"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Token savings over time"
        style={{
          display: "block",
          width: "100%",
          height: "auto",
        }}
      >
        <path
          data-testid="chart-line"
          d={pathStr}
          fill="none"
          stroke="var(--chart-2)"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={
            motionSafe
              ? {
                  strokeDasharray: 1,
                  animation: `mg-chart-draw ${DURATION.slow}s ${EASE_HOUSE_CSS} forwards`,
                }
              : {}
          }
        />
        {points.map((point, i) => (
          <circle
            key={i}
            data-testid="chart-point"
            data-index={i}
            data-dimmed={hoveredIndex !== null && hoveredIndex !== i ? "true" : "false"}
            cx={linePath([point], width, height).split(" ")[1]}
            cy={linePath([point], width, height).split(" ")[2]}
            r="4"
            fill="var(--chart-2)"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            style={{ cursor: "pointer" }}
          />
        ))}
      </svg>
      <div
        data-testid="chart-scrub"
        data-visible={hoveredIndex !== null ? "true" : "false"}
        data-index={String(hoveredIndex ?? "")}
      >
        {hoveredIndex !== null
          ? `Point ${hoveredIndex}: ${Math.round(points[hoveredIndex].y)} tokens`
          : null}
      </div>
    </>
  );
}
