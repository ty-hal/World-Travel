/**
 * Muted two-stop cover gradients — the fallback backdrop for any entity that
 * has no photo yet (a trip, a saved place). Picked by a stable numeric id so a
 * given entity always keeps the same colour. Tuned for dashboard/collections:
 * desaturated enough to sit on dark UI without neon glare.
 */
export const GRADIENTS = [
  'linear-gradient(135deg, #5b6eae 0%, #6b5b95 100%)',
  'linear-gradient(135deg, #9b7bb8 0%, #b87d8a 100%)',
  'linear-gradient(135deg, #5a9eb8 0%, #6b8cae 100%)',
  'linear-gradient(135deg, #5a9a7a 0%, #6a9a8a 100%)',
  'linear-gradient(135deg, #b8906a 0%, #a88a6a 100%)',
  'linear-gradient(135deg, #8a8aae 0%, #a89ab8 100%)',
  'linear-gradient(135deg, #a89090 0%, #b8a8a0 100%)',
  'linear-gradient(135deg, #4a8a9a 0%, #5a6a8a 100%)',
] as const

/** Deterministic gradient for a numeric id (handles negatives defensively). */
export function entityGradient(id: number): string {
  const i = ((id % GRADIENTS.length) + GRADIENTS.length) % GRADIENTS.length
  return GRADIENTS[i]
}
