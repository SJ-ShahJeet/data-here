"use client";

import { useState, useEffect } from "react";
import { useMotionSafe } from "@/hooks/useMotionSafe";
import { DURATION, SHIMMER_RUNS } from "@/lib/motion-tokens";

export interface GradientShimmerProps {
  children: React.ReactNode;
  runs?: number;
  durationSec?: number;
  className?: string;
}

export function GradientShimmer(props: GradientShimmerProps): React.JSX.Element {
  const runs = props.runs ?? SHIMMER_RUNS;
  const durationSec = props.durationSec ?? DURATION.slow;
  const motionSafe = useMotionSafe();

  const [shimmering, setShimmering] = useState(false);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!motionSafe || runs <= 0) {
      setShimmering(false);
      setRemaining(0);
      return;
    }

    let currentTimeoutId: ReturnType<typeof setTimeout> | undefined;

    setRemaining(runs);
    setShimmering(true);

    const scheduleNext = (runsLeft: number) => {
      currentTimeoutId = setTimeout(() => {
        const nextRuns = runsLeft - 1;
        if (nextRuns <= 0) {
          setShimmering(false);
          setRemaining(0);
        } else {
          setRemaining(nextRuns);
          scheduleNext(nextRuns);
        }
      }, durationSec * 1000);
    };

    scheduleNext(runs);

    return () => {
      if (currentTimeoutId !== undefined) {
        clearTimeout(currentTimeoutId);
      }
    };
  }, [motionSafe, runs, durationSec]);

  return (
    <span
      data-testid="gradient-shimmer"
      data-shimmering={shimmering ? "true" : "false"}
      data-runs-remaining={String(remaining)}
      className={props.className}
    >
      {props.children}
    </span>
  );
}
