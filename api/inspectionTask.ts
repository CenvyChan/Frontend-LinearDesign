import { requestClient } from '#/api/request';
import { exportExcel } from '#/api/excel';

export type InspectionTaskStatus = 'CANCELLED' | 'COMPLETED' | 'IN_PROGRESS' | 'PENDING';
export type InspectionErpPushStatus =
  | 'ERP_AUDITED'
  | 'PUSH_FAILED'
  | 'PUSHED'
  | 'PUSHING'
  | 'READY_TO_PUSH'
  | 'SKIPPED'
  | 'SOURCE_INVALID'
  | 'WAIT_LOCAL_RESULT'
  | 'WAIT_REPORT_AUDIT';
export type InspectionType = 'FQC' | 'IQC' | 'LQC' | 'OQC' | 'PQC';

export interface ProcessInspectionTask {
  actualQuantity?: number;
  completeTime?: number;
  createTime?: number;
  defectQuantity?: number;
  erpInspectionBillId?: number;
  erpInspectionBillNo?: string;
  erpInspectionEntryId?: number;
  erpDocumentStatus?: string;
  erpOrgId?: string;
  erpPushStatus: InspectionErpPushStatus;
  erpPushTime?: number;
  erpReportBillId?: number;
  erpReportBillNo?: string;
  id: number;
  inspectionFlowId?: number;
  inspectionTotalQuantity?: number;
  inspectionResult?: string;
  qualityDisposition?: 'PENDING' | 'PASS' | 'REWORK' | 'SCRAP' | string;
  qualityDispositionLabel?: string;
  inspectionStage?: 'IN_PROCESS' | 'PRODUCT';
  inspectionStageLabel?: string;
  inspectionType?: InspectionType;
  inspectorId?: number;
  inspectorName?: string;
  lastError?: string;
  lastProductionStep?: boolean;
  assignedToId?: number;
  assignedToName?: string;
  materialCode?: string;
  materialName?: string;
  mobileReadStatus?: string;
  notifyStatus?: string;
  orderId?: number;
  orderNo?: string;
  processCode?: string;
  productCode?: string;
  productName?: string;
  processStepId?: number;
  productionFlowId?: number;
  rawInspectionType?: InspectionType;
  remark?: string;
  retryCount?: number;
  qualifiedQuantity?: number;
  schemeCode?: string;
  schemeId?: number;
  schemeVersion?: string;
  sourceBillId?: number;
  sourceBillNo?: string;
  sourceBillType?: string;
  sourceEntryId?: number;
  supplierCode?: string;
  supplierName?: string;
  customerCode?: string;
  customerName?: string;
  orgId?: number;
  orgName?: string;
  lineCode?: string;
  lineName?: string;
  startTime?: number;
  scrapQuantity?: number;
  stepName?: string;
  stepNo?: number;
  taskStatus: InspectionTaskStatus;
  unqualifiedQuantity?: number;
  updateTime?: number;
  workshopNumber?: string;
}

export interface InspectionErpCallAudit {
  attemptNo: number;
  billId?: number;
  billNo?: string;
  erpAcctCode?: string;
  errorMessage?: string;
  formId?: string;
  id: number;
  occurredTime: number;
  operation: string;
  requestSummary?: string;
  responsePayload?: string;
  stepNo: number;
  success: boolean;
}

export interface InspectionTaskItem {
  abnormalCount?: number;
  enumOptions?: string;
  id: number;
  itemCode: string;
  itemName: string;
  judgement?: string;
  lowerLimit?: number;
  methodName?: string;
  requiredFlag?: boolean;
  sampleCount?: number;
  sortOrder?: number;
  standardValue?: string;
  taskId: number;
  unit?: string;
  upperLimit?: number;
  valueType?: 'ATTACHMENT' | 'BOOLEAN' | 'ENUM' | 'NUMERIC' | 'TEXT';
}

