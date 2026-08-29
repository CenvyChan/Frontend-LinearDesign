import { requestClient } from '#/api/request';

export type ProductionReportTaskStatus =
  | 'CANCELLED'
  | 'ERP_AUDITED'
  | 'ERP_STATUS_PENDING'
  | 'PUSH_FAILED'
  | 'PUSHING'
  | 'WAIT_CONFIRM';

export interface ProductionReportTask {
  auditedTime?: number;
  defectQuantity?: number;
  erpAcctCode?: string;
  erpDocumentStatus?: string;
  erpErrorCode?: number;
  erpErrorField?: string;
  erpErrorMessage?: string;
  erpOrgId?: string;
  erpReportBillId?: number;
  erpReportBillNo?: string;
  erpReportEntryId?: number;
  goodQuantity?: number;
  id: number;
  lastError?: string;
  orderNo?: string;
  rawErpResponse?: string;
  reportQuantity?: number;
  retryCount?: number;
  scrapQuantity?: number;
  status: ProductionReportTaskStatus;
  terminalSnapshotId?: number;
  terminalFlowId?: number;
  workshopNumber?: string;
}

export interface ProductionReportTaskQuery {
  erpAcctCode?: string;
  erpOrgId?: string;
  orderNo?: string;
  status?: ProductionReportTaskStatus;
}

export function getProductionReportTasks(params?: ProductionReportTaskQuery) {
  return requestClient.get('/production-report-tasks', { params, responseReturn: 'body' });
}

export function confirmProductionReportTask(id: number) {
  return requestClient.post(`/production-report-tasks/${id}/confirm`, undefined, { responseReturn: 'body' });
}

export function retryProductionReportTask(id: number) {
  return requestClient.post(`/production-report-tasks/${id}/retry`, undefined, { responseReturn: 'body' });
}

export function cancelProductionReportTask(id: number, reason?: string) {
  return requestClient.post(`/production-report-tasks/${id}/cancel`, { reason }, { responseReturn: 'body' });
}
