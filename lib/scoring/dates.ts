// Fractional months exactly as fixtures/score_reference.py computes them, so rule boundaries
// (12, 18, 24, 36 months) agree with the reference on every fixture.
export function monthsBetween(isoDate: string, now: Date): number {
  const [year, month, day] = isoDate.split("-").map(Number) as [number, number, number];
  return (
    (now.getUTCFullYear() - year) * 12 +
    (now.getUTCMonth() + 1 - month) +
    (now.getUTCDate() - day) / 31
  );
}
