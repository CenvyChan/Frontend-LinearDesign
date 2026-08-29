/**
 * ERP 业务链路的展示预设。
 *
 * 把「销售发货」「采购收料」这类单据作业页之间的差异收敛到一处，让页面组件保持一份。
 * 差异不只是文案 —— 链路的**节点数**就不同：
 *
 * - 销售发货 2 段：SAL_DELIVERYNOTICE(通知) → SAL_OUTSTOCK(出库)
 * - 采购收料 3 段：PUR_ReceiveBill(通知) → QM_InspectBill(检验) → STK_InStock(入库)
 *
 * 所以 stage 下拉与 stageLabel 必须按链路给，不能共用一份写死 NOTICE/OUTSTOCK 的映射
 * （那会让采购收料的检验阶段单据显示成原始英文枚举值）。
 */

/** 后端 `WmsBusinessChainType` 里本页支持的取值。 */
export type ErpChainKey =
  | 'PURCHASE_INSPECTION_RETURN'
  | 'PURCHASE_RECEIVE'
  | 'PURCHASE_STOCK_RETURN'
  | 'SALES_DELIVERY'
  | 'SALES_RETURN';

export interface ErpChainStage {
  /** 后端 `WmsBusinessStage` 枚举值 */
  value: string;
  label: string;
}

export interface ErpChainPreset {
  chainType: ErpChainKey;
  /** 页面标题与副标题 */
  title: string;
  subtitle: string;
  /** 表格第一列的表头，如「发货单据」「收料单据」 */
  documentColumnLabel: string;
  /** 推进按钮文案。销售发货是「生成出库」，采购收料是「生成收货任务」 */
  dispatchLabel: string;
  /**
   * 属于本链路的 formId（作为 `formId` 逗号分隔多值下推服务端）。
   *
   * ⚠️ **它不再是唯一判据** —— 四条链路里有两组 formId 是共用的：`QM_InspectBill` 同时服务
   * 采购检验与销售退货检验（K3Cloud 只有一张检验单），`PUR_MRB` 同时服务检验退料与库存退料
   * （只是源单不同）。区分靠 {@link ErpChainPreset.chainTypes}。
   *
   * formIds 的价值在于**兜住老单据**：`business_chain_type` 列比链路概念晚引入，
   * 存量单据该列为 null，只按 chainType 过滤会让它们整批消失。两个维度缺一不可。
   */
  formIds: string[];
  /**
   * 属于本链路的 `businessChainType`（逗号分隔多值下推服务端）。
   *
   * 这是**四条链路真正的区分键**。通常只有一个值，采购收料例外 —— 见该 preset 的注释。
   */
  chainTypes: string[];
  /** 链路的通知单 formId，用于「待推进」计数 */
  noticeFormId: string;
  /** 业务阶段下拉与标签，按链路节点给 */
  stages: ErpChainStage[];
  /**
   * 业务类型下拉选项。采购分「采购/委外」，销售分「标准/寄售」。
   *
   * 文案与 `erp-business-type.ts` 的映射保持一致（有 spec 钉住）。
   * 不参与本业务的类型不进下拉 —— 如资产采购 ZCCG 的可作业量恒为 0，
   * 放进来只会给出一个永远筛不到东西的选项。
   */
  businessTypes: ErpChainStage[];
  /**
   * 打开页面时是否默认只看可作业（`available_qty > 0`）。
   *
   * 采购收料 true：实测 1332 张里 97.7% 是 ERP 侧已闭环的历史单据，
   * 默认显示全部等于让用户在 1332 张里找那 30 张。
   * 销售发货 false：暂无存量补录，全量本就只有个位数。
   *
   * ⚠️ 这只是 UI 默认值。HTTP 端点的 `actionableOnly` 默认 false —— 见
   * `WmsOperationController.listDocuments` 注释，两处不同是刻意的。
   */
  defaultActionableOnly: boolean;
  /** 指标卡文案：单据总数、待推进、完成态 */
  totalLabel: string;
  pendingLabel: string;
  doneLabel: string;
  /** 「可作业」指标卡的文案，如「可收货」「可发货」 */
  actionableLabel: string;
  /** 完成态对应的 wmsStatus。两条链路目前都是 WMS_POSTED，留字段是因为语义属于链路而非页面 */
  doneStatus: string;
}

