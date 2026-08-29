import { requestClient } from '#/api/request';
import {
  confirmExcelImport,
  downloadExcelTemplate,
  exportExcel,
  previewExcelImport,
} from '#/api/excel';

export interface ErpOperatorMappingItem {
  id?: number;
  userId: number;
  username?: string;
  realName?: string;
  erpAcctCode?: string;
  erpOrgId?: string;
  responsibilityCode?: string;
  mappingRole?: string;
  mappingRoleText?: string;
  erpFormId?: string;
  erpOperatorType?: string;
  erpOperatorTypeText?: string;
  erpOperatorEntryId?: number;
  erpOperatorId?: number;
  erpOperatorNumber: string;
  erpOperatorName?: string;
  tenantId?: number;
  createTime?: number;
  updateTime?: number;
}

export interface ErpOperatorItem {
  operatorId?: number;
  operatorType?: string;
  operatorTypeText?: string;
  entryId?: number;
  staffId?: number;
  name?: string;
  number: string;
  employeeNumber?: string;
  bizOrgId?: string;
}

export interface ErpOperatorMappingQuery {
  erpOrgId?: string;
  userId?: number;
  mappingRole?: string;
}

export interface ErpOperatorSearchParams {
  keyword?: string;
  erpOrgId?: string;
  mappingRole?: string;
  /** 后端会忽略该条件，保留字段仅兼容旧调用。 */
  operatorType?: string;
  limit?: number;
}

export function getErpOperatorMappings(params?: ErpOperatorMappingQuery) {
  return requestClient.get('/erp-operator-mappings', {
    ...params,
    responseReturn: 'body',
  });
}

export function saveErpOperatorMapping(data: Partial<ErpOperatorMappingItem>) {
  return requestClient.post('/erp-operator-mappings', data, {
    responseReturn: 'body',
  });
}

export function searchErpOperators(params: ErpOperatorSearchParams) {
  return requestClient.post('/erp-operators/search', params, {
    responseReturn: 'body',
  });
}

export function downloadErpOperatorMappingTemplate() {
  return downloadExcelTemplate('/erp-operator-mappings');
}

export function exportErpOperatorMappings() {
  return exportExcel('/erp-operator-mappings');
}

export function previewErpOperatorMappingImport(file: File) {
  return previewExcelImport('/erp-operator-mappings', file);
}

export function confirmErpOperatorMappingImport(batchId: string) {
  return confirmExcelImport('/erp-operator-mappings', batchId);
}
