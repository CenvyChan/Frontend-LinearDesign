import { requestClient } from '#/api/request';
import {
  confirmExcelImport,
  downloadExcelTemplate,
  exportExcel,
  previewExcelImport,
} from '#/api/excel';

import {
  getResourceBizRecords,
  performResourceBiz,
  queryResourceBizRecords,
  type BizActionParam,
  type BizRecordQuery,
  type ResourceBizAction,
} from './resourceBiz';

// ============ 类型定义 ============

export interface MouldItem {
  id?: number;
  erpMouldId?: number;
  erpAcctCode?: string;
  erpOrgId?: string;
  erpOrgName?: string;
  erpOrgNumber?: string;
  mouldCode: string;
  mouldName: string;
  materialCode?: string;
  materialName?: string;
  specification?: string;
  cavityCount?: number;
  status: string;
  productType?: string;
  ownerName?: string;
  location?: string;
  openDate?: string;
  nextMaintainDate?: string;
  produceType?: string;
  produceMaterialType?: string;
}

/** 模具成本记录 */
export interface MouldCostItem {
  id?: number;
  mouldId?: number;
  materialCode: string;
  specification?: string;
  costType: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  sourceBill?: string;
  dataSource: string;
  remark?: string;
  createdTime?: string;
}

/** 模具业务记录 */
export interface MouldBusinessItem {
  id?: number;
  businessType: string;
  businessDate: string;
  mouldCount: number;
  remark?: string;
  sourceBillNo?: string;
  dataSource: string;
}

/** 模具档案资料 */
export interface MouldDocumentItem {
  id?: number;
  mouldCode: string;
  docName: string;
  docType: string;
  filePath: string;
  fileSize?: number;
  fileExt?: string;
  remark?: string;
  createdByName?: string;
  createdTime?: string;
}

/** 模具列表查询参数 */
export interface MouldListParams {
  keyword?: string;
  mouldCode?: string;
  mouldName?: string;
  ownerName?: string;
  page?: number;
  pageSize?: number;
  status?: string;
  produceType?: string;
  produceMaterialType?: string;
}

/** 同步状态概览 */
export interface SyncStatusOverview {
  totalCount: number;
  successCount: number;
  failedCount: number;
  processingCount: number;
  hasFailedRecords: boolean;
  warningMessage?: string;
}

/** 同步历史查询参数 */
export interface SyncHistoryParams {
  status?: string;
  dataSource?: string;
  page?: number;
  pageSize?: number;
}

/** 业务记录查询参数 */
export interface BusinessHistoryParams {
  mouldCode?: string;
  businessType?: string;
  sourceBillNo?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

// ============ 模具列表API ============

// 查询模具列表（本地数据库）
export async function getLocalMouldList() {
  return requestClient.get('/mould/list', { responseReturn: 'body' });
}

// ERP缓存模具列表（带搜索）
export async function getErpMouldList(params?: MouldListParams) {
  return requestClient.get('/mould/erp/list', { params, responseReturn: 'body' });
}

export async function ensureLocalMould(data: Partial<MouldItem>) {
  return requestClient.post('/mould/ensure-local', data, { responseReturn: 'body' });
}

// 刷新模具列表缓存
export async function refreshMouldCache() {
  return requestClient.post('/mould/erp/list/refresh', undefined, { responseReturn: 'body' });
}

// ============ 模具详情API ============

// 查询模具成本信息
export async function getMouldCost(mouldNumber: string, page = 1, pageSize = 50) {
  return requestClient.get('/mould/erp/cost', { params: { mouldNumber, page, pageSize }, responseReturn: 'body' });
}

// 查询模具业务记录（合并MES+ERP）
export async function getMouldBusiness(params: { mouldNumber: string; page?: number; pageSize?: number }) {
  return requestClient.get('/mould/erp/business', { params, responseReturn: 'body' });
}

// ============ 模具档案资料API ============

// 查询档案资料列表
export async function getMouldDocumentList(mouldCode: string) {
  return requestClient.get('/mould/document/list', { params: { mouldCode }, responseReturn: 'body' });
}

// 删除档案资料
export async function deleteMouldDocument(id: number) {
  return requestClient.delete(`/mould/document/${id}`, { responseReturn: 'body' });
}

// 获取文件信息（用于预览）
export async function getDocumentFileInfo(id: number) {
  return requestClient.get(`/mould/document/file/${id}`, { responseReturn: 'body' });
}

// 上传档案文件
export async function uploadMouldDocument(formData: FormData) {
  return requestClient.post('/mould/document/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseReturn: 'body'
  });
}

// 获取OnlyOffice配置
export async function getOnlyOfficeConfig() {
  return requestClient.get('/mould/document/onlyoffice/config', { responseReturn: 'body' });
}

// 生成OnlyOffice JWT Token
export async function generateOnlyOfficeToken(payload: any) {
  return requestClient.post('/mould/document/onlyoffice/token', payload, { responseReturn: 'body' });
}

// ============ 模具同步管理API ============

// 查询同步状态概览
export async function getSyncStatus() {
  return requestClient.get('/mould/sync/status', { responseReturn: 'body' });
}

// 查询同步历史记录
export async function getSyncHistory(params: SyncHistoryParams) {
  return requestClient.get('/mould/sync/history', { params, responseReturn: 'body' });
}

// 查询业务记录历史
export async function getBusinessHistory(params: BusinessHistoryParams) {
  return requestClient.get('/mould/business/history', { params, responseReturn: 'body' });
}

// 重试失败的同步记录
export async function retryFailedRecord(recordId: number) {
  return requestClient.post(`/mould/sync/retry/${recordId}`, undefined, { responseReturn: 'body' });
}

// 同步模具主数据
export async function syncMouldMasterData() {
  return requestClient.post('/mould/master-sync', undefined, { responseReturn: 'body' });
}

// MES端新增成本记录
export async function createMouldCost(data: {
  mouldCode: string;
  materialCode: string;
  specification?: string;
  costType: string;
  quantity: number;
  unitPrice?: number;
  amount?: number;
  sourceBill?: string;
  remark?: string;
}) {
  return requestClient.post('/mould/cost', data, { responseReturn: 'body' });
}

// MES端删除成本记录
export async function deleteMouldCost(id: number) {
  return requestClient.delete(`/mould/cost/${id}`, { responseReturn: 'body' });
}

export type MouldResourceBizAction = Exclude<ResourceBizAction, 'CALIBRATE'>;

export async function performMouldResourceBiz(
  id: number,
  action: MouldResourceBizAction,
  data: BizActionParam,
) {
  return performResourceBiz<MouldItem>('MOULD', id, action, data);
}

export async function getMouldResourceBizRecords(
  id: number,
  page = 0,
  size = 20,
) {
  return getResourceBizRecords('MOULD', id, page, size);
}

export async function queryMouldResourceBizRecords(
  query: Omit<BizRecordQuery, 'resourceType'> = {},
) {
  return queryResourceBizRecords({ ...query, resourceType: 'MOULD' });
}

export function downloadMouldTemplate() {
  return downloadExcelTemplate('/mould');
}

export function exportMould() {
  return exportExcel('/mould');
}

export function previewMouldImport(file: File) {
  return previewExcelImport('/mould', file);
}

export function confirmMouldImport(batchId: string) {
  return confirmExcelImport('/mould', batchId);
}
