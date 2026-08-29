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

export interface Machine {
  id: number;
  code: string;
  name: string;
  model: string;
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
  workCenterId: number;
  location: string;
  purchaseDate: number;
  maintenanceDate: number;
  remark: string;
  createTime: number;
}

export interface MachineListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
}

export async function getMachineList(params: MachineListParams = {}) {
  return requestClient.get('/machine/list', { params, responseReturn: 'body' });
}

export async function getMachineById(id: number) {
  return requestClient.get(`/machine/${id}`, { responseReturn: 'body' });
}

export async function createMachine(data: Partial<Machine>) {
  return requestClient.post('/machine/create', data, { responseReturn: 'body' });
}

export async function updateMachine(id: number, data: Partial<Machine>) {
  return requestClient.put(`/machine/${id}`, data, { responseReturn: 'body' });
}

export async function deleteMachine(id: number) {
  return requestClient.delete(`/machine/${id}`, { responseReturn: 'body' });
}

export async function ensureLocalMachine(data: Partial<Machine>) {
  return requestClient.post('/machine/ensure-local', data, { responseReturn: 'body' });
}

export type MachineBizAction = Exclude<ResourceBizAction, 'CALIBRATE'>;

export async function performMachineBiz(
  id: number,
  action: MachineBizAction,
  data: BizActionParam,
) {
  return performResourceBiz<Machine>('MACHINE', id, action, data);
}

export async function getMachineBizRecords(id: number, page = 0, size = 20) {
  return getResourceBizRecords('MACHINE', id, page, size);
}

export async function queryMachineBizRecords(
  query: Omit<BizRecordQuery, 'resourceType'> = {},
) {
  return queryResourceBizRecords({ ...query, resourceType: 'MACHINE' });
}

export function downloadMachineTemplate() {
  return downloadExcelTemplate('/machine');
}

export function exportMachine() {
  return exportExcel('/machine');
}

export function previewMachineImport(file: File) {
  return previewExcelImport('/machine', file);
}

export function confirmMachineImport(batchId: string) {
  return confirmExcelImport('/machine', batchId);
}
