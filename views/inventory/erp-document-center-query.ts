/**
 * ERP 单据中心（`wms-erp-documents.vue`）的查询与指标纯函数。
 *
 * 抽出来是为了能单测 —— 页面组件里的 computed 测不了，而这里两件事都容易写错：
 * priority→formIds 的翻译、以及"哪些指标能由 SQL 聚合给出"的边界。
 */

/**
 * 本文件**刻意不导入 `#/api/wms`**，连 `import type` 也不写。
 *
 * 同目录的 spec 一旦跨应用层导入，vitest 会解析 `wms.ts` 的整条依赖链
 * （requestClient → element-plus → css），spec 在 import 期整体崩溃 ——
 * 症状是用例一个都不执行（不是失败，是根本没跑，很容易误判成"测试通过"）。
 *
 * 代价是这两个结构在此重复声明。它们与 `wms.ts` 的同名接口保持结构兼容即可
 * （TypeScript 是结构类型），漂移会在页面组件里作为类型错误暴露。
 */

/** 结构对应 `wms.ts` 的 `WmsErpDocumentRegistration`，只取本模块用到的字段。 */
export interface DocumentRegistrationLike {
  capabilities?: readonly string[];
  formId: string;
  priority?: string;
}

/** 结构对应 `wms.ts` 的 `WmsErpDocumentSummaryRow`。 */
export interface DocumentSummaryRowLike {
  actionableCount?: number;
  count: number;
  formId?: string;
  wmsStatus?: string;
}

/**
 * 把 priority 过滤翻译成 formId 集合。
 *
 * ## 为什么要翻译而不是下推 priority
 *
 * `priority` **不是数据库列**。它由后端 `WmsErpDocumentService.toView` 从
 * `WmsErpDocumentRegistryService` 的内存注册表现算（`view.put("priority",
 * registration.priority())`），SQL 完全不知道它的存在。
 *
 * 但它是 formId 的**纯函数** —— 注册表里 `register(map, "PUR_ReceiveBill", ..., "P1", ...)`
 * 一次性把二者绑定。所以「筛 P1」等价于「筛 P1 对应的那批 formId」，
 * 而 formId 是真实列、能下推、有索引。
 *
 * 这样注册表仍是唯一真相：把 priority 落库会制造第二份真相，
 * 注册表每改一次就要配一次回填迁移。
 *
 * @param registrations 注册表（`/wms/erp-document-registrations` 的返回值）
 * @param priority 选中的优先级，空串表示不过滤
 * @param explicitFormId 用户在「单据类型」下拉里另选的 formId，与 priority 取交集
 * @returns 要下推的 formId 数组；`null` 表示不加 formId 条件
 */
export function resolveFormIdFilter(
  registrations: DocumentRegistrationLike[],
  priority: string,
  explicitFormId: string,
): null | string[] {
  // 显式选了单据类型：它比 priority 更具体。
  // 若二者冲突（选了 P0 又选了一个 P1 的单据类型），以显式选择为准并返回它 ——
  // 返回空数组会让页面显示"无数据"，用户看不出是自己的两个条件互斥。
  if (explicitFormId) return [explicitFormId];
  if (!priority) return null;
  const matched = registrations
    .filter((item) => item.priority === priority)
    .map((item) => item.formId);
  // 注册表里没有该 priority 时返回 null（不过滤）而不是空数组：
  // 空数组下推给 JPQL 的 `IN ()` 在 Hibernate 里是语法错误，
  // 而 service 层的归一（`formIds.isEmpty() ? null`）会把它变成"不过滤" ——
  // 两边行为一致，但在这里就返回 null 更直白。
  return matched.length > 0 ? matched : null;
}

/** 单据中心的指标卡计数。 */
export interface DocumentCenterMetrics {
  /** 可作业（`available_qty > 0`）。SQL 聚合给出 */
  actionable: number;
  /** ERP 同步失败。SQL 聚合给出（wmsStatus 是真实列） */
  failed: number;
  /** 已生成 WMS 任务。SQL 聚合给出 */
  taskCreated: number;
  /** 镜像单据总数 */
  total: number;
}

/**
 * 由服务端分组结果算指标。
 *
 * ## 哪些指标改用了 SQL 聚合，哪些指标被去掉了
 *
 * 改造前这几个数字是遍历**全量** `documents.value` 算的（页面拉全表）。
 * 服务端分页后手上只有当前页，那样算出来是"本页统计"。
 *
 * 能保留的：`total` / `actionable` / `failed` / `taskCreated` ——
 * 判据全部落在真实列（`count` / `available_qty` / `wms_status`）。
 *
 * **去掉的：`可生成任务` 与 `暂缓闭环`**。它们原先按
 * `hasCapability(item, 'WMS_TASK')` / `'DEFERRED'` 算，而 capabilities
 * 和 priority 一样来自内存注册表，SQL 聚合不出来。
 *
 * 它们不是"算不出"而是"不该由这里算"：capability 是 formId 的纯函数，
 * 「有多少张单据可生成任务」等于「可生成任务的那批 formId 各有多少张」——
 * 这是 formId 分组结果穿过注册表的映射，见 `countByCapability`。
 */
export function summariseDocumentCenter(
  rows: DocumentSummaryRowLike[],
): DocumentCenterMetrics {
  let total = 0;
  let actionable = 0;
  let failed = 0;
  let taskCreated = 0;
  for (const row of rows) {
    const n = Number(row.count) || 0;
    total += n;
    actionable += Number(row.actionableCount) || 0;
    if (row.wmsStatus === 'ERP_FAILED') failed += n;
    if (row.wmsStatus === 'TASK_CREATED') taskCreated += n;
  }
  return { actionable, failed, taskCreated, total };
}

/**
 * 数出具备某 capability 的单据张数：formId 分组结果穿过注册表映射。
 *
 * 这就是「capability/priority 不落库」的兑现方式 —— 后端零改动，
 * 注册表保持唯一真相，而计数仍然是全量的（分组结果覆盖全表，不是当前页）。
 *
 * 注册表里查不到的 formId 直接跳过：那种单据类型未注册，
 * 谈论它的 capability 没有意义（后端 `registryService.require` 也会拒绝它）。
 */
export function countByCapability(
  rows: DocumentSummaryRowLike[],
  registrations: DocumentRegistrationLike[],
  capability: string,
): number {
  const formIds = new Set(
    registrations
      .filter((item) => (item.capabilities || []).includes(capability))
      .map((item) => item.formId),
  );
  return rows.reduce(
    (sum, row) => (row.formId && formIds.has(row.formId) ? sum + (Number(row.count) || 0) : sum),
    0,
  );
}
