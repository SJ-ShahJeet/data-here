"use client";
import type { CSSProperties } from "react";
import type { Rect } from "@/lib/v2/logic";
import { tourCardPosition } from "@/lib/v2/logic";
import type { TourStep } from "@/lib/v2/types";

interface TourProps {
  open: boolean;
  step: number;
  steps: TourStep[];
  rect: Rect | null;
  onGo: (i: number) => void;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}

export function Tour({ open, step, steps, rect, onGo, onBack, onNext, onSkip }: TourProps) {
  if (!open) return null;
  const st = steps[step] ?? steps[0];
  const last = step === steps.length - 1;

  const pos =
    typeof window === "undefined" ? null : tourCardPosition(rect, window.innerWidth, window.innerHeight);
  const cardStyle: CSSProperties | undefined = pos
    ? { top: pos.top, left: pos.left, width: pos.width }
    : undefined;
  const ringStyle: CSSProperties | undefined = rect
    ? { top: rect.t - 5, left: rect.l - 5, width: rect.w + 10, height: rect.h + 10 }
    : undefined;

  return (
    <div className="mg-tour" data-testid="mg-tour">
      {rect ? <div className="mg-tour__ring" style={ringStyle} /> : <div className="mg-tour__dim" />}
      <div className={`mg-tour__card${pos ? "" : " mg-tour__card--centre"}`} style={cardStyle}>
        <div className="mg-tour__head">
          <span className="mg-tour__eyebrow">GUIDED DEMO</span>
          <span className="mg-tour__count">
            {step + 1} / {steps.length}
          </span>
        </div>
        <div className="mg-tour__title">{st.title}</div>
        <p className="mg-tour__body">{st.body}</p>
        <div className="mg-tour__foot">
          <div className="mg-tour__dots">
            {steps.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Step ${i + 1}`}
                className={`mg-tour__dot${i === step ? " mg-tour__dot--now" : i < step ? " mg-tour__dot--done" : ""}`}
                onClick={() => onGo(i)}
              />
            ))}
          </div>
          <div className="mg-tour__actions">
            <button type="button" className="mg-link" onClick={onSkip}>
              Skip
            </button>
            <button type="button" className={`mg-ghost${step === 0 ? " mg-ghost--off" : ""}`} onClick={onBack}>
              Back
            </button>
            <button type="button" className="mg-tour__next" onClick={onNext}>
              {last ? "Start exploring" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
