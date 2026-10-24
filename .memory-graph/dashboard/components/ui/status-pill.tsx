import type { Severity } from "@/lib/tiles";

const ICON_PATHS: Record<Severity, string> = {
  good: "M8.5 12.3l2.3 2.3 4.7-5.4",
  warning: "M12 8.2v4.6M12 15.6h.01",
  critical: "M9.3 9.3l5.4 5.4M14.7 9.3l-5.4 5.4",
  neutral: "M8.5 12h7",
};

export function StatusPill({
  severity,
  children,
}: {
  severity: Severity;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <span className={`tag pill-${severity}`} data-severity={severity}>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        aria-hidden="true"
      >
        <path d={ICON_PATHS[severity]} />
        <circle cx="12" cy="12" r="8.5" />
      </svg>
      {children}
    </span>
  );
}
