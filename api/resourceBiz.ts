import { requestClient } from '#/api/request';

export type ResourceType = 'MACHINE' | 'TOOLING' | 'GAUGE' | 'MOULD';

export type ResourceBizAction =
  | 'RECEIVE'
  | 'RETURN'
  | 'MAINTAIN'
  | 'REPAIR'
  | 'SCRAP'
  | 'CALIBRATE';

export interface BizActionParam {
  operatorName: string;
  bizDetail?: string;
  remark?: string;
  orderId?: number;
  nextBizDate?: number;
}

export interface BizActionData<TResource = unknown> {
  businessId?: number;
  resource?: TResource;
  statusBefore?: string;
  statusAfter?: string;
  message?: string;
}

export interface BizActionResult<TData = unknown> {
  success: boolean;
  message?: string;
  data?: TData;
  total?: number;
}

export interface BizRecordItem {
  id?: number;
  resourceType?: ResourceType;
  machineId?: number;
  machineCode?: string;
  machineName?: string;
  toolingId?: number;
  toolingCode?: string;
  toolingName?: string;
  gaugeId?: number;
  gaugeCode?: string;
  gaugeName?: string;
  mouldId?: number;
  mouldCode?: string;
  mouldName?: string;
  bizType?: string;
  businessType?: string;
  bizTime?: number;
  businessDate?: string | number;
  operatorId?: number;
  operatorName?: string;
  orderId?: number;
  orderNo?: string;
  processStepId?: number;
  stepNo?: number;
  bizDetail?: string;
  resultDescription?: string;
  remark?: string;
  statusBefore?: string;
  statusAfter?: string;
  nextBizDate?: number | string;
  nextCalibrationDate?: number;
  sourceBillNo?: string;
  dataSource?: string;
  createTime?: number;
  createdTime?: number | string;
}

export interface BizRecordQuery {
  resourceType: ResourceType;
  resourceId?: number;
  bizType?: string;
  startTime?: number;
  endTime?: number;
  page?: number;
  size?: number;
}

export interface BizRecordPage<TRecord = BizRecordItem> {
  success: boolean;
  message?: string;
  data: TRecord[];
  total: number;
  page?: number;
  size?: number;
}

export async function performResourceBiz<TResource = unknown>(
  resourceType: ResourceType,
  resourceId: number,
  action: ResourceBizAction,
  data: BizActionParam,
) {
  return requestClient.post<BizActionResult<BizActionData<TResource>>>(
    `/resource-biz/${resourceType}/${resourceId}/${action}`,
    data,
    { responseReturn: 'body' },
  );
}

export async function getResourceBizRecords<TRecord = BizRecordItem>(
  resourceType: ResourceType,
  resourceId: number,
  page = 0,
  size = 20,
) {
  return requestClient.get<BizRecordPage<TRecord>>(
    `/resource-biz/${resourceType}/${resourceId}/records`,
    { params: { page, size }, responseReturn: 'body' },
  );
}

export async function queryResourceBizRecords<TRecord = BizRecordItem>(
  query: BizRecordQuery,
) {
  return requestClient.post<BizRecordPage<TRecord>>('/resource-biz/query', query, {
    responseReturn: 'body',
  });
}
