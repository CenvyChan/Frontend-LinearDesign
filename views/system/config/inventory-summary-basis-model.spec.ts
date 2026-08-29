import { describe, expect, it } from 'vitest';

import {
  applyInventorySummaryBasisBatch,
  buildInventorySummaryBasisPayload,
  inventoryAvailabilityToAllocation,
  inventoryAvailabilityToSubmitFields,
  inventoryAvailabilityToWarehouse,
} from './inventory-summary-basis-model';

describe('inventory summary basis model', () => {
  it('builds a basis save payload with enabled warehouse rows', () => {
    const payload = buildInventorySummaryBasisPayload('FNS', '001', [
      {
        enabled: true,
        sourceUseOrgName: 'Org 001',
        sourceUseOrgNumber: '001',
        warehouseName: 'Main',
        warehouseNumber: 'CK-01',
        warehouseType: 'WORKSHOP',
      },
      {
        enabled: false,
        sourceUseOrgNumber: '002',
        warehouseNumber: 'CK-02',
      },
    ]);

    expect(payload).toEqual({
      demandOrgNumber: '001',
      erpAcctCode: 'FNS',
      items: [
        {
          enabled: true,
          remark: undefined,
          sourceUseOrgName: 'Org 001',
          sourceUseOrgNumber: '001',
          warehouseName: 'Main',
          warehouseNumber: 'CK-01',
          warehouseType: 'WORKSHOP',
        },
        {
          enabled: false,
          remark: undefined,
          sourceUseOrgName: undefined,
          sourceUseOrgNumber: '002',
          warehouseName: undefined,
          warehouseNumber: 'CK-02',
          warehouseType: 'PHYSICAL',
        },
      ],
    });
  });

  it('maps an inventory candidate to allocation and warehouse selection fields', () => {
    const row = {
      availableQty: 8,
      expiryDate: '2026-12-31',
      keeperName: 'Keeper',
      keeperNumber: 'K01',
      lotNo: 'LOT-1',
      produceDate: '2026-01-01',
      stockLoc: 'A-01',
      stockStatusName: 'Available',
      stockStatusNumber: 'KCZT01',
      warehouseName: 'Main',
      warehouseNumber: 'CK-01',
    };

    expect(inventoryAvailabilityToAllocation(row, 3)).toMatchObject({
      expiryDate: '2026-12-31',
      keeperName: 'Keeper',
      keeperNumber: 'K01',
      lotNo: 'LOT-1',
      produceDate: '2026-01-01',
      qty: 3,
      stockLoc: 'A-01',
      stockName: 'Main',
      stockNumber: 'CK-01',
      stockStatusName: 'Available',
      stockStatusNumber: 'KCZT01',
    });
    expect(inventoryAvailabilityToWarehouse(row)).toEqual({
      warehouseName: 'Main',
      warehouseNumber: 'CK-01',
    });
    expect(inventoryAvailabilityToSubmitFields(row)).toEqual({
      lotNo: 'LOT-1',
      stockLoc: 'A-01',
      stockName: 'Main',
      stockNumber: 'CK-01',
      stockStatusName: 'Available',
      stockStatusNumber: 'KCZT01',
    });
  });

  it('batch updates selected warehouse inclusion and type', () => {
    const items = [
      {
        enabled: false,
        warehouseNumber: 'CK-01',
        warehouseType: 'PHYSICAL',
      },
      {
        enabled: false,
        warehouseNumber: 'CK-02',
        warehouseType: 'PHYSICAL',
      },
      {
        enabled: true,
        warehouseNumber: 'CK-03',
        warehouseType: 'WORKSHOP',
      },
    ];

    const updated = applyInventorySummaryBasisBatch(items, ['CK-01', 'CK-02'], {
      enabled: true,
      warehouseType: 'WORKSHOP',
    });

    expect(updated).toEqual([
      {
        enabled: true,
        warehouseNumber: 'CK-01',
        warehouseType: 'WORKSHOP',
      },
      {
        enabled: true,
        warehouseNumber: 'CK-02',
        warehouseType: 'WORKSHOP',
      },
      {
        enabled: true,
        warehouseNumber: 'CK-03',
        warehouseType: 'WORKSHOP',
      },
    ]);
  });
});
