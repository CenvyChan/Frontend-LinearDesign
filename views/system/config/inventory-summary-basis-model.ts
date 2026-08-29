import type {
  InventoryAvailabilityRow,
  InventorySummaryBasisItem,
  InventorySummaryBasisSavePayload,
} from '#/api/config';

import type { PickTaskAllocationItem } from '#/api/production';

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function warehouseType(value: unknown): 'PHYSICAL' | 'WORKSHOP' {
  return value === 'WORKSHOP' ? 'WORKSHOP' : 'PHYSICAL';
}

export interface InventorySummaryBasisBatchPatch {
  enabled?: boolean;
  warehouseType?: 'PHYSICAL' | 'WORKSHOP';
}

export function applyInventorySummaryBasisBatch(
  items: InventorySummaryBasisItem[] = [],
  selectedWarehouseNumbers: string[] = [],
  patch: InventorySummaryBasisBatchPatch,
): InventorySummaryBasisItem[] {
  const selected = new Set(selectedWarehouseNumbers.map((item) => item.trim()).filter(Boolean));
  return items.map((item) => {
    if (!item.warehouseNumber || !selected.has(item.warehouseNumber)) {
      return item;
    }
    return {
      ...item,
      enabled: patch.enabled ?? item.enabled,
      warehouseType: patch.warehouseType ?? warehouseType(item.warehouseType),
    };
  });
}

export function buildInventorySummaryBasisPayload(
  erpAcctCode: string,
  demandOrgNumber: string,
  items: InventorySummaryBasisItem[] = [],
): InventorySummaryBasisSavePayload {
  return {
    demandOrgNumber: demandOrgNumber.trim(),
    erpAcctCode: erpAcctCode.trim(),
    items: items
      .filter((item) => text(item.sourceUseOrgNumber) && text(item.warehouseNumber))
      .map((item) => ({
        enabled: item.enabled,
        remark: text(item.remark),
        sourceUseOrgName: text(item.sourceUseOrgName),
        sourceUseOrgNumber: text(item.sourceUseOrgNumber),
        warehouseName: text(item.warehouseName),
        warehouseNumber: text(item.warehouseNumber),
        warehouseType: warehouseType(item.warehouseType),
      })),
  };
}

export function inventoryAvailabilityToAllocation(
  row: InventoryAvailabilityRow,
  qty: number,
): PickTaskAllocationItem {
  return {
    expiryDate: row.expiryDate,
    keeperName: row.keeperName,
    keeperNumber: row.keeperNumber,
    lotNo: row.lotNo,
    produceDate: row.produceDate,
    qty,
    stockLoc: row.stockLoc,
    stockName: row.warehouseName,
    stockNumber: row.warehouseNumber,
    stockStatusName: row.stockStatusName,
    stockStatusNumber: row.stockStatusNumber,
  };
}

export function inventoryAvailabilityToWarehouse(row: InventoryAvailabilityRow) {
  return {
    warehouseName: row.warehouseName,
    warehouseNumber: row.warehouseNumber,
  };
}

export function inventoryAvailabilityToSubmitFields(row: InventoryAvailabilityRow) {
  return {
    lotNo: row.lotNo,
    stockLoc: row.stockLoc,
    stockName: row.warehouseName,
    stockNumber: row.warehouseNumber,
    stockStatusName: row.stockStatusName,
    stockStatusNumber: row.stockStatusNumber,
  };
}