const PRESETS: Record<ErpChainKey, ErpChainPreset> = {
  PURCHASE_RECEIVE: {
    chainType: 'PURCHASE_RECEIVE',
    title: '采购收料',
    subtitle: '从收料通知单到检验、入库，跟踪到货数量、WMS 作业与异常。',
    documentColumnLabel: '收料单据',
    dispatchLabel: '生成收货任务',
    // QM_InspectBill 同时服务采购与销售检验（K3Cloud 只有一张检验单），
    // 归到采购侧是因为销售侧的检验实测 0/4598 未启用。
    formIds: ['PUR_ReceiveBill', 'QM_InspectBill', 'STK_InStock'],
    chainTypes: ['PURCHASE_RECEIVE'],
    noticeFormId: 'PUR_ReceiveBill',
    stages: [
      { value: 'NOTICE', label: '收料通知' },
      { value: 'INSPECTION', label: '检验中' },
      { value: 'INSTOCK', label: '采购入库' },
    ],
    // ZCCG（资产采购）刻意不进下拉：它不参与收料业务，可作业量恒为 0
    businessTypes: [
      { value: 'CG', label: '采购' },
      { value: 'WW', label: '委外' },
    ],
    // 存量 97.7% 是 ERP 侧已闭环的历史单据，默认全量等于让人在 1332 张里找 30 张
    defaultActionableOnly: true,
    totalLabel: '收料单据',
    pendingLabel: '待收货',
    actionableLabel: '可收货',
    doneLabel: '已完成入库',
    doneStatus: 'WMS_POSTED',
  },
  SALES_DELIVERY: {
    chainType: 'SALES_DELIVERY',
    title: '销售发货',
    subtitle: '从发货通知单到销售出库，统一跟踪可发货数量、WMS 作业与异常。',
    documentColumnLabel: '发货单据',
    dispatchLabel: '生成出库',
    formIds: ['SAL_DELIVERYNOTICE', 'SAL_OUTSTOCK'],
    chainTypes: ['SALES_DELIVERY'],
    noticeFormId: 'SAL_DELIVERYNOTICE',
    stages: [
      { value: 'NOTICE', label: '发货通知' },
      { value: 'OUTSTOCK', label: '销售出库' },
    ],
    businessTypes: [
      { value: 'NORMAL', label: '标准' },
      { value: 'CONSIGNMENT', label: '寄售' },
    ],
    // 暂无存量补录（游标还没建），全量本就只有个位数，默认过滤会让人以为页面空的
    defaultActionableOnly: false,
    totalLabel: '发货单据',
    pendingLabel: '待生成出库',
    actionableLabel: '可发货',
    doneLabel: '已完成出库',
    doneStatus: 'WMS_POSTED',
  },
  PURCHASE_INSPECTION_RETURN: {
    chainType: 'PURCHASE_INSPECTION_RETURN',
    title: '检验退料',
    subtitle: '来料检验判退的物料退回供应商。判退量在检验录入时自动生成退料任务。',
    documentColumnLabel: '退料单据',
    dispatchLabel: '生成退料单',
    // 源单是收料通知单（货还没入库），目标是 PUR_MRB。
    // PUR_MRB 与「库存退料」共用，靠 chainTypes 区分。
    formIds: ['PUR_ReceiveBill', 'PUR_MRB'],
    chainTypes: ['PURCHASE_INSPECTION_RETURN'],
    noticeFormId: 'PUR_ReceiveBill',
    stages: [
      { value: 'INSPECTION', label: '检验判退' },
      { value: 'INSTOCK', label: '退料出厂' },
    ],
    businessTypes: [
      { value: 'CG', label: '采购' },
      { value: 'WW', label: '委外' },
    ],
    // 判退是低频事件，全量本就不多，默认过滤会让人以为页面是空的
    defaultActionableOnly: false,
    totalLabel: '退料单据',
    pendingLabel: '待退料',
    actionableLabel: '可退料',
    doneLabel: '已退回供应商',
    doneStatus: 'WMS_POSTED',
  },
  PURCHASE_STOCK_RETURN: {
    chainType: 'PURCHASE_STOCK_RETURN',
    title: '库存退料',
    subtitle: '已入库物料退回供应商。与检验退料的区别是货已实际入库，需要完整库存维度。',
    documentColumnLabel: '退料单据',
    dispatchLabel: '生成退料单',
    // 源单是采购入库单（货已入库），规则 STK_InStock-PUR_MRB。
    formIds: ['STK_InStock', 'PUR_MRB'],
    chainTypes: ['PURCHASE_STOCK_RETURN'],
    noticeFormId: 'STK_InStock',
    stages: [
      { value: 'INSTOCK', label: '已入库' },
      { value: 'COMPLETED', label: '退料出厂' },
    ],
    businessTypes: [
      { value: 'CG', label: '采购' },
      { value: 'WW', label: '委外' },
    ],
    defaultActionableOnly: false,
    totalLabel: '退料单据',
    pendingLabel: '待退料',
    actionableLabel: '可退料',
    doneLabel: '已退回供应商',
    doneStatus: 'WMS_POSTED',
  },
  SALES_RETURN: {
    chainType: 'SALES_RETURN',
    title: '销售退货',
    subtitle: '客户退货入库。退货通知单可带检验环节，检验合格后生成退货入库单。',
    documentColumnLabel: '退货单据',
    dispatchLabel: '生成退货入库',
    // QM_InspectBill 与采购收料共用（K3Cloud 只有一张检验单），靠 chainTypes 区分。
    formIds: ['SAL_RETURNNOTICE', 'QM_InspectBill', 'SAL_RETURNSTOCK'],
    chainTypes: ['SALES_RETURN'],
    noticeFormId: 'SAL_RETURNNOTICE',
    stages: [
      { value: 'NOTICE', label: '退货通知' },
      { value: 'INSPECTION', label: '退货检验' },
      // 退货是收货方向，与发货相反 —— 沿用 OUTSTOCK 会让方向和转换规则全错
      { value: 'INSTOCK', label: '退货入库' },
    ],
    businessTypes: [
      { value: 'NORMAL', label: '标准' },
      { value: 'CONSIGNMENT', label: '寄售' },
    ],
    // 游标刚建、存量待补，默认过滤会让人以为页面是空的
    defaultActionableOnly: false,
    totalLabel: '退货单据',
    pendingLabel: '待入库',
    actionableLabel: '可入库',
    doneLabel: '已完成入库',
    doneStatus: 'WMS_POSTED',
  },
};

