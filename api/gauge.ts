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

export interface Gauge {
  id: number;
  code: string;
  name: string;
  type: string;
  specification: string;
  accuracy: string;
  precision?: string;
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
  calCycle: number;
  lastCalDate: number;
  nextCalDate: number;
  lastCalibrationDate?: number;
  nextCalibrationDate?: number;
  location: string;
  remark: string;
  createTime: number;
}

export interface GaugeListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
}

export async function getGaugeList(params: GaugeListParams = {}) {
  return requestClient.get('/gauge/list', { params, responseReturn: 'body' });
}

export async function getGaugeById(id: number) {
  return requestClient.get(`/gauge/${id}`, { responseReturn: 'body' });
}

export async function createGauge(data: Partial<Gauge>) {
  return requestClient.post('/gauge/create', data, { responseReturn: 'body' });
}

export async function updateGauge(id: number, data: Partial<Gauge>) {
  return requestClient.put(`/gauge/${id}`, data, { responseReturn: 'body' });
}

export async function deleteGauge(id: number) {
  return requestClient.delete(`/gauge/${id}`, { responseReturn: 'body' });
}

export async function ensureLocalGauge(data: Partial<Gauge>) {
  return requestClient.post('/gauge/ensure-local', data, { responseReturn: 'body' });
}

export type GaugeBizAction = Exclude<ResourceBizAction, 'MAINTAIN'>;

export async function performGaugeBiz(
  id: number,
  action: GaugeBizAction,
  data: BizActionParam,
) {
  return performResourceBiz<Gauge>('GAUGE', id, action, data);
}

export async function getGaugeBizRecords(id: number, page = 0, size = 20) {
  return getResourceBizRecords('GAUGE', id, page, size);
}

export async function queryGaugeBizRecords(
  query: Omit<BizRecordQuery, 'resourceType'> = {},
) {
  return queryResourceBizRecords({ ...query, resourceType: 'GAUGE' });
}

export function downloadGaugeTemplate() {
  return downloadExcelTemplate('/gauge');
}

export function exportGauge() {
  return exportExcel('/gauge');
}

export function previewGaugeImport(file: File) {
  return previewExcelImport('/gauge', file);
}

export function confirmGaugeImport(batchId: string) {
  return confirmExcelImport('/gauge', batchId);
}
