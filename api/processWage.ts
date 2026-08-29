import { requestClient } from '#/api/request';

export type ProcessPriceType = 'HOUR' | 'MIXED' | 'PIECE';
export type WageCalcStatus =
  | 'AUDITED'
  | 'AUDIT_REJECTED'
  | 'CALCULATED'
  | 'CANCELLED'
  | 'CONFIRMED'
  | 'CONFIRM_REJECTED'
  | 'ERP_FAILED'
  | 'ERP_PUSHED'
  | 'FAILED'
  | 'SUBMITTED';

export interface ProcessStepPrice {
  id?: number;
  routeId?: number;
  processStepId?: number;
  processPoolCode?: string;
  processPoolId?: number;
  processPoolName?: string;
  processCode?: string;
  processName?: string;
  workCenterId?: number;
  workCenterName?: string;
  priceType: ProcessPriceType;
  piecePrice?: number;
  hourPrice?: number;
  setupPrice?: number;
  defectDeductionPrice?: number;
  effectiveFrom?: number;
  effectiveTo?: number;
  status?: 'ACTIVE' | 'DISABLED';
  remark?: string;
  updateTime?: number;
}

export interface ProcessWageSettlement {
  id: number;
  orderId: number;
  orderNo: string;
  flowId: number;
  routeId?: number;
  routeVersion?: string;
  processStepId?: number;
  processPoolId?: number;
  stepNo?: number;
  stepName?: string;
  processCode?: string;
  operatorId?: number;
  operatorName?: string;
  actualQuantity?: number;
  defectQuantity?: number;
  goodQuantity?: number;
  actualHours?: number;
  standardMinutes?: number;
  actualMinutes?: number;
  varianceMinutes?: number;
  priceType?: ProcessPriceType;
  priceConfigId?: number;
  piecePrice?: number;
  hourPrice?: number;
  setupAmount?: number;
  pieceAmount?: number;
  hourAmount?: number;
  qualityDeduction?: number;
  wageAmount?: number;
  calcStatus: WageCalcStatus;
  calcTime?: number;
  failureReason?: string;
  confirmedBy?: number;
  confirmedByName?: string;
  confirmedTime?: number;
  auditedBy?: number;
  auditedByName?: string;
  auditedTime?: number;
  erpPushTime?: number;
  erpReportBillId?: number;
  erpReportBillNo?: string;
  canPushErp?: boolean;
  lastProductionStep?: boolean;
  rawErpError?: string;
  rejectReason?: string;
  remark?: string;
}

export type ProcessWageSheetStatus =
  | 'CANCELLED'
  | 'CONFIRMED'
  | 'PENDING_REVIEW'
  | 'REJECTED'
  | 'WAIT_QUALITY';

export interface ProcessWageSheet {
  id: number;
  orderId: number;
  orderNo: string;
  terminalSnapshotId: number;
  status: ProcessWageSheetStatus;
  formulaMode?: 'EMPLOYEE_DETAIL' | 'PROCESS_POOL_SHARE';
  prdOrgNumber?: string;
  workshopNumber?: string;
  goodQuantity?: number;
  defectQuantity?: number;
  scrapQuantity?: number;
  originalAmount?: number;
  calculatedAmount?: number;
  finalAmount?: number;
  correctionReason?: string;
  confirmedTime?: number;
}

export interface ProcessWageSheetLine {
  id: number;
  employeeId?: number;
  employeeName?: string;
  reportedQuantity?: number;
  reportedHours?: number;
  originalAmount?: number;
  calculatedAmount?: number;
  ruleAmount?: number;
  finalAmount?: number;
  adjustmentReason?: string;
}

export interface ProcessWageSheetDetail {
  lines: ProcessWageSheetLine[];
  sheet: ProcessWageSheet;
}

export interface ProcessWageSheetAdjustRequest {
  finalAmount: number;
  lineId: number;
  reason?: string;
}

export async function getProcessStepPrices() {
  return requestClient.get('/process-wage/prices', { responseReturn: 'body' });
}

export async function getProcessWageSheets() {
  return requestClient.get('/process-wage/sheets', { responseReturn: 'body' });
}

export async function getProcessWageSheetDetail(id: number) {
  return requestClient.get(`/process-wage/sheets/${id}`, { responseReturn: 'body' });
}

export async function confirmProcessWageSheet(id: number) {
  return requestClient.post(`/process-wage/sheets/${id}/confirm`, undefined, { responseReturn: 'body' });
}

export async function rejectProcessWageSheet(id: number, reason?: string) {
  return requestClient.post(`/process-wage/sheets/${id}/reject`, { reason }, { responseReturn: 'body' });
}

export async function adjustProcessWageSheet(id: number, data: ProcessWageSheetAdjustRequest) {
  return requestClient.post(`/process-wage/sheets/${id}/adjust`, data, { responseReturn: 'body' });
}

export async function recalculateProcessWageSheet(id: number, restoreRuleValues = false) {
  return requestClient.post(`/process-wage/sheets/${id}/recalculate`, { restoreRuleValues }, { responseReturn: 'body' });
}

export async function createProcessStepPrice(data: Partial<ProcessStepPrice>) {
  return requestClient.post('/process-wage/prices', data, { responseReturn: 'body' });
}

export async function updateProcessStepPrice(id: number, data: Partial<ProcessStepPrice>) {
  return requestClient.put(`/process-wage/prices/${id}`, data, { responseReturn: 'body' });
}

export async function disableProcessStepPrice(id: number) {
  return requestClient.delete(`/process-wage/prices/${id}`, { responseReturn: 'body' });
}

export async function getOrderWageSettlements(orderId: number) {
  return requestClient.get(`/process-wage/order/${orderId}/settlements`, { responseReturn: 'body' });
}

export async function getPendingWageSettlements(statuses?: WageCalcStatus[]) {
  return requestClient.get('/process-wage/settlements/pending', {
    params: statuses?.length ? { statuses: statuses.join(',') } : undefined,
    responseReturn: 'body',
  });
}

export async function confirmWageSettlement(id: number) {
  return requestClient.post(`/process-wage/settlements/${id}/confirm`, undefined, { responseReturn: 'body' });
}

export async function auditWageSettlement(id: number) {
  return requestClient.post(`/process-wage/settlements/${id}/audit`, undefined, { responseReturn: 'body' });
}

export async function rejectWageSettlement(id: number, reason: string) {
  return requestClient.post(`/process-wage/settlements/${id}/reject`, { reason }, { responseReturn: 'body' });
}

export async function pushWageSettlementErp(id: number) {
  return requestClient.post(`/process-wage/settlements/${id}/push-erp`, undefined, { responseReturn: 'body' });
}

export function getOrderWageExportUrl(orderId: number) {
  return `/api/process-wage/order/${orderId}/settlements/export`;
}

export function getProcessStepPriceExportUrl() {
  return '/api/process-wage/prices/export';
}

export function getProcessStepPriceImportTemplateUrl() {
  return '/api/process-wage/prices/import/template';
}

export async function previewProcessStepPriceImport(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return requestClient.post('/process-wage/prices/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseReturn: 'body',
  });
}

export async function confirmProcessStepPriceImport(batchId: string) {
  return requestClient.post('/process-wage/prices/import/confirm', { batchId }, { responseReturn: 'body' });
}

export async function recalculateProcessWage(flowId: number) {
  return requestClient.post(`/process-wage/flows/${flowId}/recalculate`, undefined, { responseReturn: 'body' });
}