export function chainPreset(key: ErpChainKey): ErpChainPreset {
  return PRESETS[key];
}

/**
 * 把后端 `blockReasons` 的一项翻成人话：`INSPECTION_PENDING:CGSL-001` → `待检验（CGSL-001）`。
 *
 * 后端 `WmsErpBusinessChainService.documentBlockReasons` 给的是 `枚举:单号` 形式的机器可读串
 *（链路卡口的单一规则源）。翻译放前端符合既有原则：**闸门只有一处，解释可以在别处** ——
 * 后端不该同时负责判定和文案。
 *
 * 未知枚举原样回显而不是显示空白：ERP 侧或后端新增阻塞原因时，宁可让用户看到英文码去问，
 * 也不要让提示框里什么都没有。
 */
export function blockReasonLabel(reason: string): string {
  const [code = '', billNo = ''] = reason.split(':');
  const map: Record<string, string> = {
    CHAIN_BLOCKED: '链路阻塞',
    INSPECTION_PENDING: '待检验',
    INSPECTION_REJECTED: '检验判退',
    NO_AVAILABLE_QTY: '无可执行数量',
    UPSTREAM_NOT_READY: '上游未就绪',
  };
  const label = map[code] || code;
  return billNo ? `${label}（${billNo}）` : label;
}

