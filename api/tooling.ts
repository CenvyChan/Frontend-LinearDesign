import { requestClient } from '#/api/request';
import {
  confirmExcelImport,
  downloadExcelTemplate,
  exportExcel,
  previewExcelImport,
} from '#/api/excel';

import {
  getResourceBizRecords,
  performResourceBiz,
  queryResourceBizRecords,
  type BizActionParam,
  type BizRecordQuery,
  type ResourceBizAction,
} from './resourceBiz';

export interface Tooling {
  id: number;
  code: string;
  name: string;
  type: string;
  specification: string;
  quantity: number;
  status: string;
  statusCode?: string;
  statusText?: string;
  statusTagType?: string;
  canReceive?: boolean;
  canReturn?: boolean;
  canMaintain?: boolean;
  canRepair?: boolean;
  canScrap?: boolean;
  canCalibrate?: boolean;
  location: string;
  remark: string;
  createTime: number;
}

export interface ToolingListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
}

export async function getToolingList(params: ToolingListParams = {}) {
  return requestClient.get('/tooling/list', { params, responseReturn: 'body' });
}

export async function getToolingById(id: number) {
  return requestClient.get(`/tooling/${id}`, { responseReturn: 'body' });
}

export async function createTooling(data: Partial<Tooling>) {
  return requestClient.post('/tooling/create', data, { responseReturn: 'body' });
}

export async function updateTooling(id: number, data: Partial<Tooling>) {
  return requestClient.put(`/tooling/${id}`, data, { responseReturn: 'body' });
}

export async function deleteTooling(id: number) {
  return requestClient.delete(`/tooling/${id}`, { responseReturn: 'body' });
}

export async function ensureLocalTooling(data: Partial<Tooling>) {
  return requestClient.post('/tooling/ensure-local', data, { responseReturn: 'body' });
}

export type ToolingBizAction = Exclude<ResourceBizAction, 'CALIBRATE'>;

export async function performToolingBiz(
  id: number,
  action: ToolingBizAction,
  data: BizActionParam,
) {
  return performResourceBiz<Tooling>('TOOLING', id, action, data);
}

export async function getToolingBizRecords(id: number, page = 0, size = 20) {
  return getResourceBizRecords('TOOLING', id, page, size);
}

export async function queryToolingBizRecords(
  query: Omit<BizRecordQuery, 'resourceType'> = {},
) {
  return queryResourceBizRecords({ ...query, resourceType: 'TOOLING' });
}

export function downloadToolingTemplate() {
  return downloadExcelTemplate('/tooling');
}

export function exportTooling() {
  return exportExcel('/tooling');
}

export function previewToolingImport(file: File) {
  return previewExcelImport('/tooling', file);
}

export function confirmToolingImport(batchId: string) {
  return confirmExcelImport('/tooling', batchId);
}
