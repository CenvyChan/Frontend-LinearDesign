import { requestClient } from '#/api/request';

export interface ProcessPool {
  completeQuantity?: number;
  defectTypes?: string;
  id?: number;
  inspectionMethod?: string;
  processCode: string;
  processName: string;
  processType?: string;
  remark?: string;
  reportMethod?: string;
  reportOrder?: string;
  setupDuration?: number;
  setupTime?: number;
  setupTimeUnit?: string;
  sopFilePath?: string;
  standardDuration?: number;
  standardHours?: number;
  status?: 'ACTIVE' | 'DISABLED';
  timeUnit?: string;
  updateTime?: number;
  workCenterId?: number;
  workCenterName?: string;
}

export interface ProcessPoolQuery {
  keyword?: string;
  page?: number;
  pageSize?: number;
  status?: string;
  workCenterId?: number;
}

export interface ProcessPoolRouteStepReference {
  materialCode?: string;
  materialName?: string;
  processCode?: string;
  processName?: string;
  routeCode?: string;
  routeId?: number;
  routeName?: string;
  status?: string;
  stepId?: number;
  stepName?: string;
  stepNo?: number;
  version?: string;
}

export interface ProcessPoolReferences {
  flowCount: number;
  priceCount: number;
  processCode: string;
  processName: string;
  processPoolId: number;
  routeCount: number;
  routeSteps: ProcessPoolRouteStepReference[];
  stepCount: number;
}

export interface ImportRowError {
  columnName: string;
  message: string;
  rawValue?: string;
  rowIndex: number;
}

export interface ImportPreviewRow {
  convertedData: Record<string, any>;
  errors: ImportRowError[];
  rawData: Record<string, string>;
  rowIndex: number;
  valid: boolean;
}

export interface ImportPreviewResult {
  batchId: string;
  errorRows: number;
  errors: ImportRowError[];
  rows: ImportPreviewRow[];
  totalRows: number;
  validRows: number;
}

export async function getProcessPoolList(params: ProcessPoolQuery) {
  return requestClient.get('/process-pool/list', { params, responseReturn: 'body' });
}

export async function getProcessPoolOptions(keyword?: string) {
  return requestClient.get('/process-pool/options', {
    params: keyword ? { keyword } : undefined,
    responseReturn: 'body',
  });
}

export async function getProcessPoolReferences(id: number) {
  return requestClient.get(`/process-pool/${id}/references`, { responseReturn: 'body' });
}

export async function createProcessPool(data: Partial<ProcessPool>) {
  return requestClient.post('/process-pool', data, { responseReturn: 'body' });
}

export async function updateProcessPool(id: number, data: Partial<ProcessPool>) {
  return requestClient.put(`/process-pool/${id}`, data, { responseReturn: 'body' });
}

export async function enableProcessPool(id: number) {
  return requestClient.post(`/process-pool/${id}/enable`, undefined, { responseReturn: 'body' });
}

export async function disableProcessPool(id: number) {
  return requestClient.post(`/process-pool/${id}/disable`, undefined, { responseReturn: 'body' });
}

export async function downloadProcessPoolTemplate() {
  return requestClient.get<Blob>('/process-pool/import/template', {
    responseReturn: 'body',
    responseType: 'blob',
  });
}

export async function exportProcessPool(params: ProcessPoolQuery) {
  return requestClient.get<Blob>('/process-pool/export', {
    params,
    responseReturn: 'body',
    responseType: 'blob',
  });
}

export async function previewProcessPoolImport(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return requestClient.post<{ data: ImportPreviewResult; message?: string; success: boolean }>(
    '/process-pool/import/preview',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      responseReturn: 'body',
    },
  );
}

export async function confirmProcessPoolImport(batchId: string) {
  return requestClient.post<{ data: { count: number }; message?: string; success: boolean }>(
    '/process-pool/import/confirm',
    { batchId },
    { responseReturn: 'body' },
  );
}
