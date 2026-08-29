import { requestClient } from '#/api/request';
import {
  confirmExcelImport,
  downloadExcelTemplate,
  exportExcel,
  previewExcelImport,
} from '#/api/excel';

export interface PermissionNode {
  id: number;
  perm_key: string;
  perm_name: string;
  children?: PermissionNode[];
}

export interface RoleItem {
  id: number;
  role_key: string;
  role_name: string;
  sort: number;
  status: number;
  remark: string | null;
  create_time: number;
  permissions?: string[];
}

export interface RoleListResponse {
  success: boolean;
  data: RoleItem[];
  message?: string;
}

export interface QueryParams {
  roleKey?: string;
  roleName?: string;
  status?: number;
}

export async function getRoleList(params?: QueryParams) {
  return requestClient.get<RoleListResponse>('/role/list', { ...params, responseReturn: 'body' });
}

export async function getRoleById(id: number) {
  return requestClient.get(`/role/${id}`, { responseReturn: 'body' });
}

export async function createRole(data: Partial<RoleItem>) {
  return requestClient.post('/role/create', data, { responseReturn: 'body' });
}

export async function updateRole(id: number, data: Partial<RoleItem>) {
  return requestClient.put(`/role/${id}`, data, { responseReturn: 'body' });
}

export async function deleteRole(id: number) {
  return requestClient.delete(`/role/${id}`, { responseReturn: 'body' });
}

// 获取权限树（用于权限配置弹窗）
export async function getPermissionTree() {
  return requestClient.get<{ success: boolean; data: PermissionNode[] }>('/role/permissions/tree', { responseReturn: 'body' });
}

// 获取角色已有权限ID列表
export async function getRolePermissions(roleId: number): Promise<{ success: boolean; data: number[] }> {
  return requestClient.get(`/role/${roleId}/permissions`, { responseReturn: 'body' });
}

// 保存角色权限
export async function updateRolePermissions(roleId: number, permissionIds: number[]) {
  return requestClient.post(`/role/${roleId}/permissions`, { permissionIds }, { responseReturn: 'body' });
}

// 通知用户权限变更（WebSocket 或轮询方式）
export async function notifyPermissionChange(roleId: number) {
  return requestClient.post('/role/notify-permission-change', { roleId }, { responseReturn: 'body' });
}

export function downloadRoleTemplate() {
  return downloadExcelTemplate('/role');
}

export function exportRoles() {
  return exportExcel('/role');
}

export function previewRoleImport(file: File) {
  return previewExcelImport('/role', file);
}

export function confirmRoleImport(batchId: string) {
  return confirmExcelImport('/role', batchId);
}
