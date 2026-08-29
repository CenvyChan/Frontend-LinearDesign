import { requestClient } from '#/api/request';
import { exportExcel } from '#/api/excel';

export interface MesResponsibility {
  id?: number;
  responsibilityCode: string;
  responsibilityName: string;
  sourceType?: string;
  status: number;
  sort?: number;
  remark?: string;
}

export interface MesUserResponsibility {
  id?: number;
  userId: number;
  responsibilityCode: string;
  erpAcctCode: string;
  erpOrgId: string;
  scopeType: 'ORGANIZATION' | 'WAREHOUSE' | 'WORKSHOP' | 'DEPARTMENT';
  scopeKey?: string;
  status: number;
  remark?: string;
}

export interface MesResourceResponsibilityOwner {
  id?: number;
  erpAcctCode: string;
  erpOrgId: string;
  resourceType: 'WAREHOUSE' | 'WORKSHOP';
  resourceCode: string;
  responsibilityCode: string;
  userResponsibilityId: number;
  remark?: string;
}

export function getMesResponsibilities() {
  return requestClient.get('/mes-responsibilities', { responseReturn: 'body' });
}

export function saveMesResponsibility(data: Partial<MesResponsibility>) {
  return requestClient.post('/mes-responsibilities', data, { responseReturn: 'body' });
}

export function getMesUserResponsibilities(params?: { erpOrgId?: string; userId?: number }) {
  return requestClient.get('/mes-responsibilities/user-assignments', { params, responseReturn: 'body' });
}

export function saveMesUserResponsibility(data: Partial<MesUserResponsibility>) {
  return requestClient.post('/mes-responsibilities/user-assignments', data, { responseReturn: 'body' });
}

export interface MesUserResponsibilityBatchSavePayload {
  userId: number;
  assignments: Partial<MesUserResponsibility>[];
}

export function saveMesUserResponsibilities(data: MesUserResponsibilityBatchSavePayload) {
  return requestClient.post('/mes-responsibilities/user-assignments/batch', data, { responseReturn: 'body' });
}

export function getMesResourceResponsibilityOwners(params?: { erpOrgId?: string }) {
  return requestClient.get('/mes-responsibilities/resource-owners', { params, responseReturn: 'body' });
}

export function saveMesResourceResponsibilityOwner(data: Partial<MesResourceResponsibilityOwner>) {
  return requestClient.post('/mes-responsibilities/resource-owners', data, { responseReturn: 'body' });
}

export function getMesResponsibilityIntegrityReport() {
  return requestClient.get('/mes-responsibilities/integrity-report', { responseReturn: 'body' });
}

export function exportMesResponsibilityIntegrityReport() {
  return exportExcel('/system-master/responsibility-integrity-report');
}

export function getEmployeeParticipationRecords(params?: Record<string, unknown>) {
  return requestClient.get('/mes-responsibilities/employee-participation-records', { params, responseReturn: 'body' });
}

export interface ImportFromErpWarehousePayload {
  erpAcctCode: string;
  erpOrgId: string;
}

export interface ImportedResourceOwnerRecord {
  erpAcctCode: string;
  erpOrgId: string;
  warehouseNumber: string;
  warehouseName: string;
  erpStaffId?: number;
  erpStaffName?: string;
  warehouseWorkerNumber?: string;
  warehouseWorkerName?: string;
  mesUserId?: number;
  mesUserName?: string;
  userResponsibilityId?: number;
}

export interface FailedResourceOwnerRecord {
  erpAcctCode: string;
  erpOrgId: string;
  warehouseNumber: string;
  warehouseName: string;
  erpStaffId?: number;
  erpStaffName?: string;
  reason: string;
  stage: string;
}

export interface ImportFromErpWarehouseResult {
  succeeded: ImportedResourceOwnerRecord[];
  failed: FailedResourceOwnerRecord[];
}

/** 后端为 @RequestParam，须走 query string，不能放 body */
export function importFromErpWarehouse(params: ImportFromErpWarehousePayload) {
  return requestClient.post<ImportFromErpWarehouseResult>(
    '/mes-responsibilities/resource-owners/import-from-erp',
    undefined,
    { params, responseReturn: 'body' },
  );
}
