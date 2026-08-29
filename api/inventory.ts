import { postList, requestClient } from '#/api/request';

import type { InventoryAvailabilityByBasisQuery, InventoryAvailabilityRow } from '#/api/config';

export interface InventoryQueryParams {
  /** ERP account code */
  erpAcctCode?: string;
  /** ERP组织ID */
  erpOrgId?: string;
  /** 物料编码 */
  materialCode?: string;
  /** 物料编码列表（多选） */
  materialNumbers?: string[];
  /** 仓库编码（多个用逗号分隔） */
  stockNumber?: string;
  /** 仓库编码列表 */
  stockNumbers?: string[];
  /** 批次号 */
  lotNo?: string;
  /** 规格型号 */
  materialModel?: string;
  /** 页码 */
  pageIndex?: number;
  /** 每页数量 */
  pageSize?: number;
  /** 是否显示库位 */
  isShowStockLoc?: boolean;
}

/**
 * 库存数据项 - 使用K3Cloud原生字段名（带f前缀）
 */
export interface InventoryItem {
  // ========== 物料信息 ==========
  /** 物料ID */
  fmaterialId?: number;
  /** 物料编码 */
  fmaterialNumber?: string;
  /** 物料名称 */
  fmaterialName?: string;
  /** 规格型号 */
  fmaterialModel?: string;

  // ========== 仓库信息 ==========
  /** 仓库ID */
  fstockId?: number;
  /** 仓库编码 */
  fstockNumber?: string;
  /** 仓库名称 */
  fstockName?: string;
  /** 库位ID */
  fstockLocId?: number;
  /** 库位 */
  fstockLoc?: string;

  // ========== 批次信息 ==========
  /** 批次ID */
  flot?: number;
  /** 批次号 */
  flotNumber?: string;

  // ========== 数量信息 ==========
  /** 库存单位ID */
  fstockUnitId?: number;
  /** 基本单位ID */
  fbaseUnitId?: number;
  /** 基本单位编码 */
  fbaseUnitNumber?: string;
  /** 基本单位名称 */
  fbaseUnitName?: string;
  /** 基本单位数量 */
  fbaseQty?: number;
  /** 基本单位锁定数量 */
  fbaseLockQty?: number;
  /** 即时库存数量 */
  fqty?: number;
  /** 可用库存数量 */
  favbQty?: number;
  /** 锁定库存数量 */
  flockQty?: number;

  // ========== 别名（兼容旧字段） ==========
  /** 物料编码（别名） */
  materialCode?: string;
  /** 物料名称（别名） */
  materialName?: string;
  /** 规格型号（别名） */
  materialModel?: string;
  /** 仓库名称（别名） */
  stockName?: string;
  /** 仓库编码（别名） */
  stockNumber?: string;
  /** 库位（别名） */
  stockLoc?: string;
  /** 批次号（别名） */
  lotNo?: string;
  /** 库存数量（别名） */
  qty?: number;
  /** 可用数量（别名） */
  availableQty?: number;
  /** 锁定数量（别名） */
  lockQty?: number;
  /** 单位（别名） */
  unit?: string;
  /** 规格型号（别名） */
  specification?: string;
  /** 基本单位 */
  baseUnit?: string;
}

// ========== 辅助函数 ==========

/**
 * 获取有效的物料编码（优先使用f开头的字段）
 */
export function getMaterialCode(item: InventoryItem): string {
  return item.fmaterialNumber || item.materialCode || '';
}

/**
 * 获取物料名称
 */
export function getMaterialName(item: InventoryItem): string {
  return item.fmaterialName || item.materialName || '';
}

/**
 * 获取规格型号
 */
export function getMaterialModel(item: InventoryItem): string {
  return item.fmaterialModel || item.materialModel || item.specification || '';
}

/**
 * 获取仓库编码
 */
export function getStockNumber(item: InventoryItem): string {
  return item.fstockNumber || item.stockNumber || '';
}

/**
 * 获取仓库名称
 */
export function getStockName(item: InventoryItem): string {
  return item.fstockName || item.stockName || '';
}

/**
 * 获取库位
 */
export function getStockLoc(item: InventoryItem): string {
  return item.fstockLoc || item.stockLoc || '';
}

/**
 * 获取批次号
 */
export function getLotNo(item: InventoryItem): string {
  return item.flotNumber || item.lotNo || '';
}

/**
 * 获取单位
 */
export function getUnit(item: InventoryItem): string {
  return item.fbaseUnitName || item.baseUnit || item.unit || '';
}

/**
 * 获取库存数量
 */
export function getQty(item: InventoryItem): number {
  return item.fqty ?? item.qty ?? 0;
}

/**
 * 获取可用数量
 */
export function getAvailableQty(item: InventoryItem): number {
  return item.favbQty ?? item.availableQty ?? 0;
}

