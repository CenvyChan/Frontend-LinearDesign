import type { BomVersionItem, MaterialItem } from '#/api/bom';

export function mergeSelectedMaterials(
  confirmed: MaterialItem[],
  current: MaterialItem[],
): MaterialItem[] {
  const merged = new Map<string, MaterialItem>();
  for (const item of confirmed) {
    if (item?.number) {
      merged.set(item.number, item);
    }
  }
  for (const item of current) {
    if (item?.number) {
      merged.set(item.number, item);
    }
  }
  return [...merged.values()];
}

export function mergeSelectedBomVersions(
  confirmed: BomVersionItem[],
  current: BomVersionItem[],
): BomVersionItem[] {
  const merged = new Map<string, BomVersionItem>();
  for (const item of confirmed) {
    if (item?.bomNumber) {
      merged.set(item.bomNumber, item);
    }
  }
  for (const item of current) {
    if (item?.bomNumber) {
      merged.set(item.bomNumber, item);
    }
  }
  return [...merged.values()];
}
