/** Human label for an inferred experience range. */
export function expLabel(
  min: number | null,
  max: number | null,
): string | null {
  if (min === null) return null;
  if (max === null) return `${min}+ yrs`;
  if (min === max) return `${min} yrs`;
  return `${min}–${max} yrs`;
}
