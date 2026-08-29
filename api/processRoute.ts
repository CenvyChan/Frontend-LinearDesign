import { requestClient } from '#/api/request';
import {
  confirmExcelImport,
  downloadExcelTemplate,
  exportExcel,
  previewExcelImport,
} from '#/api/excel';

// ==================== 类型定义 ====================

export enum RouteCategory {
  STAMPING = 'STAMPING',
  INJECTION = 'INJECTION',
  WELDING = 'WELDING',
  ASSEMBLY = 'ASSEMBLY',
  CNC = 'CNC',
  SURFACE_TREATMENT = 'SURFACE_TREATMENT',
  PACKAGING = 'PACKAGING',
  OTHER = 'OTHER',
}

export const RouteCategoryLabels: Record<string, string> = {
  [RouteCategory.STAMPING]: '冲压',
  [RouteCategory.INJECTION]: '注塑',
  [RouteCategory.WELDING]: '焊接',
  [RouteCategory.ASSEMBLY]: '装配',
  [RouteCategory.CNC]: 'CNC加工',
  [RouteCategory.SURFACE_TREATMENT]: '表面处理',
  [RouteCategory.PACKAGING]: '包装',
  [RouteCategory.OTHER]: '其他',
};

export enum RouteStatus {
  DRAFT = 'DRAFT',
  REVIEWING = 'REVIEWING',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

export const RouteStatusLabels: Record<string, string> = {
  [RouteStatus.DRAFT]: '草稿',
  [RouteStatus.REVIEWING]: '审核中',
  [RouteStatus.APPROVED]: '已审核',
  [RouteStatus.ACTIVE]: '已启用',
  [RouteStatus.DISABLED]: '已失效',
};

export const RouteStatusColors: Record<string, string> = {
  [RouteStatus.DRAFT]: 'info',
  [RouteStatus.REVIEWING]: 'warning',
  [RouteStatus.APPROVED]: 'success',
  [RouteStatus.ACTIVE]: 'primary',
  [RouteStatus.DISABLED]: 'danger',
};

export enum InspectionMethod {
  NONE = 'NONE',
  SELF = 'SELF',
  QC = 'QC',
}

export const InspectionMethodLabels: Record<string, string> = {
  [InspectionMethod.NONE]: '免检',
  [InspectionMethod.SELF]: '车间自检',
  [InspectionMethod.QC]: '报检',
};

export enum ReportMethod {
  REQUIRED = 'REQUIRED',
  NOT_REQUIRED = 'NOT_REQUIRED',
}

export const ReportMethodLabels: Record<string, string> = {
  [ReportMethod.REQUIRED]: '必须汇报',
  [ReportMethod.NOT_REQUIRED]: '不需汇报',
};

export enum ReportOrder {
  BEFORE = 'BEFORE',
  AFTER = 'AFTER',
  NONE = 'NONE',
}

export const ReportOrderLabels: Record<string, string> = {
  [ReportOrder.BEFORE]: '先汇报后工序',
  [ReportOrder.AFTER]: '先工序后汇报',
  [ReportOrder.NONE]: '不控制',
};

export enum TimeUnit {
  SECOND = 'SECOND',
  MINUTE = 'MINUTE',
  HOUR = 'HOUR',
  DAY = 'DAY',
}

export const TimeUnitLabels: Record<string, string> = {
  [TimeUnit.SECOND]: '秒',
  [TimeUnit.MINUTE]: '分钟',
  [TimeUnit.HOUR]: '小时',
  [TimeUnit.DAY]: '天',
};

export interface ProcessStepWorkCenter {
  id?: number;
  workCenterId: number;
  workCenterName?: string;
  isPrimary?: boolean;
  priority?: number;
}

export interface ProcessStepMachine {
  id?: number;
  machineId: number;
  machineName?: string;
  machineCode?: string;
  isRequired?: boolean;
  quantity?: number;
}

export interface ProcessStepTooling {
  id?: number;
  toolingId: number;
  toolingName?: string;
  toolingCode?: string;
  isRequired?: boolean;
  quantity?: number;
}

export interface ProcessStepGauge {
  id?: number;
  gaugeId: number;
  gaugeName?: string;
  gaugeCode?: string;
  isRequired?: boolean;
}

export interface ProcessStepMould {
  id?: number;
  mouldId?: number;
  erpMouldId?: number;
  mouldName?: string;
  mouldCode?: string;
  isRequired?: boolean;
  cavityCount?: number;
  outputPerShot?: number;
}

export interface ProcessStepDocument {
  id: number;
  stepId: number;
  docName: string;
  docType: 'INSPECTION_STANDARD' | 'PROCESS_FILE' | 'SOP';
  filePath: string;
  fileSize: number;
  fileExt: string;
  originalFilename: string;
  contentType: string;
  remark: string;
  createdByName: string;
  createdTime: number | string;
}

export const DocTypeLabels: Record<string, string> = {
  INSPECTION_STANDARD: '检验标准',
  PROCESS_FILE: '工艺文件',
  SOP: 'SOP作业指导书',
};

export const DocTypeColors: Record<string, string> = {
  INSPECTION_STANDARD: 'primary',
  PROCESS_FILE: 'success',
  SOP: 'warning',
};

export interface ProcessStep {
  id?: number;
  routeId?: number;
  processPoolCode?: string;
  processPoolId?: number;
  processPoolName?: string;
  stepNo: number;
  processCode: string;
  processName?: string;
  stepName: string;
  setupTime?: number;
  standardHours: number;
  timeUnit?: string;
  standardDuration?: number;
  completeQuantity?: number;
  setupTimeUnit?: string;
  setupDuration?: number;
  inspectionMethod?: InspectionMethod;
  reportMethod?: ReportMethod;
  reportOrder?: string;
  defectTypes?: string;
  sopFilePath?: string;
  remark?: string;
  isLastStep?: boolean;
  workCenters?: ProcessStepWorkCenter[];
  machines?: ProcessStepMachine[];
  toolings?: ProcessStepTooling[];
  gauges?: ProcessStepGauge[];
  moulds?: ProcessStepMould[];
}

export interface ProcessRoute {
  id: number;
  routeCode: string;
  routeName: string;
  routeCategory?: RouteCategory;
  version: string;
  materialCode?: string;
  materialName?: string;
  productCode?: string;
  productSpec?: string;
  customerCode?: string;
  customerName?: string;
  projectName?: string;
  bomVersion?: string;
  effectiveDate?: number;
  orgId?: number;
  orgName?: string;
  status: RouteStatus;
  remark?: string;
  erpRouteId?: number;
  steps?: ProcessStep[];
  createdTime?: string | number;
}

export type ProcessRouteBatchAction =
  | 'SUBMIT'
  | 'APPROVE'
  | 'ACTIVATE'
  | 'DISABLE'
  | 'REACTIVATE'
  | 'DELETE';

export interface ProcessRouteBatchActionItem {
  id: number;
  routeCode?: string;
  routeName?: string;
  action: string;
  success: boolean;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  message?: string;
  nextStatus?: RouteStatus;
}

export interface ProcessRouteBatchActionResult {
  total: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  items: ProcessRouteBatchActionItem[];
}

// ==================== CRUD API ====================

export async function getProcessRouteList(params: {
  keyword?: string;
  status?: string;
  category?: string;
  orgId?: number;
  latestOnly?: boolean;
  page?: number;
  pageSize?: number;
}) {
  // 使用 'body' 模式以保留完整的响应体 {success, data, total} 供前端分页使用
  return requestClient.get('/process-route/list', { params, responseReturn: 'body' });
}

export async function getProcessRouteById(id: number) {
  return requestClient.get(`/process-route/${id}`, { responseReturn: 'body' });
}

export async function createProcessRoute(data: Partial<ProcessRoute>) {
  return requestClient.post('/process-route/create', data, { responseReturn: 'body' });
}

export async function updateProcessRoute(id: number, data: Partial<ProcessRoute>) {
  return requestClient.put(`/process-route/${id}`, data, { responseReturn: 'body' });
}

export async function deleteProcessRoute(id: number) {
  return requestClient.delete(`/process-route/${id}`, { responseReturn: 'body' });
}

// ==================== 状态流转 ====================

export async function submitProcessRoute(id: number) {
  return requestClient.post(`/process-route/${id}/submit`, undefined, { responseReturn: 'body' });
}

export async function approveProcessRoute(id: number) {
  return requestClient.post(`/process-route/${id}/approve`, undefined, { responseReturn: 'body' });
}

export async function activateProcessRoute(id: number) {
  return requestClient.post(`/process-route/${id}/activate`, undefined, { responseReturn: 'body' });
}

export async function disableProcessRoute(id: number) {
  return requestClient.post(`/process-route/${id}/disable`, undefined, { responseReturn: 'body' });
}

export async function reactivateProcessRoute(id: number) {
  return requestClient.post(`/process-route/${id}/reactivate`, undefined, { responseReturn: 'body' });
}

export async function copyProcessRoute(id: number) {
  return requestClient.post(`/process-route/${id}/copy`, undefined, { responseReturn: 'body' });
}

export async function batchProcessRouteAction(data: {
  action: ProcessRouteBatchAction;
  ids: number[];
  reason?: string;
}) {
  return requestClient.post('/process-route/batch-action', data, { responseReturn: 'body' });
}

// ==================== 版本管理 ====================

export async function iterateProcessRoute(id: number) {
  return requestClient.post(`/process-route/${id}/iterate`, undefined, { responseReturn: 'body' });
}

export async function getVersionHistory(id: number) {
  return requestClient.get(`/process-route/${id}/versions`, { responseReturn: 'body' });
}

export async function getVersionHistoryByMaterial(materialCode: string) {
  return requestClient.get('/process-route/versions/by-material', {
    params: { materialCode },
    responseReturn: 'body',
  });
}

export async function getNextVersion(id: number) {
  return requestClient.get(`/process-route/${id}/next-version`, { responseReturn: 'body' });
}

export async function getNextVersionByMaterial(materialCode: string, excludeId?: number) {
  return requestClient.get('/process-route/next-version-by-material', {
    params: { materialCode, excludeId },
    responseReturn: 'body',
  });
}

// ==================== 工序排序 ====================

export async function updateStepOrder(routeId: number, stepIds: number[]) {
  return requestClient.put('/process-route/steps/order', { routeId, stepIds }, { responseReturn: 'body' });
}

// ==================== 资源绑定 ====================

export async function bindWorkCenters(
  stepId: number,
  items: Array<{ workCenterId: number; isPrimary?: boolean; priority?: number }>,
) {
  return requestClient.post(`/process-route/steps/${stepId}/work-centers`, items, { responseReturn: 'body' });
}

export async function bindMachines(
  stepId: number,
  items: Array<{ machineId: number; isRequired?: boolean; quantity?: number }>,
) {
  return requestClient.post(`/process-route/steps/${stepId}/machines`, items, { responseReturn: 'body' });
}

export async function bindToolings(
  stepId: number,
  items: Array<{ toolingId: number; isRequired?: boolean; quantity?: number }>,
) {
  return requestClient.post(`/process-route/steps/${stepId}/toolings`, items, { responseReturn: 'body' });
}

export async function bindGauges(
  stepId: number,
  items: Array<{ gaugeId: number; isRequired?: boolean }>,
) {
  return requestClient.post(`/process-route/steps/${stepId}/gauges`, items, { responseReturn: 'body' });
}

export async function bindMoulds(
  stepId: number,
  items: Array<{ mouldId?: number; erpMouldId?: number; mouldCode?: string; isRequired?: boolean; cavityCount?: number }>,
) {
  return requestClient.post(`/process-route/steps/${stepId}/moulds`, items, { responseReturn: 'body' });
}

// ==================== 工序文档 ====================

export async function uploadStepDocument(formData: FormData) {
  return requestClient.post('/process-route/document/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseReturn: 'body'
  });
}

export async function getStepDocumentList(stepId: number) {
  return requestClient.get('/process-route/document/list', { params: { stepId }, responseReturn: 'body' });
}

export async function deleteStepDocument(id: number) {
  return requestClient.delete(`/process-route/document/${id}`, { responseReturn: 'body' });
}

export async function getDocumentFileInfo(id: number) {
  return requestClient.get(`/process-route/document/file/${id}`, { responseReturn: 'body' });
}

export function downloadProcessRouteTemplate() {
  return downloadExcelTemplate('/process-route');
}

export function exportProcessRoute(params?: {
  category?: string;
  keyword?: string;
  status?: string;
}) {
  return exportExcel('/process-route', params);
}

export function previewProcessRouteImport(file: File) {
  return previewExcelImport('/process-route', file);
}

export function confirmProcessRouteImport(batchId: string) {
  return confirmExcelImport('/process-route', batchId);
}
