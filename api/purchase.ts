import { requestClient } from '#/api/request';

/** 采购查询公共筛选参数 */
export interface PurchaseQueryParams {
  billNo?: string;
  materialNumber?: string;
  /** 数据状态：Z 暂存 / A 创建 / B 审核中 / C 已审核 / D 重新审核 */
  documentStatus?: string;
  /** 采购组织编码，如 001 */
  orgNumber?: string;
  /** 日期下界，含。YYYY-MM-DD */
  dateFrom?: string;
  /**
   * 日期上界，不含。YYYY-MM-DD
   *
   * 后端用 `<` 比较：ERP 存的是带时分秒的 datetime，若用 `<=` 会漏掉当天数据。
   * 所以想查「到 8/29 为止」应传 8/30。
   */
  dateTo?: string;
  erpAcctCode?: string;
  page?: number;
  pageSize?: number;
}

export interface PurchaseOrderQueryParams extends PurchaseQueryParams {
  supplierNumber?: string;
}

/** 采购申请单分录行 */
export interface PurchaseRequisitionRow {
  billNo: string;
  documentStatus?: string;
  closeStatus?: string;
  createDate?: string;
  applicationDate?: string;
  applicationOrgNumber?: string;
  materialNumber?: string;
  materialName?: string;
  materialModel?: string;
  unitName?: string;
  /** 申请数量 */
  reqQty?: number;
  approveQty?: number;
  /** 已下推成采购订单的数量，0 表示还没转订单 */
  orderQty?: number;
  remainQty?: number;
  arrivalDate?: string;
  /** 采购组织编码，BOM 反查的组织入参来源 */
  purchaseOrgNumber?: string;
  requireOrgNumber?: string;
  bomNumber?: string;
  srcBillNo?: string;
  entryNote?: string;
}

/** 采购订单分录行 */
export interface PurchaseOrderRow {
  billNo: string;
  documentStatus?: string;
  closeStatus?: string;
  billDate?: string;
  createDate?: string;
  supplierNumber?: string;
  supplierName?: string;
  /** 采购组织编码，BOM 反查的组织入参来源 */
  purchaseOrgNumber?: string;
  materialNumber?: string;
  materialName?: string;
  materialModel?: string;
  unitName?: string;
  qty?: number;
  remainReceiveQty?: number;
  taxPrice?: number;
  /** 本币金额 */
  amount?: number;
  deliveryDate?: string;
  srcBillNo?: string;
  mtoNo?: string;
  entryNote?: string;
}

interface PurchasePageResult<T> {
  data: T[];
  message?: string;
  page?: number;
  pageSize?: number;
  success: boolean;
  total?: number;
}

export async function getPurchaseRequisitionPage(params: PurchaseQueryParams) {
  return requestClient.get<PurchasePageResult<PurchaseRequisitionRow>>(
    '/purchase/requisitions',
    { params, responseReturn: 'body' },
  );
}

export async function getPurchaseOrderPage(params: PurchaseOrderQueryParams) {
  return requestClient.get<PurchasePageResult<PurchaseOrderRow>>(
    '/purchase/orders',
    { params, responseReturn: 'body' },
  );
}
