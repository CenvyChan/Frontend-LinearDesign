import { requestClient } from '#/api/request';
import type { ApiResult, ImportPreviewResult } from '#/api/excel';

export type SystemMasterType =
  | 'config'
  | 'department'
  | 'dictionary'
  | 'erp-operator-mapping'
  | 'post'
  | 'role'
  | 'user';

export function getSystemMasterBasePath(type: SystemMasterType) {
  return `/system-master/${type}`;
}

export function getSystemMasterExportUrl(type: SystemMasterType) {
  return `/api/system-master/${type}/export`;
}

export function getSystemMasterImportTemplateUrl(type: SystemMasterType) {
  return `/api/system-master/${type}/import/template`;
}

export async function previewSystemMasterImport(type: SystemMasterType, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return requestClient.post<ApiResult<ImportPreviewResult>>(`${getSystemMasterBasePath(type)}/import/preview`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseReturn: 'body',
  });
}

export async function confirmSystemMasterImport(type: SystemMasterType, batchId: string) {
  return requestClient.post<ApiResult<{ count: number }>>(
    `${getSystemMasterBasePath(type)}/import/confirm`,
    { batchId },
    { responseReturn: 'body' },
  );
}

export async function downloadSystemMasterTemplate(type: SystemMasterType) {
  return requestClient.get<Blob>(`${getSystemMasterBasePath(type)}/import/template`, {
    responseReturn: 'body',
    responseType: 'blob',
  });
}

export async function exportSystemMaster(type: SystemMasterType) {
  return requestClient.get<Blob>(`${getSystemMasterBasePath(type)}/export`, {
    responseReturn: 'body',
    responseType: 'blob',
  });
}
