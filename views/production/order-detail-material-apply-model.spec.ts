import { describe, expect, it } from 'vitest';

import {
  buildApplySplit,
  isIntegerUnit,
  isOneDecimalUnit,
  normalizeQtyByUnit,
} from './order-detail-material-apply-model';

describe('order detail material apply model', () => {
  it('matches configured unit policies case-insensitively', () => {
    expect(isIntegerUnit('pcs', 'PCS,个,件')).toBe(true);
    expect(isIntegerUnit('PCS', 'pcs,个,件')).toBe(true);
    expect(isIntegerUnit('个', 'pcs,个,件')).toBe(true);
    expect(isIntegerUnit('KG', 'pcs,个,件')).toBe(false);
    expect(isOneDecimalUnit('kg', 'KG,千克')).toBe(true);
    expect(isOneDecimalUnit('KG', 'kg,千克')).toBe(true);
    expect(isOneDecimalUnit('千克', 'kg,千克')).toBe(true);
  });

  it('normalizes quantities by unit policy', () => {
    expect(normalizeQtyByUnit(6.230435, 'pcs', 'PCS,个', 'KG,千克')).toBe(7);
    expect(normalizeQtyByUnit(6.230435, 'KG', 'PCS,个', 'KG,千克')).toBe(6.2);
    expect(normalizeQtyByUnit(6.25, '千克', 'PCS,个', 'KG,千克')).toBe(6.3);
    expect(normalizeQtyByUnit(6.230435, '米', 'PCS,个', 'KG,千克')).toBe(6.230435);
    expect(normalizeQtyByUnit(0, 'pcs', 'PCS,个', 'KG,千克')).toBe(0);
  });

  it('splits overflow quantity from raw erp formula minus mes preparing quantity', () => {
    const split = buildApplySplit(
      {
        baseUnitNumber: 'PCS',
        consumVolatility: 2.5,
        goodReturnQty: 1,
        incDefectReturnQty: 0.5,
        mustQty: 10.2,
        pbomEntryId: 10,
        returnQty: 0.2,
        selectedPickedQty: 4.1,
      },
      9.2,
      2.6,
      'PCS,个',
      'KG,千克',
    );

    expect(split).toMatchObject({
      allowedPickQty: 5,
      feedQty: 5,
      integerUnit: true,
      normalizedRequestQty: 10,
      pickQty: 5,
    });
  });
});
