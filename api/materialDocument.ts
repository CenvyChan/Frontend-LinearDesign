import { requestClient } from '#/api/request';

export interface MaterialDocumentType {
  id: number;
  typeCode: string;
  typeName: string;
  sortNo: number;
  status: string;
  remark?: string;
}

export interface MaterialDocumentVersion {
  id: number;
  exportKey?: string;
  itemId: number;
  materialVersionId?: number;
  processDocumentId?: number;
  versionNo: number;
  systemVersion: string;
  externalVersion?: string;
  isLatest: boolean;
  filePath: string;
  fileName: string;
  fileExt: string;
  fileSize: number;
  contentType?: string;
  uploaderName?: string;
  uploadTime?: number;
  changeReason?: string;
  printQuotaPerUser?: number;
  sourceType?: 'MATERIAL_DOCUMENT' | 'PROCESS_ROUTE_DOCUMENT';
  readonly?: boolean;
  routeId?: number;
  routeCode?: string;
  routeName?: string;
  routeVersion?: string;
  bomVersion?: string;
  stepId?: number;
  stepNo?: number;
  stepName?: string;
  docType?: string;
}

export interface MaterialDocumentPrintCapability {
  maxPrintCount: number;
  usedPrintCount: number;
  remainingPrintCount: number;
  printable: boolean;
  fileExt: string;
  unavailableReason?: string;
}

export interface MaterialDocumentPrintJob {
  jobNo: string;
  printCount: number;
  maxPrintCount: number;
  watermarkText: string;
  printUrl: string;
}

export interface MaterialDocumentPrintHistoryRecord {
  jobNo: string;
  printerName: string;
  printTime: number;
  printCount: number;
  maxPrintCount: number;
  status: string;
}

export interface MaterialDocumentPrintHistory {
  maxPrintCount: number;
  usedPrintCount: number;
  remainingPrintCount: number;
  records: MaterialDocumentPrintHistoryRecord[];
}

export interface MaterialDocumentPrintEvidence {
  latestRecord: MaterialDocumentPrintHistoryRecord | null;
  maxPrintCount: number;
  records: MaterialDocumentPrintHistoryRecord[];
  remainingPrintCount: number;
  usedPrintCount: number;
}

export interface MaterialDocumentItem {
  id: number;
  materialCode: string;
  materialName?: string;
  documentTypeId: number;
  documentTypeCode: string;
  documentTypeName: string;
  documentName: string;
  status: string;
  sourceType?: 'MATERIAL_DOCUMENT' | 'PROCESS_ROUTE_DOCUMENT';
  readonly?: boolean;
  routeId?: number;
  routeCode?: string;
  routeName?: string;
  routeVersion?: string;
  bomVersion?: string;
  stepId?: number;
  stepNo?: number;
  stepName?: string;
  docType?: string;
  versions: MaterialDocumentVersion[];
}

export interface DocumentSummaryCell {
  documentTypeCode: string;
  documentTypeName: string;
  count: number;
  latestSystemVersion?: string;
  latestExternalVersion?: string;
  latestUploadTime?: number;
}

export interface ExportTask {
  id: number;
  taskNo: string;
  rootMaterialCode: string;
  rootMaterialName?: string;
  bomVersion?: string;
  status: string;
  fileCount: number;
  zipPath?: string;
  failReason?: string;
  finishTime?: number;
  expireTime?: number;
  createdByName?: string;
  createTime?: number;
}

export interface ExportPreviewItem {
  item: MaterialDocumentItem;
  versions: Array<{
    version: MaterialDocumentVersion;
    selectedByDefault: boolean;
  }>;
  sourceType?: 'MATERIAL_DOCUMENT' | 'PROCESS_ROUTE_DOCUMENT';
  readonly?: boolean;
  routeId?: number;
  routeCode?: string;
  routeName?: string;
  routeVersion?: string;
  bomVersion?: string;
  stepId?: number;
  stepNo?: number;
  stepName?: string;
  docType?: string;
}

export interface ExportPreview {
  items: ExportPreviewItem[];
  defaultSelectedCount: number;
}

export interface ExportRequest {
  rootMaterialCode: string;
  rootMaterialName?: string;
  bomVersion?: string;
  materialCodes: string[];
  versionIds?: number[];
  fileKeys?: string[];
  materialNodes?: Array<{
    materialCode: string;
    materialName?: string;
    bomVersion?: string;
    bomLevel?: number;
    parentMaterialCode?: string;
    parentMaterialName?: string;
  }>;
}

