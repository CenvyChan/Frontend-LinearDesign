import { requestClient } from '#/api/request';

// ============ 类型定义 ============

/** BOM展开查询参数 */
export interface BomQueryParams {
  bomNumber?: string;
  materialNumber?: string;
  materialQuantities?: BomMaterialQuantity[];
  includeScrap?: boolean;
  useOrgId?: number;
  maxLevel?: number;
}

export interface BomMaterialQuantity {
  materialNumber: string;
  finishedQuantity: number;
}

export interface BomExportTask {
  id: number;
  taskNo: string;
  sourceFileName: string;
  status: string;
  inputCount: number;
  processedCount: number;
  resultRowCount: number;
  failReason?: string;
  finishTime?: number;
  expireTime?: number;
  createTime?: number;
}

/** 物料搜索结果项 */
export interface MaterialItem {
  number: string;
  name: string;
  specification: string;
}

/** BOM版本搜索结果项 */
export interface BomVersionItem {
  bomNumber: string;
  materialName: string;
  materialNumber: string;
  specification: string;
}

/** BOM展开树节点 */
export interface BomTreeNode {
  id: string;
  inputMaterialCode: string;
  bomLevel: number;
  topBomId: number;
  bomVersion: string;
  parentMaterialNumber: string;
  parentMaterialName: string;
  childMaterialNumber: string;
  childMaterialName: string;
  unitNumber?: string;
  unitName?: string;
  finishedQuantity?: number;
  requiredQuantity?: number;
  materialModel: string;
  seq: number;
  replaceGroup: number;
  levelCode: string;
  bomLevelPath: string;
  numerator: number;
  denominator: number;
  quantity: number;
  fixedScrap: number;
  variableScrap: number;
  childBomId: number;
  useOrgId: number;
  isRoot?: boolean;
  children?: BomTreeNode[];
}

// ============ API函数 ============

export async function searchMaterials(keyword: string, orgId?: string) {
  return requestClient.get('/bom/materials/search', { params: { keyword, orgId }, responseReturn: 'body' });
}

export async function searchBomVersions(keyword: string, orgName?: string) {
  return requestClient.get('/bom/bom-versions/search', { params: { keyword, orgName }, responseReturn: 'body' });
}

export async function queryBomExpand(params: BomQueryParams) {
  return requestClient.post('/bom/expand', params, { responseReturn: 'body' });
}

export async function exportBomExpandExcel(params: BomQueryParams) {
  return requestClient.post<Blob>('/bom/expand/export', params, {
    responseReturn: 'body',
    responseType: 'blob',
  });
}

export async function submitBomExpandExcelTask(
  file: File,
  params?: Pick<BomQueryParams, 'includeScrap' | 'maxLevel' | 'useOrgId'>,
) {
  const formData = new FormData();
  formData.append('file', file);
  if (params?.includeScrap != null) formData.append('includeScrap', String(params.includeScrap));
  if (params?.maxLevel != null) formData.append('maxLevel', String(params.maxLevel));
  if (params?.useOrgId != null) formData.append('useOrgId', String(params.useOrgId));
  // RequestClient 默认 Content-Type=application/json；FormData 必须显式改为 multipart，
  // 否则后端 consumes=MULTIPART_FORM_DATA 会 415，导出任务中心也不会有新任务。
  return requestClient.post('/bom/expand/excel/tasks', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseReturn: 'body',
  });
}

/** 下载 Sheet9 物料清单导出模板（A=物料编码，B=成品数量，数据从第4行起） */
export async function downloadBomExpandExcelTemplate() {
  return requestClient.get<Blob>('/bom/expand/excel/template', {
    responseReturn: 'body',
    responseType: 'blob',
  });
}

export function listBomExportTasks() {
  return requestClient.get('/bom/export-tasks', { responseReturn: 'body' });
}

/** 鉴权下载 BOM 导出结果（勿用 window.open，新窗口不会带 Authorization） */
export async function downloadBomExportTask(id: number) {
  return requestClient.get<Blob>(`/bom/export-tasks/${id}/download`, {
    responseReturn: 'body',
    responseType: 'blob',
  });
}

/** 删除自己的 BOM 导出任务（处理中禁止） */
export async function deleteBomExportTask(id: number) {
  return requestClient.delete(`/bom/export-tasks/${id}`, { responseReturn: 'body' });
}

export function getBomExportTaskDownloadUrl(id: number) {
  return `/api/bom/export-tasks/${id}/download`;
}

export async function queryBomExpandTree(params: BomQueryParams) {
  return requestClient.post('/bom/expand/tree', params, { responseReturn: 'body' });
}

/** BOM 反查(where-used)请求参数 */
export interface BomWhereUsedParams {
  /** 待反查的物料编码，多个用逗号分隔 */
  materialNumber: string;
  /**
   * 使用组织。可传组织编码(如 001)或内码(如 100071)，后端统一归一化。
   *
   * 务必传值：不传则后端不加组织过滤，同一 BOM 在集团与子公司下各存一份，
   * 递归每层结果翻倍。
   */
  useOrgId?: string;
  /** 最大向上追溯层数，默认 10 */
  maxLevel?: number;
  erpAcctCode?: string;
}

/** BOM 反查单行结果：parentMaterialNumber 的 BOM 用到了 childMaterialNumber */
export interface BomWhereUsedRow {
  /** 1 = 输入物料的直接父项，2 = 父项的父项 */
  bomLevel: number;
  inputMaterialCode?: string;
  bomVersion?: string;
  parentMaterialNumber: string;
  parentMaterialName?: string;
  parentMaterialModel?: string;
  childMaterialNumber: string;
  childMaterialName?: string;
  childMaterialModel?: string;
  unitNumber?: string;
  unitName?: string;
  numerator?: number;
  denominator?: number;
  /** 分子/分母，单件父项消耗多少子项 */
  unitUsage?: number;
  /** 自顶向下的编码路径，形如 顶层 -> 中间件 -> 输入物料 */
  pathTree?: string;
  topBomId?: number;
  useOrgId?: number;
}

/**
 * BOM 反查：查该物料被哪些上级 BOM 使用（与 queryBomExpand 方向相反）。
 */
export async function queryBomWhereUsed(params: BomWhereUsedParams) {
  return requestClient.post<{
    data: BomWhereUsedRow[];
    message?: string;
    success: boolean;
    total?: number;
  }>('/bom/where-used', params, { responseReturn: 'body' });
}

export async function getLatestBomVersion(materialNumber: string, orgId?: string) {
  return requestClient.get('/bom/bom-version/latest', { params: { materialNumber, orgId }, responseReturn: 'body' });
}

/**
 * 获取物料所有BOM版本列表
 */
export async function getBomVersionsByMaterial(materialNumber: string, orgId?: string) {
  return requestClient.get('/bom/bom-versions/by-material', { params: { materialNumber, orgId }, responseReturn: 'body' });
}

/**
 * ERP客户搜索
 */
export async function searchCustomers(keyword: string, orgId?: string) {
  return requestClient.get('/bom/customer/search', { params: { keyword, orgId }, responseReturn: 'body' });
}
