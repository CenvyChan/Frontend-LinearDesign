import { requestClient } from '#/api/request';

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

export interface ApiResult<T> {
  data?: T;
  message?: string;
  success: boolean;
}

export function downloadExcelTemplate(basePath: string) {
  return requestClient.get<Blob>(`${basePath}/import/template`, {
    responseReturn: 'body',
    responseType: 'blob',
  });
}

export function exportExcel(basePath: string, params?: Record<string, any>) {
  return requestClient.get<Blob>(`${basePath}/export`, {
    params,
    responseReturn: 'body',
    responseType: 'blob',
  });
}

export function previewExcelImport(basePath: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return requestClient.post<ApiResult<ImportPreviewResult>>(
    `${basePath}/import/preview`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      responseReturn: 'body',
    },
  );
}

export function confirmExcelImport(basePath: string, batchId: string) {
  return requestClient.post<ApiResult<{ count: number }>>(
    `${basePath}/import/confirm`,
    { batchId },
    { responseReturn: 'body' },
  );
}
