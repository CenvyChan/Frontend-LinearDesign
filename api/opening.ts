import type { ApiResult } from '#/api/excel';

import { requestClient } from '#/api/request';

export interface OpeningReferenceStatus {
  enabled?: boolean;
  organizations?: number;
  serverUrl?: string;
  session?: unknown;
  warehouses?: number;
  workshops?: number;
  [key: string]: unknown;
}

export interface OpeningReferenceActionResult {
  message?: string;
  status?: OpeningReferenceStatus;
  success?: boolean;
  [key: string]: unknown;
}

export function getOpeningReferenceStatus() {
  return requestClient.get<ApiResult<OpeningReferenceStatus>>(
    '/opening/references/status',
    { responseReturn: 'body' },
  );
}

export function testOpeningReferenceConnection() {
  return requestClient.post<ApiResult<OpeningReferenceActionResult>>(
    '/opening/references/test-connection',
    {},
    { responseReturn: 'body' },
  );
}

export function refreshOpeningReferences() {
  return requestClient.post<ApiResult<OpeningReferenceActionResult>>(
    '/opening/references/refresh',
    {},
    { responseReturn: 'body' },
  );
}

export function exportOpeningReferenceReport() {
  return requestClient.get<Blob>('/opening/references/export', {
    responseReturn: 'body',
    responseType: 'blob',
  });
}
