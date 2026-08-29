import { requestClient } from '#/api/request';

export interface ApiResult<T> {
  data: T;
  message?: string;
  success: boolean;
  total?: number;
}

export interface BarcodeTemplate {
  businessType: string;
  createTime?: number;
  defaultFlag?: boolean;
  enabled?: boolean;
  erpAcctCode: string;
  id?: number;
  layoutJson: string;
  paramSchemaJson?: string;
  scenarioCode: string;
  scenarioName?: string;
  templateCode: string;
  templateName: string;
  tenantId?: number;
  updateTime?: number;
  versionNo?: number;
}

export interface BarcodeScanCode {
  businessKey: string;
  businessType: string;
  createTime?: number;
  erpAcctCode: string;
  id?: number;
  lastPrintTime?: number;
  lastScanTime?: number;
  rawValue: string;
  scanCount?: number;
  sourceVersion?: string;
  status: string;
  tenantId?: number;
  token: string;
  updateTime?: number;
}

export interface BarcodePrintJob {
  businessKey: string;
  businessType: string;
  copies: number;
  createTime?: number;
  erpAcctCode: string;
  errorMessage?: string;
  id?: number;
  idempotencyKey?: string;
  jobNo: string;
  maxReprintCount: number;
  reprintCount: number;
  renderRef?: string;
  scenarioCode?: string;
  scenarioName?: string;
  status: string;
  templateId?: number;
  tenantId?: number;
  updateTime?: number;
}

export interface BarcodeScanAudit {
  actionCode?: string;
  businessKey?: string;
  businessType?: string;
  createTime?: number;
  deviceId?: string;
  erpAcctCode: string;
  id?: number;
  operatorId?: number;
  rawValue: string;
  resolveStatus: string;
  tenantId?: number;
  token?: string;
  traceId?: string;
}

export interface BarcodeQuery {
  businessKey?: string;
  businessType?: string;
  erpAcctCode?: string;
  scenarioCode?: string;
  scenarioName?: string;
  status?: string;
  tenantId?: number;
}

export interface BarcodeTemplatePayload {
  businessType: string;
  defaultFlag?: boolean;
  enabled?: boolean;
  erpAcctCode?: string;
  id?: number;
  layoutJson: string;
  paramSchemaJson?: string;
  scenarioCode?: string;
  scenarioName?: string;
  templateCode: string;
  templateName: string;
  tenantId?: number;
}

export interface BarcodeTemplatePreviewPayload {
  businessType: string;
  erpAcctCode?: string;
  params?: Record<string, any>;
  scenarioCode?: string;
  tenantId?: number;
}

export interface BarcodeTemplatePreviewResult {
  layoutJson: string;
  template: BarcodeTemplate;
}

export interface BarcodeScanCodePayload {
  businessKey: string;
  businessType: string;
  erpAcctCode?: string;
}

export interface BarcodePrintJobPayload {
  businessKey: string;
  businessType: string;
  copies?: number;
  erpAcctCode?: string;
  scenarioCode?: string;
  scenarioName?: string;
  idempotencyKey?: string;
  maxReprintCount?: number;
  templateId?: number;
  tenantId?: number;
}

export async function getBarcodeTemplates(params: BarcodeQuery) {
  return requestClient.get<ApiResult<BarcodeTemplate[]>>('/barcode/templates', {
    params,
    responseReturn: 'body',
  });
}

export async function saveBarcodeTemplate(data: BarcodeTemplatePayload) {
  return requestClient.post<ApiResult<BarcodeTemplate>>('/barcode/templates', data, {
    responseReturn: 'body',
  });
}

export async function enableBarcodeTemplate(id: number) {
  return requestClient.post<ApiResult<BarcodeTemplate>>(
    `/barcode/templates/${id}/enable`,
    {},
    { responseReturn: 'body' },
  );
}

export async function disableBarcodeTemplate(id: number) {
  return requestClient.post<ApiResult<BarcodeTemplate>>(
    `/barcode/templates/${id}/disable`,
    {},
    { responseReturn: 'body' },
  );
}

export async function previewBarcodeTemplate(data: BarcodeTemplatePreviewPayload) {
  return requestClient.post<ApiResult<BarcodeTemplatePreviewResult>>('/barcode/templates/preview', data, {
    responseReturn: 'body',
  });
}

export async function createBarcodeScanCode(data: BarcodeScanCodePayload) {
  return requestClient.post<ApiResult<BarcodeScanCode>>('/barcode/scan-codes', data, {
    responseReturn: 'body',
  });
}

export async function getBarcodeScanCodes(params: BarcodeQuery) {
  return requestClient.get<ApiResult<BarcodeScanCode[]>>('/barcode/scan-codes', {
    params,
    responseReturn: 'body',
  });
}

export async function disableBarcodeScanCode(id: number) {
  return requestClient.post<ApiResult<BarcodeScanCode>>(
    `/barcode/scan-codes/${id}/disable`,
    {},
    { responseReturn: 'body' },
  );
}

export async function createBarcodePrintJob(data: BarcodePrintJobPayload) {
  return requestClient.post<ApiResult<BarcodePrintJob>>('/barcode/print-jobs', data, {
    responseReturn: 'body',
  });
}

export async function getBarcodePrintJobs(params: BarcodeQuery) {
  return requestClient.get<ApiResult<BarcodePrintJob[]>>('/barcode/print-jobs', {
    params,
    responseReturn: 'body',
  });
}

export async function recordBarcodeReprint(jobNo: string) {
  return requestClient.post<ApiResult<BarcodePrintJob>>(
    `/barcode/print-jobs/${encodeURIComponent(jobNo)}/reprint`,
    {},
    { responseReturn: 'body' },
  );
}

export async function getBarcodeScanAudits(params: BarcodeQuery) {
  return requestClient.get<ApiResult<BarcodeScanAudit[]>>('/barcode/scan-audits', {
    params,
    responseReturn: 'body',
  });
}
