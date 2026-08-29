import type {
  WmsInventoryMovePayload,
  WmsReconcileAdjustPayload,
  WmsReconcileLine,
  WmsReconcileQuery,
} from '#/api/wms';

export type WmsManualSyncActionKey = 'REFRESH_ERP_SNAPSHOT' | 'SYNC_TO_WMS_UNALLOCATED';

export interface WmsManualSyncAction {
  description: string;
  key: WmsManualSyncActionKey;
  title: string;
}

export interface WmsReconcileRowActions {
  canAdjustFromErp: boolean;
  canMoveUnallocated: boolean;
  canSyncFromErp: boolean;
  canTrace: boolean;
}

export interface WmsMoveFormState {
  qty?: number;
  remark?: string;
  toLocationCode?: string;
  toLocationName?: string;
}

export interface WmsAdjustFormState {
  reason: string;
}

export const WMS_MANUAL_SYNC_ACTIONS: WmsManualSyncAction[] = [
  {
    description: '仅刷新ERP即时库存快照，用于对账判断，不写入WMS库存。',
    key: 'REFRESH_ERP_SNAPSHOT',
    title: 'ERP库存快照刷新',
  },
  {
    description: '将ERP有而WMS无的库存拉取到WMS未分配库位，后续需人工上架。',
    key: 'SYNC_TO_WMS_UNALLOCATED',
    title: 'ERP库存拉取到WMS',
  },
];

export function getWmsReconcileRowActions(line: WmsReconcileLine): WmsReconcileRowActions {
  return {
    // QTY_DIFF/WMS_ONLY 是"双方都有记录但数量对不上"的场景，syncFromErp 只补全新组合，
    // 对这两种状态无效，需要单独的覆盖调整入口。RECENT_MOVEMENT_RISK 故意不给按钮：
    // 分类器把它判为"24小时内有流水，可能是正常在途"，先人工复核再决定要不要调整。
    canAdjustFromErp: line.reconcileStatus === 'QTY_DIFF' || line.reconcileStatus === 'WMS_ONLY',
    canMoveUnallocated: line.reconcileStatus === 'UNALLOCATED_ONLY' && Number(line.wmsUnallocatedQty || 0) > 0,
    canSyncFromErp: line.reconcileStatus === 'ERP_ONLY',
    canTrace: true,
  };
}

export function buildWmsReconcileQueryPayload(
  query: WmsReconcileQuery,
  fallbackAcctCode?: string,
  forceRefreshErp?: boolean,
): WmsReconcileQuery {
  const materialCode = optional(query.materialCode);
  return compact({
    ...query,
    erpAcctCode: optional(query.erpAcctCode) || optional(fallbackAcctCode),
    erpOrgNumber: optional(query.erpOrgNumber),
    forceRefreshErp: forceRefreshErp ?? Boolean(query.forceRefreshErp),
    keeperNumber: optional(query.keeperNumber),
    lotNo: optional(query.lotNo),
    materialCode,
    materialNumber: materialCode,
    ownerNumber: optional(query.ownerNumber),
    stockNumber: optional(query.stockNumber),
    stockStatusNumber: optional(query.stockStatusNumber),
  });
}

export function buildWmsInventorySyncPayloadFromLine(
  line: WmsReconcileLine,
  fallbackAcctCode?: string,
): WmsReconcileQuery {
  return compact({
    erpAcctCode: optional(fallbackAcctCode),
    erpOrgNumber: required(line.erpOrgNumber, 'erpOrgNumber'),
    forceRefreshErp: true,
    keeperNumber: optional(line.keeperNumber),
    lotNo: optional(line.lotNo),
    materialCode: required(line.materialCode, 'materialCode'),
    ownerNumber: optional(line.ownerNumber),
    stockNumber: required(line.stockNumber, 'stockNumber'),
    stockStatusNumber: optional(line.stockStatusNumber),
  });
}

export function buildWmsAdjustPayloadFromLine(
  line: WmsReconcileLine,
  form: WmsAdjustFormState,
  fallbackAcctCode?: string,
  runId?: number,
): WmsReconcileAdjustPayload {
  return compact({
    erpAcctCode: optional(fallbackAcctCode),
    erpOrgNumber: required(line.erpOrgNumber, 'erpOrgNumber'),
    forceRefreshErp: true,
    keeperNumber: optional(line.keeperNumber),
    lotNo: optional(line.lotNo),
    materialCode: required(line.materialCode, 'materialCode'),
    ownerNumber: optional(line.ownerNumber),
    reason: required(form.reason, 'reason'),
    runId,
    stockNumber: required(line.stockNumber, 'stockNumber'),
    stockStatusNumber: optional(line.stockStatusNumber),
  }) as WmsReconcileAdjustPayload;
}

export function buildWmsMovePayloadFromLine(
  line: WmsReconcileLine,
  form: WmsMoveFormState,
): WmsInventoryMovePayload {
  return {
    businessSource: 'WMS_RECONCILE_MOVE',
    erpOrgName: line.erpOrgName,
    erpOrgNumber: required(line.erpOrgNumber, 'erpOrgNumber'),
    fromLocationCode: 'UNALLOCATED',
    fromLocationName: '未分配库位',
    keeperName: line.keeperName,
    keeperNumber: line.keeperNumber,
    lotNo: line.lotNo,
    materialCode: required(line.materialCode, 'materialCode'),
    materialName: line.materialName,
    materialSpecification: line.materialSpecification,
    ownerName: line.ownerName,
    ownerNumber: line.ownerNumber,
    qty: positive(form.qty, 'qty'),
    remark: form.remark,
    stockName: line.stockName,
    stockNumber: required(line.stockNumber, 'stockNumber'),
    stockStatusName: line.stockStatusName,
    stockStatusNumber: line.stockStatusNumber,
    toLocationCode: required(form.toLocationCode, 'toLocationCode'),
    toLocationName: form.toLocationName,
    unitName: line.unitName,
  };
}

function positive(value: unknown, field: string): number {
  const numberValue = Number(value ?? 0);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new Error(`${field} must be greater than 0`);
  }
  return numberValue;
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T;
}

function optional(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text.length > 0 ? text : undefined;
}

function required(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}
