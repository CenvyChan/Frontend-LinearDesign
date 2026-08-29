import { requestClient } from '#/api/request';

export interface ConfigItem {
  configKey: string;
  configName: string;
  configValue: string;
  description?: string;
  id: number;
  remark?: string;
}

export async function getConfigList() {
  return requestClient.get('/config/list', { responseReturn: 'body' });
}

export function getConfigExportUrl() {
  return '/api/config/export';
}

export function getConfigImportTemplateUrl() {
  return '/api/config/import/template';
}

export async function previewConfigImport(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return requestClient.post('/config/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseReturn: 'body',
  });
}

export async function confirmConfigImport(batchId: string) {
  return requestClient.post('/config/import/confirm', { batchId }, { responseReturn: 'body' });
}

export interface PreCheckConfig {
  configKey: string;
  configName?: string;
  configValue: string;
  description?: string;
  id?: number;
}

export interface UpdatePreCheckConfigParams {
  configKey: string;
  configValue: string;
}

export async function getPreCheckConfigs() {
  return requestClient.get('/config/precheck', { responseReturn: 'body' });
}

export async function updatePreCheckConfig(data: UpdatePreCheckConfigParams) {
  return requestClient.put('/config/precheck', data, { responseReturn: 'body' });
}

export type FlowClaimModelingConfig = PreCheckConfig;

export type UpdateFlowClaimModelingConfigParams = UpdatePreCheckConfigParams;

export async function getFlowClaimModelingConfigs() {
  return requestClient.get('/config/flow-claim-modeling', { responseReturn: 'body' });
}

export async function updateFlowClaimModelingConfig(data: UpdateFlowClaimModelingConfigParams) {
  return requestClient.put('/config/flow-claim-modeling', data, { responseReturn: 'body' });
}

export interface InventorySummaryBasisItem {
  enabled: boolean;
  id?: number;
  remark?: string;
  sourceUseOrgName?: string;
  sourceUseOrgNumber?: string;
  warehouseName?: string;
  warehouseNumber?: string;
  warehouseType?: 'PHYSICAL' | 'WORKSHOP' | string;
}

export interface InventorySummaryBasisConfig {
  demandOrgNumber: string;
  erpAcctCode: string;
  items: InventorySummaryBasisItem[];
}

export interface InventorySummaryBasisSavePayload {
  demandOrgNumber: string;
  erpAcctCode: string;
  items: InventorySummaryBasisItem[];
}

export interface InventoryAvailabilityByBasisQuery {
  businessType?: 'FEED' | 'PICK' | 'RETURN' | string;
  demandOrgNumber: string;
  erpAcctCode?: string;
  materialNumber: string;
  pageSize?: number;
  pbomEntryId?: number;
}

export interface InventoryAvailabilityRow {
  availableQty?: number;
  expiryDate?: string;
  keeperName?: string;
  keeperNumber?: string;
  lockQty?: number;
  lotNo?: string;
  materialName?: string;
  materialNumber?: string;
  produceDate?: string;
  qty?: number;
  sourceUseOrgName?: string;
  sourceUseOrgNumber?: string;
  specification?: string;
  stockLoc?: string;
  stockStatusName?: string;
  stockStatusNumber?: string;
  unit?: string;
  warehouseName?: string;
  warehouseNumber?: string;
}

export async function getInventorySummaryBasis(params: { demandOrgNumber: string; erpAcctCode?: string }) {
  return requestClient.get('/config/inventory-summary-basis', {
    params,
    responseReturn: 'body',
  });
}

export async function updateInventorySummaryBasis(data: InventorySummaryBasisSavePayload) {
  return requestClient.put('/config/inventory-summary-basis', data, { responseReturn: 'body' });
}

// 现有库存汇总为批量快照重建（读 mes_wms_inventory_balance 全量聚合），
// 耗时随白名单仓库数与库存行数增长，故放宽超时，不使用默认 10s。
export async function refreshExistingStockSummary(data: { demandOrgNumber: string; erpAcctCode?: string }) {
  return requestClient.post<{
    message?: string;
    resultCount?: number;
    success: boolean;
    summaryType?: string;
  }>('/inventory/summary/refresh-existing-stock', data, { responseReturn: 'body', timeout: 180_000 });
}

export async function getDefaultPassword() {
  return requestClient.get('/config/default-password', { responseReturn: 'body' });
}

export async function updateDefaultPassword(data: { newPassword: string; oldPassword: string }) {
  return requestClient.put('/config/default-password', data, { responseReturn: 'body' });
}

export interface K3CloudAccountConfig {
  acctCode: string;
  acctId?: string;
  analysisCron?: string;
  analysisEnabled?: boolean;
  appId?: string;
  appSec?: string;
  displayName?: string;
  enabled: boolean;
  lcid: number;
  serverUrl: string;
  username: string;
}

export interface IntegrationConfig {
  aktools: {
    enabled: boolean;
    host: string;
    port: number;
    syncEnabled: boolean;
  };
  k3cloud: {
    accounts: K3CloudAccountConfig[];
    defaultAcctCode: string;
    enabled: boolean;
  };
  onlyoffice: {
    documentServerUrl: string;
    documentServerCallbackBaseUrl?: string;
    enabled: boolean;
    publicBaseUrl?: string;
    jwtEnabled: boolean;
    jwtSecret?: string;
    jwtSecretConfigured?: boolean;
    jwtSecretMask?: string;
  };
}

export async function getIntegrationConfig() {
  return requestClient.get('/config/integrations', { responseReturn: 'body' });
}

export async function updateIntegrationConfig(data: IntegrationConfig) {
  return requestClient.put('/config/integrations', data, { responseReturn: 'body' });
}

export interface MaterialRequestPolicyConfig {
  integerUnitNumbers: string;
  oneDecimalUnitNumbers: string;
  urgentWeeklyLimit: number;
}

export async function getMaterialRequestPolicyConfig() {
  return requestClient.get('/config/material-request-policy', { responseReturn: 'body' });
}

export async function updateMaterialRequestPolicyConfig(data: MaterialRequestPolicyConfig) {
  return requestClient.put('/config/material-request-policy', data, { responseReturn: 'body' });
}