/** 阶段中文名。BLOCKED 是所有链路共有的终止态，不进各自的 stages 列表。 */
export function stageLabel(preset: ErpChainPreset, stage?: string): string {
  if (stage === 'BLOCKED') return '已阻塞';
  if (stage === 'COMPLETED') return '已完成';
  return preset.stages.find((item) => item.value === stage)?.label || stage || '-';
}

/**
 * 关键字命中的字段。
 *
 * **必须与后端 `WmsErpDocumentRepository#search` 的 JPQL 保持一致** ——
 * 过滤已全部下推服务端，这份常量现在只作为「契约备忘」：改了服务端就来改这里，
 * 有 `WmsErpDocumentSearchQueryShapeTest` 钉住后端那侧的五个字段。
 * 两处漂移的症状是"第 1 页搜得到、翻页后消失"。
 */
export const KEYWORD_FIELDS = ['billNo', 'formId', 'sourceBillNo', 'stockNumber', 'stockName'] as const;

/** 服务端 `/wms/erp-documents/summary` 返回的分组行。 */
export interface ChainSummaryRow {
  /** 该分组里 `available_qty > 0` 的行数，由 SQL 的 SUM(CASE WHEN ...) 给出 */
  actionableCount?: number;
  businessType?: string;
  count: number;
  formId?: string;
  wmsStatus?: string;
}

export interface ChainMetricCounts {
  /**
   * 可作业数（`available_qty > 0`）。与 total 是**两个独立基准** ——
   * 实测 1332 张里只有 30 张可作业，两个数一起显示才能既看到待办又不失去全局感。
   */
  actionable: number;
  done: number;
  inProgress: number;
  pending: number;
  total: number;
}

const IN_PROGRESS_STATUSES = new Set(['OPERATING', 'RESERVED', 'TASK_CREATED']);

/**
 * 把服务端的分组计数折成指标卡的四个数字。
 *
 * **为什么折叠在前端做**：「哪个 formId 算待推进」「哪些 businessType 不参与本业务」
 * 都是展示层语义（noticeFormId / OUT_OF_SCOPE）。搬到后端会让同一套判据两地维护，
 * 正是 ZCCG 那次刻意避开的坑 —— 闸门只能有一处，解释可以在别处，
 * 但不能两处各自定义"什么算待处理"。
 *
 * @param isOutOfScope 注入而非直接 import：让这个纯函数不依赖 erp-business-type，
 *                     测试可以独立构造判据，也避免两个模块循环引用。
 */
export function summariseChainMetrics(
  preset: ErpChainPreset,
  rows: ChainSummaryRow[],
  isOutOfScope: (formId?: string, businessType?: string) => boolean,
): ChainMetricCounts {
  let total = 0;
  let actionable = 0;
  let pending = 0;
  let inProgress = 0;
  let done = 0;
  for (const row of rows) {
    const n = Number(row.count) || 0;
    total += n;
    // 可作业数由服务端 SUM(CASE WHEN available_qty > 0) 给出，前端只累加。
    // 不在前端按 availableQty 判断：分页后手上只有当前页，那样算出来是"本页统计"。
    actionable += Number(row.actionableCount) || 0;
    if (row.formId === preset.noticeFormId && !isOutOfScope(row.formId, row.businessType)) {
      pending += n;
    }
    if (IN_PROGRESS_STATUSES.has(row.wmsStatus || '')) {
      inProgress += n;
    }
    if (row.wmsStatus === preset.doneStatus) {
      done += n;
    }
  }
  return { actionable, done, inProgress, pending, total };
}
