import { requestClient } from '#/api/request';

/**
 * ERP 上游单据同步游标的运维接口。
 *
 * 所有函数用 `responseReturn: 'body'`：响应拦截器对任意 2xx 原样返回 body，
 * **不会在 `success: false` 时 reject**。每个调用点都必须自己判 `res.success`，
 * 否则业务错误会被静默吞掉（页面看起来"什么都没发生"）。
 */

export interface ErpSourceNoticeCursorItem {
  id: number;
  erpAcctCode: string;
  /** 游标唯一键含组织号，多组织时缺一行游标就静默漏掉一个组织的单据，所以必须显示。 */
  erpOrgNumber: string;
  formId: string;
  formLabel: string;
  syncEnabled: boolean;
  lastModifyTime?: string;
  lastFid?: number;
  lastSuccessTime?: number;
  lastError?: string;
}

export interface ErpSourceNoticeFormIdItem {
  formId: string;
  label: string;
}

export interface ErpSourceNoticeRunResult {
  rounds: number;
  processedDocuments: number;
  processedLines: number;
  lastModifyTime?: string;
  lastFid?: number;
}

interface Envelope<T> {
  data: T;
  message?: string;
  success: boolean;
}

/**
 * 水位是本地时间、**不带 Z 或时区偏移**（带了会被后端 400 拒收）。
 *
 * 界面上用 `el-date-picker` 的 `value-format` 生成，不让用户手写 —— 这个形状是后端水位
 * 比较协议（纯字符串 compareTo）的产物，不该暴露成人机界面。后端另有兜底归一：
 * 只填日期补零点、空格分隔换 T、剥掉照抄的方括号；唯一 fail closed 的是时区。
 *
 * 毫秒位数不限 —— ERP 实测同时返回 `.427`（三位）与 `.59`（两位，K3Cloud 不补零）。
 */
export const ERP_SOURCE_NOTICE_WATERMARK_FLOOR = '1970-01-01T00:00:00.000';

export async function getErpSourceNoticeCursors(erpAcctCode?: string) {
  // query 参数必须放在第三参 config 的 params 里。展开到 config 顶层（如 api/erpOperatorMapping.ts
  // 的写法）参数根本不会被发出去，后端收到的是"查全部"。
  return requestClient.get<Envelope<ErpSourceNoticeCursorItem[]>>(
    '/erp-operations/source-notices/cursors',
    { params: erpAcctCode ? { erpAcctCode } : {}, responseReturn: 'body' },
  );
}

export async function getErpSourceNoticeFormIds() {
  return requestClient.get<Envelope<ErpSourceNoticeFormIdItem[]>>(
    '/erp-operations/source-notices/form-ids',
    { responseReturn: 'body' },
  );
}

export async function createErpSourceNoticeCursor(data: {
  erpAcctCode: string;
  erpOrgNumber: string;
  formId: string;
  /** 留空 = 从 1970 拉全量。 */
  lastModifyTime?: string;
}) {
  return requestClient.post<Envelope<ErpSourceNoticeCursorItem>>(
    '/erp-operations/source-notices/cursors',
    data,
    { responseReturn: 'body' },
  );
}

export async function updateErpSourceNoticeWatermark(
  id: number,
  data: { lastModifyTime?: string; lastFid?: number },
) {
  return requestClient.post<Envelope<ErpSourceNoticeCursorItem>>(
    `/erp-operations/source-notices/cursors/${id}/watermark`,
    data,
    { responseReturn: 'body' },
  );
}

export async function setErpSourceNoticeSyncEnabled(id: number, syncEnabled: boolean) {
  return requestClient.post<Envelope<ErpSourceNoticeCursorItem>>(
    `/erp-operations/source-notices/cursors/${id}/sync-enabled`,
    { syncEnabled },
    { responseReturn: 'body' },
  );
}

export async function runErpSourceNoticeCursor(id: number, maxRounds?: number) {
  return requestClient.post<Envelope<ErpSourceNoticeRunResult>>(
    `/erp-operations/source-notices/cursors/${id}/run`,
    { maxRounds },
    { responseReturn: 'body' },
  );
}
