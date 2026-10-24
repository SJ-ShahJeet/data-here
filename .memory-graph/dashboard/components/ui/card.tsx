"use client";

export type CardSeverity = "good" | "warning" | "critical" | "neutral";

export function severityBoxShadow(severity: CardSeverity): string {
  switch (severity) {
    case "good":
      return "inset 0 0 0 1px var(--severity-good)";
    case "warning":
      return "inset 0 0 0 1px var(--severity-warn)";
    case "critical":
      return "inset 0 0 0 1px var(--severity-bad)";
    default:
      return "inset 0 0 0 1px var(--severity-idle)";
  }
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  severity?: CardSeverity;
}

export function Card({ severity = "neutral", style, ...rest }: CardProps): React.JSX.Element {
  return (
    <div
      data-testid="card"
      data-severity={severity}
      style={{ boxShadow: severityBoxShadow(severity), ...style }}
      {...rest}
    />
  );
}