/**
 * 获取锁定数量
 */
export function getLockQty(item: InventoryItem): number {
  return item.flockQty ?? item.lockQty ?? 0;
}

// ========== API 函数 ==========

/**
 * 查询库存
 */
export async function queryInventory(params: InventoryQueryParams) {
  return postList<InventoryItem>('/inventory/query', params);
}

export async function queryInventoryAvailableByBasis(params: InventoryAvailabilityByBasisQuery) {
  return requestClient.post<{
    configured: boolean;
    data: InventoryAvailabilityRow[];
    message?: string;
    success: boolean;
    total: number;
  }>('/inventory/available-by-basis', params, { responseReturn: 'body' });
}

export async function exportInventoryExcel(params: InventoryQueryParams) {
  return requestClient.post<Blob>('/inventory/export', params, {
    responseReturn: 'body',
    responseType: 'blob',
  });
}

/**
 * 从ERP刷新库存（强制跳过缓存）
 */
export async function refreshInventory(params: InventoryQueryParams) {
  return postList<InventoryItem>('/inventory/refresh', params);
}

export type ErpAuditExceptionStatus = 'IGNORED' | 'OPEN' | 'PROCESSING' | 'RESOLVED';

export type ErpAuditExceptionType =
  | 'ERP_CHANGED'
  | 'ERP_DELETED_OR_MISSING'
  | 'ERP_POLL_FAILED'
  | 'ERP_POLL_TIMEOUT_PERMANENT'
  | 'ERP_REJECTED'
  | 'ERP_REOPENED_OR_UNAUDITED'
  | 'ERP_TERMINATED'
  | 'ERP_WRITE_FAILED';

export interface ErpAuditException {
  afterSnapshotHash?: string;
  beforeSnapshotHash?: string;
  billId: string;
  billNo?: string;
  createdReason?: string;
  diffJson?: string;
  erpAcctCode: string;
  exceptionNo: string;
  exceptionStatus: ErpAuditExceptionStatus;
  exceptionType: ErpAuditExceptionType;
  formId: string;
  handleAction?: string;
  handledTime?: number;
  handlerId?: number;
  handlerName?: string;
  handleRemark?: string;
  lastRetryTime?: number;
  rawError?: string;
  retryCount?: number;
  sourceEntryId?: number;
  sourceEventId?: string;
  translatedError?: string;
  wmsTaskId?: number;
  wmsTaskNo?: string;
}

export interface ErpAuditExceptionHandlePayload {
  handleAction: string;
  handleRemark?: string;
  handlerId?: number;
  handlerName?: string;
}

export interface ErpAuditExceptionDetail {
  exception: ErpAuditException;
  operationLogs: Array<{
    operatedTime?: number;
    operationAction?: string;
    operationRemark?: string;
    operatorId?: number;
    operatorName?: string;
  }>;
  wmsDocument?: {
    billNo?: string;
    documentStatus?: string;
    erpSyncStatus?: string;
    lastError?: string;
    lastSyncTime?: number;
    snapshotJson?: string;
    wmsStatus?: string;
  };
}

export interface ErpAuditExceptionRecheckResult {
  checkedAt: number;
  erpStatus?: Record<string, unknown>;
  error?: string;
}

export async function getErpAuditExceptions(params?: { status?: ErpAuditExceptionStatus }) {
  return requestClient.get<ErpAuditException[]>('/erp-audit-exceptions', { params });
}

export async function handleErpAuditException(exceptionNo: string, payload: ErpAuditExceptionHandlePayload) {
  return requestClient.post<ErpAuditException>(
    `/erp-audit-exceptions/${encodeURIComponent(exceptionNo)}/handle`,
    payload,
  );
}

export const getErpAuditExceptionDetail = (exceptionNo: string) =>
  requestClient.get<ErpAuditExceptionDetail>(`/erp-audit-exceptions/${encodeURIComponent(exceptionNo)}/detail`);

export const recheckErpAuditException = (exceptionNo: string) =>
  requestClient.get<ErpAuditExceptionRecheckResult>(`/erp-audit-exceptions/${encodeURIComponent(exceptionNo)}/erp-recheck`);

/**
 * 清除库存缓存
 */
export async function clearInventoryCache() {
  return requestClient.post('/inventory/clear-inventory-cache');
}

/**
 * 清除所有缓存（Session + 库存 + 工单）
 */
export async function clearAllCache() {
  return requestClient.post('/inventory/clear-all-cache');
}

/**
 * 测试ERP连接
 */
export async function testErpConnection() {
  return requestClient.get('/inventory/test-connection');
}

/**
 * 清除ERP Session
 */
export async function clearErpSession() {
  return requestClient.post('/inventory/clear-session');
}

/**
 * 获取Session状态
 */
export async function getSessionStatus() {
  return requestClient.get('/inventory/session-status');
}
