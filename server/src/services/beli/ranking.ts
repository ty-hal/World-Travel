import type { BeliBusiness, BeliSnapshot } from './client';
import type { BeliCategory, BeliSuggestion } from '@trek/shared';

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((a.lat - b.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((a.lng - b.lng) * rad) / 2) ** 2;
  return 12742.0176 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
}

export function rankSuggestions(
  data: BeliSnapshot,
  businesses: BeliBusiness[],
  category: BeliCategory,
  origin: { lat: number; lng: number },
  radius: number,
) {
  const visited = new Set(data.ratings.map((r) => r.business.id));
  const visitedPlaces = new Set(data.ratings.map((r) => r.business.place_id).filter(Boolean));
  const rated = data.ratings.filter((r) => r.category === category);
  const groups = new Map<string, { count: number; sum: number; high: number }>();
  const positions = new Map<number, { sum: number; count: number }>();
  rated
    .map((r) => r.score)
    .sort((a, b) => a - b)
    .forEach((score, index) => {
      const position = positions.get(score) ?? { sum: 0, count: 0 };
      position.sum += index;
      position.count++;
      positions.set(score, position);
    });
  for (const row of rated) {
    const position = positions.get(row.score)!;
    const percentile = position.sum / position.count / Math.max(1, rated.length - 1);
    for (const cuisine of new Set(row.business.cuisines ?? [])) {
      const group = groups.get(cuisine) ?? { count: 0, sum: 0, high: 0 };
      group.count++;
      group.sum += row.score;
      group.high += percentile;
      groups.set(cuisine, group);
    }
  }
  const prediction = new Map<number, number | null>();
  for (const p of data.predictions) {
    if (!Number.isFinite(p.expected_percentile)) continue;
    prediction.set(
      p.business_id,
      prediction.has(p.business_id) && prediction.get(p.business_id) !== p.expected_percentile
        ? null
        : p.expected_percentile,
    );
  }
  const unique = new Map<string | number, BeliBusiness[]>();
  for (const b of businesses) {
    const key = b.place_id || b.id;
    unique.set(key, [...(unique.get(key) ?? []), b]);
  }
  const suggestions: BeliSuggestion[] = [];
  for (const aliases of unique.values()) {
    const b = aliases[0];
    if (
      aliases.some(
        (a) =>
          visited.has(a.id) ||
          (a.place_id && visitedPlaces.has(a.place_id)) ||
          ['CLOSED_PERMANENTLY', 'CLOSED_TEMPORARILY'].includes(a.status ?? ''),
      )
    )
      continue;
    if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) continue;
    const distance = distanceKm(origin, { lat: b.lat!, lng: b.lng! });
    if (distance > radius) continue;
    const values = [
      ...new Set(
        aliases.flatMap((a) => (typeof prediction.get(a.id) === 'number' ? [prediction.get(a.id) as number] : [])),
      ),
    ];
    const conflict = values.length > 1 || aliases.some((a) => prediction.has(a.id) && prediction.get(a.id) === null);
    const value = !conflict && values.length === 1 ? values[0] : null;
    const fit = (b.cuisines ?? [])
      .map((cuisine) => ({ cuisine, ...groups.get(cuisine) }))
      .filter(
        (g): g is { cuisine: string; count: number; sum: number; high: number } =>
          (g.count ?? 0) >= 3 && g.high! / g.count! >= 0.6,
      )
      .sort((a, b) => b.count - a.count)[0];
    const bookmarked = aliases.some((a) => data.bookmarks.includes(a.id));
    const history = !!fit || bookmarked;
    const reasons = [];
    if (fit)
      reasons.push(
        `${fit.count} ${category} ratings tagged ${fit.cuisine}, averaging ${(fit.sum / fit.count).toFixed(1)}/10`,
      );
    if (bookmarked) reasons.push('On your Beli want-to-try list');
    if (value !== null) reasons.push('Beli personalized prediction available');
    if (!history) reasons.push('Limited historical preference evidence');
    if (conflict) reasons.push('Conflicting duplicate predictions; left unscored');
    suggestions.push({
      id: b.id,
      name: b.name,
      lat: b.lat,
      lng: b.lng,
      placeId: b.place_id || null,
      cuisines: b.cuisines ?? [],
      price: b.price ?? null,
      distanceKm: Math.round(distance * 1000) / 1000,
      prediction: value,
      evidence: history ? (value !== null ? 'both' : 'history') : value !== null ? 'beli' : 'nearby',
      reasons,
      historyMatches: fit?.count ?? 0,
      statusVerified: b.status === 'OPERATIONAL',
    });
  }
  const priority = { both: 0, history: 1, beli: 2, nearby: 3 };
  // shortcut: transparent evidence groups instead of learned weights until prospective feedback validates a model.
  suggestions.sort(
    (a, b) =>
      priority[a.evidence] - priority[b.evidence] ||
      (a.prediction !== null && b.prediction !== null ? b.prediction - a.prediction : 0) ||
      a.distanceKm - b.distanceKm ||
      a.id - b.id,
  );
  const chosen = suggestions.slice(0, 30);
  // Keep missing predictions visible even when there are many scored candidates.
  for (const item of suggestions.filter((s) => s.prediction === null).slice(0, 5)) {
    if (!chosen.includes(item)) chosen.push(item);
  }
  return {
    total: suggestions.length,
    scored: suggestions.filter((s) => s.prediction !== null).length,
    suggestions: chosen,
  };
}
