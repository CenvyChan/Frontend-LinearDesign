import { describe, expect, it } from 'vitest';

import { mergeSelectedBomVersions, mergeSelectedMaterials } from './bom-expand-selection';

describe('bom expand selection helpers', () => {
  it('reopens material dialog with confirmed selections preserved', () => {
    const merged = mergeSelectedMaterials(
      [{ number: 'M-001', name: 'A', specification: 'S1' }],
      [{ number: 'M-002', name: 'B', specification: 'S2' }],
    );

    expect(merged.map((item) => item.number)).toEqual(['M-001', 'M-002']);
  });

  it('deduplicates bom selections by bomNumber', () => {
    const merged = mergeSelectedBomVersions(
      [{ bomNumber: 'BOM-01', materialNumber: 'M-01', materialName: 'A', specification: 'S1' }],
      [
        { bomNumber: 'BOM-01', materialNumber: 'M-01', materialName: 'A-new', specification: 'S1' },
        { bomNumber: 'BOM-02', materialNumber: 'M-02', materialName: 'B', specification: 'S2' },
      ],
    );

    expect(merged.map((item) => item.bomNumber)).toEqual(['BOM-01', 'BOM-02']);
  });
});
