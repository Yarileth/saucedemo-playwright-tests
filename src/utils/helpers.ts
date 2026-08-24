/** Convierte un precio con formato "$29.99" (o "Item total: $39.98") a número. */
export function parsePrice(text: string): number {
  const match = text.match(/\$\s*([\d.,]+)/);
  if (!match) return Number.NaN;
  return Number.parseFloat(match[1].replace(/,/g, ''));
}

/** Redondea a 2 decimales, evitando artefactos de punto flotante. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isAscending(values: number[]): boolean {
  return values.every((v, i) => i === 0 || values[i - 1] <= v);
}

export function isDescending(values: number[]): boolean {
  return values.every((v, i) => i === 0 || values[i - 1] >= v);
}

export function isSortedAlphaAsc(values: string[]): boolean {
  return values.every(
    (v, i) => i === 0 || values[i - 1].localeCompare(v, 'en', { sensitivity: 'base' }) <= 0
  );
}

export function isSortedAlphaDesc(values: string[]): boolean {
  return values.every(
    (v, i) => i === 0 || values[i - 1].localeCompare(v, 'en', { sensitivity: 'base' }) >= 0
  );
}
