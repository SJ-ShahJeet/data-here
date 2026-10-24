"use client";

import { useState, useEffect, useRef } from "react";
import { useMotionSafe } from "@/hooks/useMotionSafe";
import { DURATION, EASE_HOUSE } from "@/lib/motion-tokens";

export interface CountUpProps {
  value: number;
  animate: boolean;
  durationSec?: number;
}

export function CountUp(props: CountUpProps): React.JSX.Element {
  const durationSec = props.durationSec ?? DURATION.base;
  const motionSafe = useMotionSafe();
  const [displayed, setDisplayed] = useState(String(props.value));
  const prevValueRef = useRef(props.value);

  useEffect(() => {
    if (!props.animate || !motionSafe) {
      setDisplayed(String(props.value));
      prevValueRef.current = props.value;
      return;
    }

    const startValue = prevValueRef.current;
    const endValue = props.value;
    const startTime = Date.now();
    const durationMs = durationSec * 1000;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= durationMs) {
        setDisplayed(String(endValue));
        prevValueRef.current = endValue;
        return;
      }

      // Normalize elapsed to 0-1
      const t = elapsed / durationMs;

      // Apply easing (EASE_HOUSE)
      const [x1, y1, x2, y2] = EASE_HOUSE;
      const eased = cubicBezier(t, x1, y1, x2, y2);

      const current = startValue + (endValue - startValue) * eased;
      setDisplayed(String(Math.round(current)));

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [props.value, props.animate, motionSafe, durationSec]);

  return (
    <span data-testid="count-up" data-animate={props.animate ? "true" : "false"} data-value={String(props.value)}>
      {displayed}
    </span>
  );
}

// Cubic bezier easing function
function cubicBezier(t: number, x1: number, y1: number, x2: number, y2: number): number {
  // Solve for y at given t using Newton's method
  let x = t;
  for (let i = 0; i < 8; i++) {
    const dx = derivative(x, x1, x2) || 1;
    x = x - (sample(x, x1, x2) - t) / dx;
  }

  return sample(x, y1, y2);
}

function sample(t: number, a1: number, a2: number): number {
  return 3 * a1 * (1 - t) * (1 - t) * t + 3 * a2 * (1 - t) * t * t + t * t * t;
}

function derivative(t: number, a1: number, a2: number): number {
  const mt = 1 - t;
  return 3 * a1 * (mt * mt - 2 * mt * t) + 3 * a2 * (t * t - 2 * mt * t) + 3 * t * t;
}
