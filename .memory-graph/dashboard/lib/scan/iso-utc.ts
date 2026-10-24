export function isoUtc(msEpoch: number): string {
  return new Date(msEpoch).toISOString().replace(/\.\d{3}Z$/, "Z");
}
