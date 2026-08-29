import { requestClient } from '#/api/request';
import {
  confirmExcelImport,
  downloadExcelTemplate,
  exportExcel,
  previewExcelImport,
} from '#/api/excel';

export interface WorkCenter {
  id: number;
  code: string;
  name: string;
  location: string;
  capacity: number;
  remark: string;
}

export async function getWorkCenterList() {
  return requestClient.get('/work-center/list', { responseReturn: 'body' });
}

export async function getWorkCenterById(id: number) {
  return requestClient.get(`/work-center/${id}`, { responseReturn: 'body' });
}

export async function createWorkCenter(data: Partial<WorkCenter>) {
  return requestClient.post('/work-center/create', data, { responseReturn: 'body' });
}

export async function updateWorkCenter(id: number, data: Partial<WorkCenter>) {
  return requestClient.put(`/work-center/${id}`, data, { responseReturn: 'body' });
}

export async function deleteWorkCenter(id: number) {
  return requestClient.delete(`/work-center/${id}`, { responseReturn: 'body' });
}

export async function ensureLocalWorkCenter(data: Partial<WorkCenter>) {
  return requestClient.post('/work-center/ensure-local', data, { responseReturn: 'body' });
}

export function downloadWorkCenterTemplate() {
  return downloadExcelTemplate('/work-center');
}

export function exportWorkCenter() {
  return exportExcel('/work-center');
}

export function previewWorkCenterImport(file: File) {
  return previewExcelImport('/work-center', file);
}

export function confirmWorkCenterImport(batchId: string) {
  return confirmExcelImport('/work-center', batchId);
}
