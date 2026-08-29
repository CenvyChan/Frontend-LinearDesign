import { requestClient } from '#/api/request';
import {
  confirmExcelImport,
  downloadExcelTemplate,
  exportExcel,
  previewExcelImport,
} from '#/api/excel';

export type InspectionType = 'FQC' | 'IQC' | 'LQC' | 'OQC' | 'PQC';
export type InspectionItemValueType = 'ATTACHMENT' | 'BOOLEAN' | 'ENUM' | 'NUMERIC' | 'TEXT';

export interface InspectionScheme {
  customerCode?: string;
  customerName?: string;
  effectiveFrom?: number;
  effectiveTo?: number;
  id?: number;
  inspectionType: InspectionType;
  lineCode?: string;
  lineName?: string;
  materialCode?: string;
  materialName?: string;
  orgId?: number;
  orgName?: string;
  processCode?: string;
  processName?: string;
  productCode?: string;
  productName?: string;
  remark?: string;
  schemeCode: string;
  schemeName: string;
  status?: 'ACTIVE' | 'DISABLED';
  supplierCode?: string;
  supplierName?: string;
  updateTime?: number;
  version: string;
}

export interface InspectionSchemeItem {
  enumOptions?: string;
  id?: number;
  itemCode: string;
  itemName: string;
  lowerLimit?: number;
  methodName?: string;
  remark?: string;
  requiredFlag?: boolean;
  sampleCount?: number;
  schemeId?: number;
  sortOrder?: number;
  standardValue?: string;
  toleranceMinus?: number;
  tolerancePlus?: number;
  unit?: string;
  upperLimit?: number;
  valueType: InspectionItemValueType;
}

export async function getInspectionSchemes(inspectionType?: InspectionType) {
  return requestClient.get('/inspection-schemes', {
    params: inspectionType ? { inspectionType } : undefined,
    responseReturn: 'body',
  });
}

export async function createInspectionScheme(data: Partial<InspectionScheme>) {
  return requestClient.post('/inspection-schemes', data, { responseReturn: 'body' });
}

export async function updateInspectionScheme(id: number, data: Partial<InspectionScheme>) {
  return requestClient.put(`/inspection-schemes/${id}`, data, { responseReturn: 'body' });
}

export async function getInspectionSchemeItems(schemeId: number) {
  return requestClient.get(`/inspection-schemes/${schemeId}/items`, { responseReturn: 'body' });
}

export async function createInspectionSchemeItem(schemeId: number, data: Partial<InspectionSchemeItem>) {
  return requestClient.post(`/inspection-schemes/${schemeId}/items`, data, { responseReturn: 'body' });
}

export async function updateInspectionSchemeItem(schemeId: number, itemId: number, data: Partial<InspectionSchemeItem>) {
  return requestClient.put(`/inspection-schemes/${schemeId}/items/${itemId}`, data, { responseReturn: 'body' });
}

export function downloadInspectionSchemeTemplate() {
  return downloadExcelTemplate('/inspection-schemes');
}

export function exportInspectionSchemes() {
  return exportExcel('/inspection-schemes');
}

export function previewInspectionSchemeImport(file: File) {
  return previewExcelImport('/inspection-schemes', file);
}

export function confirmInspectionSchemeImport(batchId: string) {
  return confirmExcelImport('/inspection-schemes', batchId);
}
