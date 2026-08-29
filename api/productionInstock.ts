import { requestClient } from '#/api/request';
import { exportExcel } from '#/api/excel';

export type ProductionInstockTaskStatus =
  | 'CANCELLED'
  | 'CONFIRMING'
  | 'ERP_AUDITED'
  | 'ERP_FAILED'
  | 'ERP_PUSHED'
  | 'PENDING_CONFIRM'
  | 'WAIT_ERP_AUDIT';

export interface ProductionInstockTask {
  confirmTime?: number;
  confirmedQty?: number;
  createTime?: number;
  defectQty?: number;
  erpBillStatus?: string;
  erpDocumentStatus?: string;
  erpInspectionBillId?: number;
  erpInspectionBillNo?: string;
  erpInspectionStatus?: string;
  erpInstockBillId?: number;
  erpInstockBillNo?: string;
  erpOrgNumber?: string;
  erpPushTime?: number;
  erpReportBillId?: number;
  erpReportBillNo?: string;
  erpReportStatus?: string;
  id: number;
  inspectionTaskId: number;
  instockedQty?: number;
  lastError?: string;
  lotNumber?: string;
  materialCode?: string;
  materialName?: string;
  orderNo?: string;
  pendingQty?: number;
  productCode?: string;
  productName?: string;
  qualifiedQty?: number;
  remark?: string;
  retryCount?: number;
  stockLoc?: string;
  stockName?: string;
  stockNumber?: string;
  stockStatusName?: string;
  stockStatusNumber?: string;
  stockerName?: string;
  taskStatus: ProductionInstockTaskStatus;
  updateTime?: number;
}

export interface ConfirmProductionInstockPayload {
  erpOrgNumber: string;
  instockQty: number;
  lotNumber?: string;
  remark?: string;
  stockLoc?: string;
  stockName?: string;
  stockNumber: string;
  stockStatusName?: string;
  stockStatusNumber?: string;
  stockerId?: number;
  stockerName?: string;
}

export async function getProductionInstockTasks(params?: {
  statuses?: ProductionInstockTaskStatus[];
}) {
  return requestClient.get('/production-instock-tasks', {
    params: params?.statuses?.length ? { statuses: params.statuses.join(',') } : undefined,
    responseReturn: 'body',
  });
}

export function exportProductionInstockTasks(params?: {
  statuses?: ProductionInstockTaskStatus[];
}) {
  return exportExcel('/production-instock-tasks', {
    statuses: params?.statuses?.join(','),
  });
}

export async function refreshProductionInstockErpStatus(id: number) {
  return requestClient.post(`/production-instock-tasks/${id}/refresh-erp-status`, undefined, { responseReturn: 'body' });
}

export async function confirmProductionInstock(id: number, data: ConfirmProductionInstockPayload) {
  return requestClient.post(`/production-instock-tasks/${id}/confirm`, data, { responseReturn: 'body' });
}

export async function retryProductionInstockErp(id: number) {
  return requestClient.post(`/production-instock-tasks/${id}/retry-erp`, undefined, { responseReturn: 'body' });
}

export async function suggestProductionInstockStock(id: number) {
  return requestClient.post(`/production-instock-tasks/${id}/suggest-stock`, undefined, { responseReturn: 'body' });
}
