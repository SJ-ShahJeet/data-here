"use client";

import { useState } from "react";
import type { Sessions } from "@/lib/scan/sessions";
import { cadenceSeries, linePath } from "@/lib/charts/series";
import { useMotionSafe } from "@/hooks/useMotionSafe";
import { DURATION, EASE_HOUSE_CSS } from "@/lib/motion-tokens";

export interface SessionCadenceProps {
  data: Sessions;
  width?: number;
  height?: number;
}

export function SessionCadence(props: SessionCadenceProps): React.JSX.Element {
  const width = props.width ?? 640;
  const height = props.height ?? 200;
  const points = cadenceSeries(props.data);
  const motionSafe = useMotionSafe();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (points.length === 0) {
    return <p data-testid="chart-empty">No sessions recorded yet</p>;
  }

  const pathStr = linePath(points, width, height);

  return (
    <>
      <svg
        data-testid="chart-cadence"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Sessions per day"
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
          stroke="var(--chart-4)"
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
            fill="var(--chart-4)"
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
        {hoveredIndex !== null ? `${points[hoveredIndex].y} sessions` : null}
      </div>
    </>
  );
}
