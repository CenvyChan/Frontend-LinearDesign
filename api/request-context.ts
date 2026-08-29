function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveErpAcctCode(explicit: unknown, current: unknown): string | undefined {
  return normalize(explicit) || normalize(current) || undefined;
}
