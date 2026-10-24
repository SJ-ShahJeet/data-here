import { linePath } from "@/lib/charts/series";

export interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
}

export function Sparkline(props: SparklineProps): React.JSX.Element {
  const width = props.width ?? 72;
  const height = props.height ?? 20;

  if (props.values.length < 2) {
    return <svg data-testid="sparkline" data-empty="true" width={width} height={height} />;
  }

  const points = props.values.map((v, i) => ({ x: i, y: v }));
  const pathStr = linePath(points, width, height, 2);

  return (
    <svg
      data-testid="sparkline"
      data-empty="false"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <path data-testid="sparkline-path" d={pathStr} fill="none" stroke="var(--chart-3)" />
    </svg>
  );
}