export function getMaterialDocumentTypes(enabledOnly = true) {
  return requestClient.get<MaterialDocumentType[]>('/material-documents/types', {
    params: { enabledOnly },
  });
}

export function getMaterialDocumentSummary(
  materialCodes: string[],
  materialNodes?: Array<{ bomVersion?: string; materialCode: string }>,
) {
  return requestClient.post<Record<string, Record<string, DocumentSummaryCell>>>(
    '/material-documents/summary',
    { materialCodes, materialNodes },
  );
}

export function getMaterialDocuments(materialCode: string, bomVersion?: string) {
  return requestClient.get<MaterialDocumentItem[]>(`/material-documents/material/${encodeURIComponent(materialCode)}`, {
    params: { bomVersion },
  });
}

export function getMaterialDocumentHistory(materialCode: string) {
  return requestClient.get<any[]>(`/material-documents/material/${encodeURIComponent(materialCode)}/history`);
}

export function uploadMaterialDocument(formData: FormData) {
  return requestClient.post('/material-documents/items', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export function uploadMaterialDocumentVersion(itemId: number, formData: FormData) {
  return requestClient.post(`/material-documents/items/${itemId}/versions`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export function voidMaterialDocument(itemId: number, changeReason: string) {
  return requestClient.post(`/material-documents/items/${itemId}/void`, { changeReason });
}

export function voidMaterialDocumentVersion(versionId: number, changeReason: string) {
  return requestClient.post(`/material-documents/versions/${versionId}/void`, { changeReason });
}

export function previewMaterialDocumentExport(payload: ExportRequest) {
  return requestClient.post<ExportPreview>('/material-documents/export/preview', payload);
}

export function submitMaterialDocumentExport(payload: ExportRequest) {
  return requestClient.post<ExportTask>('/material-documents/export/tasks', payload);
}

export function listMaterialDocumentExportTasks() {
  return requestClient.get<ExportTask[]>('/material-documents/export/tasks');
}

export function getMaterialDocumentExportTask(id: number) {
  return requestClient.get<ExportTask>(`/material-documents/export/tasks/${id}`);
}

export function getMaterialDocumentFileUrl(filePath: string) {
  return `/api/uploads/${filePath}`;
}

export function getMaterialDocumentVersionDownloadUrl(sourceType: string, id: number | string) {
  return `/api/material-documents/versions/${encodeURIComponent(sourceType)}/${encodeURIComponent(String(id))}/download`;
}

export function getMaterialDocumentExportDownloadUrl(id: number) {
  return `/api/material-documents/export/tasks/${id}/download`;
}

export function getMaterialDocumentOnlyOfficeConfig() {
  return requestClient.get<{
    enabled: boolean;
    documentServerUrl: string;
    jwtEnabled: boolean;
  }>('/material-documents/onlyoffice/config');
}

export function generateMaterialDocumentOnlyOfficeToken(payload: any) {
  return requestClient.post<{ token: string }>('/material-documents/onlyoffice/token', payload);
}

export function getMaterialDocumentPrintCapability(sourceType: string, sourceId: number | string) {
  return requestClient.get<MaterialDocumentPrintCapability>('/material-documents/print-capability', {
    params: { sourceId, sourceType },
  });
}

export function getMaterialDocumentPrintHistory(sourceType: string, sourceId: number | string) {
  return requestClient.get<MaterialDocumentPrintHistory>('/material-documents/print-history', {
    params: { sourceId, sourceType },
  });
}

export function createMaterialDocumentPrintJob(sourceType: string, sourceId: number | string) {
  return requestClient.post<MaterialDocumentPrintJob>('/material-documents/print-jobs', {
    sourceId,
    sourceType,
  });
}

function numberOrFallback(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function buildMaterialDocumentPrintEvidence(
  history?: Partial<MaterialDocumentPrintHistory> | null,
  capability?: Partial<MaterialDocumentPrintCapability> | null,
): MaterialDocumentPrintEvidence {
  const records = Array.isArray(history?.records) ? history.records : [];
  const maxPrintCount = numberOrFallback(history?.maxPrintCount, numberOrFallback(capability?.maxPrintCount));
  const usedPrintCount = numberOrFallback(history?.usedPrintCount, numberOrFallback(capability?.usedPrintCount));
  const remainingPrintCount = numberOrFallback(
    history?.remainingPrintCount,
    numberOrFallback(capability?.remainingPrintCount, Math.max(0, maxPrintCount - usedPrintCount)),
  );

  return {
    latestRecord: records[0] || null,
    maxPrintCount,
    records,
    remainingPrintCount,
    usedPrintCount,
  };
}
