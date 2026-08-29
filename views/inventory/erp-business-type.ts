/**
 * ERP 单据业务类型的展示文案。
 *
 * **按 formId 分派，不能用单一 map。** 两个单据的取值域没有交集但语义完全不同：
 * 发货通知单是 `NORMAL`/`CONSIGNMENT`（标准/寄售），采购收料单是 `CG`/`WW`（标准采购/委外入库）。
 * 合成一张表以后，将来 ERP 任一侧新增取值就可能撞车，一个单据的文案会污染另一个。
 */

const SALES_DELIVERY_LABELS: Record<string, string> = {
  CONSIGNMENT: '寄售',
  NORMAL: '标准',
};

const PURCHASE_RECEIVE_LABELS: Record<string, string> = {
  CG: '采购',
  WW: '委外',
  // 资产采购。2026-08-27 探活确认：账套里这 5 张的 FBillTypeID.FNumber 全是 SLD04_SYS
  // 「资产接收单」，后端 ErpSourceNoticeSyncService 按该单据类型直接置 BLOCKED。
  // 资产接收不进收料业务、后续不生成采购入库单，所以它出现在列表里是"仅供追溯"。
  ZCCG: '资产采购',
};

/**
 * 不参与本单据业务流程的业务类型 —— 同步进来只为可追溯，不会生成 WMS 任务。
 *
 * 与「非标准流程」（委外/寄售）是两回事：那些要处理，只是流程不同；这些根本不用管。
 * 判据留在前端是刻意的：后端已经用单据类型（SLD04_SYS）拦住了，这里只负责**解释**，
 * 不构成第二道业务闸门 —— 两处各自判断迟早漂移，真正的闸门只能有一个。
 */
const OUT_OF_SCOPE_BY_FORM_ID: Record<string, string[]> = {
  PUR_ReceiveBill: ['ZCCG'],
};

/** 该业务类型是否不参与本单据的业务流程（用于给出"无需处理"的解释）。 */
export function isOutOfScopeBusinessType(formId?: string, businessType?: string): boolean {
  const value = (businessType ?? '').trim().toUpperCase();
  if (!value) return false;
  return (OUT_OF_SCOPE_BY_FORM_ID[(formId ?? '').trim()] ?? []).includes(value);
}

const LABELS_BY_FORM_ID: Record<string, Record<string, string>> = {
  PUR_ReceiveBill: PURCHASE_RECEIVE_LABELS,
  SAL_DELIVERYNOTICE: SALES_DELIVERY_LABELS,
};

/**
 * @returns 中文文案；formId 不认识或取值不认识时返回原值（而不是空串），
 * 这样 ERP 新增取值时页面显示的是原始码而非一片空白，便于定位。
 */
export function businessTypeLabel(formId?: string, businessType?: string): string {
  const value = (businessType ?? '').trim();
  if (!value) {
    return '';
  }
  const labels = LABELS_BY_FORM_ID[(formId ?? '').trim()];
  if (!labels) {
    return value;
  }
  return labels[value.toUpperCase()] ?? value;
}

/**
 * 每个单据各自的「非标准流程」取值。同样按 formId 分派，理由与 label 一致：
 * 若将来某单据的 `WW` 表示别的含义，不会被误标成非标准。
 */
const NON_STANDARD_BY_FORM_ID: Record<string, string> = {
  PUR_ReceiveBill: 'WW',
  SAL_DELIVERYNOTICE: 'CONSIGNMENT',
};

/**
 * el-tag 的配色，三档语义：
 * - `info` 标准流程，不抢眼
 * - `warning` 非标准流程（委外/寄售）——**要处理**，只是流程不同
 * - `danger` 不参与本业务（资产采购）——**不用处理**，同步进来仅供追溯
 *
 * 资产采购不用 warning：那会和委外混在一起，让人以为它也要收料。
 */
export function businessTypeTagType(formId?: string, businessType?: string): 'danger' | 'info' | 'warning' {
  const value = (businessType ?? '').trim().toUpperCase();
  if (isOutOfScopeBusinessType(formId, value)) {
    return 'danger';
  }
  return NON_STANDARD_BY_FORM_ID[(formId ?? '').trim()] === value ? 'warning' : 'info';
}