export interface InspectionSample {
  attachmentUrl?: string;
  clientRequestId?: string;
  deviation?: number;
  id: number;
  inspectTime?: number;
  inspectorName?: string;
  judgement?: string;
  measuredNumber?: number;
  measuredValue?: string;
  remark?: string;
  sampleNo?: number;
  taskId: number;
  taskItemId: number;
}

export interface InspectionTaskDetail extends ProcessInspectionTask {
  items?: InspectionTaskItem[];
  samples?: InspectionSample[];
}

export async function getPendingInspectionTasks(statuses?: InspectionTaskStatus[]) {
  return requestClient.get('/inspection-tasks/pending', {
    params: statuses?.length ? { statuses: statuses.join(',') } : undefined,
    responseReturn: 'body',
  });
}

export async function getInspectionTasks(params?: {
  inspectionType?: ProcessInspectionTask['inspectionType'];
  statuses?: InspectionTaskStatus[];
}) {
  return requestClient.get('/inspection-tasks', {
    params: {
      inspectionType: params?.inspectionType,
      statuses: params?.statuses?.join(','),
    },
    responseReturn: 'body',
  });
}

export function exportInspectionTasks(params?: {
  inspectionType?: ProcessInspectionTask['inspectionType'];
  statuses?: InspectionTaskStatus[];
}) {
  return exportExcel('/inspection-tasks', {
    inspectionType: params?.inspectionType,
    statuses: params?.statuses?.join(','),
  });
}

export async function createInspectionTask(data: Partial<ProcessInspectionTask>) {
  return requestClient.post('/inspection-tasks', data, { responseReturn: 'body' });
}

export async function getInspectionTaskDetail(id: number) {
  return requestClient.get(`/inspection-tasks/${id}`, { responseReturn: 'body' });
}

export async function getInspectionTaskErpCallAudits(id: number) {
  return requestClient.get(`/inspection-tasks/${id}/erp-call-audits`, { responseReturn: 'body' });
}

export async function getMobilePendingInspectionTasks(inspectionType?: InspectionType) {
  return requestClient.get('/inspection-tasks/mobile/pending', {
    params: inspectionType ? { inspectionType } : undefined,
    responseReturn: 'body',
  });
}

export async function markInspectionTaskMobileRead(id: number) {
  return requestClient.post(`/inspection-tasks/mobile/${id}/read`, undefined, { responseReturn: 'body' });
}

export async function assignInspectionTask(id: number, data: { assignedToId?: number; assignedToName?: string }) {
  return requestClient.post(`/inspection-tasks/${id}/assign`, data, { responseReturn: 'body' });
}

export async function saveInspectionSample(id: number, data: {
  attachmentUrl?: string;
  clientRequestId?: string;
  measuredValue?: string;
  remark?: string;
  sampleId?: number;
  sampleNo?: number;
  taskItemId: number;
}) {
  return requestClient.post(`/inspection-tasks/${id}/samples`, {
    ...data,
    clientRequestId: data.clientRequestId || `pc-qc-sample-${Date.now()}-${id}-${data.taskItemId}-${data.sampleNo || 1}`,
  }, { responseReturn: 'body' });
}

export async function startInspectionTask(id: number) {
  return requestClient.post(`/inspection-tasks/${id}/start`, {}, { responseReturn: 'body' });
}

export async function completeInspectionTask(id: number, data: {
  inspectionTotalQuantity: number;
  qualifiedQuantity: number;
  unqualifiedQuantity: number;
  scrapQuantity: number;
  clientRequestId?: string;
  inspectionResult: string;
  remark?: string;
  reworkRequired?: boolean;
}) {
  return requestClient.post(`/inspection-tasks/${id}/complete`, {
    ...data,
    clientRequestId: data.clientRequestId || `pc-qc-${Date.now()}-${id}`,
  }, { responseReturn: 'body' });
}

export async function retryInspectionTaskErp(id: number) {
  return requestClient.post(`/inspection-tasks/${id}/retry-erp`, undefined, { responseReturn: 'body' });
}
