import { requestClient } from '#/api/request';
import {
  confirmExcelImport,
  downloadExcelTemplate,
  exportExcel,
  previewExcelImport,
} from '#/api/excel';

export interface UserItem {
  id: number;
  username: string;
  real_name: string;
  nickname?: string;
  phone: string | null;
  email: string | null;
  gender: number;
  status: number;
  first_login: number;
  created_by: number | null;
  create_time: number;
  remark: string | null;
  roles: Array<{ id: number; role_key: string; role_name: string }>;
  permissions?: string[];
  tenantId?: number;
  allowedLoginType?: 'ALL' | 'MOBILE' | 'WEB';
  allowed_login_type?: 'ALL' | 'MOBILE' | 'WEB';
}

export interface UserListResponse {
  success: boolean;
  data: {
    list: UserItem[];
    total: number;
  };
  message?: string;
}

export interface QueryParams {
  username?: string;
  realName?: string;
  status?: number;
  pageNum?: number;
  pageSize?: number;
}

export async function getUserList(params?: QueryParams) {
  return requestClient.get<UserListResponse>('/user/list', { params, responseReturn: 'body' });
}

export async function getUserById(id: number) {
  return requestClient.get(`/user/${id}`, { responseReturn: 'body' });
}

export async function createUser(data: Partial<UserItem>) {
  return requestClient.post('/user/create', data, { responseReturn: 'body' });
}

export async function updateUser(id: number, data: Partial<UserItem>) {
  return requestClient.put(`/user/${id}`, data, { responseReturn: 'body' });
}

export async function deleteUser(id: number) {
  return requestClient.delete(`/user/${id}`, { responseReturn: 'body' });
}

export async function resetPassword(id: number) {
  return requestClient.post(`/user/${id}/reset-password`, {}, { responseReturn: 'body' });
}

export function downloadUserTemplate() {
  return downloadExcelTemplate('/user');
}

export function exportUsers() {
  return exportExcel('/user');
}

export function previewUserImport(file: File) {
  return previewExcelImport('/user', file);
}

export function confirmUserImport(batchId: string) {
  return confirmExcelImport('/user', batchId);
}
