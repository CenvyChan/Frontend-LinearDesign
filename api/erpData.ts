import { baseRequestClient, requestClient } from '#/api/request';

/**
 * ERP 组织信息
 */
export interface ErpOrganization {
  id: number;
  erpAcctCode?: string;
  mesOrgId: number;
  erpOrgId: string;
  erpOrgNumber: string;
  erpOrgName: string;
  isDefault: boolean;
  status: boolean;
  remark: string;
}

export interface ErpAcctOption {
  acctCode: string;
  isDefault?: boolean;
}

export async function getErpAccounts() {
  const resp: any = await baseRequestClient.get('/erp/accounts');
  return resp.data as {
    success: boolean;
    data: ErpAcctOption[];
    defaultAcctCode?: string;
    message?: string;
  };
}

/**
 * ERP 仓库信息
 */
export interface ErpWarehouse {
  warehouseNumber: string;
  warehouseName: string;
  stockProperty?: number;
  erpOrgId?: string;
}

/**
 * 获取所有组织列表
 * 使用 baseRequestClient 保留完整响应体，因为需要 defaultOrg 字段
 */
export async function getOrganizations(acctCode?: string) {
  const headers: Record<string, string> = {};
  const resolvedAcctCode = `${acctCode ?? ''}`.trim();
  if (resolvedAcctCode) {
    headers['X-Erp-Acct-Code'] = resolvedAcctCode;
  }
  const resp: any = await baseRequestClient.get('/erp/organizations', {
    headers,
  });
  const body = resp.data as {
    success: boolean;
    data: ErpOrganization[];
    defaultOrg: ErpOrganization | null;
    message?: string;
  };
  return body;
}

/**
 * ERP 车间信息
 */
export interface ErpWorkshop {
  erpOrgNumber: string;
  erpDeptId: number;
  workshopNumber: string;
  workshopName: string;
  status: boolean;
  remark: string;
}

/**
 * 获取所有车间列表
 */
export async function getWorkshops() {
  return requestClient.get<ErpWorkshop[]>('/erp/workshops');
}

/**
 * 根据组织编码获取车间列表
 */
export async function getWorkshopsByOrgNumber(erpOrgNumber: string, erpAcctCode?: string) {
  return requestClient.get<ErpWorkshop[]>(`/erp/workshops/${erpOrgNumber}`, {
    params: erpAcctCode ? { erpAcctCode } : undefined,
  });
}

/**
 * 获取所有仓库列表
 */
export async function getWarehouses() {
  return requestClient.get<ErpWarehouse[]>('/erp/warehouses');
}

/**
 * 根据组织ID获取仓库列表
 */
export async function getWarehousesByOrgId(erpOrgId: string, erpAcctCode?: string) {
  return requestClient.get<ErpWarehouse[]>(`/erp/warehouses/${erpOrgId}`, {
    params: erpAcctCode ? { erpAcctCode } : undefined,
  });
}

/**
 * 根据ERP组织ID获取组织详情
 */
export async function getOrganizationById(erpOrgId: string) {
  const resp: any = await baseRequestClient.get(`/erp/organization/${erpOrgId}`);
  return resp.data as {
    success: boolean;
    data: ErpOrganization | null;
    message?: string;
  };
}
