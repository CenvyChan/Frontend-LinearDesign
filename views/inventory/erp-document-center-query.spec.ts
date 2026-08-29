import { describe, expect, it } from 'vitest';

import type { DocumentRegistrationLike, DocumentSummaryRowLike } from './erp-document-center-query';

import {
  countByCapability,
  resolveFormIdFilter,
  summariseDocumentCenter,
} from './erp-document-center-query';

/**
 * 只用相对导入 —— 跨应用层导入 `#/api` 会把 element-plus 的 css 拉进来，
 * spec 在 import 期整体崩溃且用例一个都不执行。
 */

const REGISTRATIONS: DocumentRegistrationLike[] = [
  { formId: 'PRD_PickMtrl', priority: 'P0', capabilities: ['WMS_TASK', 'ERP_PUSH'] },
  { formId: 'PRD_MORPT', priority: 'P0', capabilities: ['WMS_TASK'] },
  { formId: 'PUR_ReceiveBill', priority: 'P1', capabilities: ['WMS_TASK'] },
  { formId: 'STK_TransferDirect', priority: 'P2', capabilities: [] },
  { formId: 'AR_receivable', priority: 'P3', capabilities: ['DEFERRED'] },
];

describe('resolveFormIdFilter', () => {
  /**
   * priority 不是数据库列（后端从内存注册表现算），但它是 formId 的纯函数，
   * 所以筛 P0 等价于筛 P0 那批 formId —— 那是真实列、能下推、有索引。
   */
  it('把 priority 翻译成对应的 formId 集合', () => {
    expect(resolveFormIdFilter(REGISTRATIONS, 'P0', '')).toEqual([
      'PRD_PickMtrl',
      'PRD_MORPT',
    ]);
  });

  /** 不选 priority 时返回 null（不加 formId 条件），不是空数组。 */
  it('无 priority 时不加过滤条件', () => {
    expect(resolveFormIdFilter(REGISTRATIONS, '', '')).toBeNull();
  });

  /**
   * 注册表里没有该 priority 时也返回 null。
   *
   * 空数组会走到 JPQL 的 `IN ()` —— 那在 Hibernate 里是语法错误。
   * service 层的 `formIds.isEmpty() ? null` 虽然会兜住，但在这里就返回 null 更直白。
   */
  it('无匹配 priority 时返回 null 而不是空数组', () => {
    expect(resolveFormIdFilter(REGISTRATIONS, 'P9', '')).toBeNull();
  });

  /** 显式选了单据类型时它更具体，压过 priority。 */
  it('显式 formId 压过 priority', () => {
    expect(resolveFormIdFilter(REGISTRATIONS, 'P0', 'PUR_ReceiveBill')).toEqual([
      'PUR_ReceiveBill',
    ]);
  });

  /**
   * 两个条件互斥时不返回空数组。
   *
   * 选了「P0」又选了一个 P1 的单据类型，交集为空 —— 但返回空数组会让页面
   * 显示"无数据"，用户看不出是自己的两个条件打架。以显式选择为准更好解释。
   */
  it('priority 与显式 formId 互斥时以显式选择为准', () => {
    const result = resolveFormIdFilter(REGISTRATIONS, 'P0', 'AR_receivable');
    expect(result).toEqual(['AR_receivable']);
    expect(result).not.toEqual([]);
  });
});

describe('summariseDocumentCenter', () => {
  const ROWS: DocumentSummaryRowLike[] = [
    { formId: 'PUR_ReceiveBill', wmsStatus: 'ERP_SYNCED', count: 976, actionableCount: 22 },
    { formId: 'PUR_ReceiveBill', wmsStatus: 'TASK_CREATED', count: 12, actionableCount: 6 },
    { formId: 'PRD_PickMtrl', wmsStatus: 'ERP_FAILED', count: 3, actionableCount: 3 },
  ];

  /** 四个指标的判据全部落在真实列，所以能由 SQL 聚合给出。 */
  it('按真实列聚合出四个指标', () => {
    expect(summariseDocumentCenter(ROWS)).toEqual({
      actionable: 31,
      failed: 3,
      taskCreated: 12,
      total: 991,
    });
  });

  it('空分组返回全 0 而不是 NaN', () => {
    expect(summariseDocumentCenter([])).toEqual({
      actionable: 0,
      failed: 0,
      taskCreated: 0,
      total: 0,
    });
  });

  /**
   * actionable 与 total 是两个独立基准，服务端各自给出。
   * 缺 actionableCount 时按 0 计，不能退化成 count。
   */
  it('缺 actionableCount 时按 0 计，不退化成 count', () => {
    const counts = summariseDocumentCenter([{ formId: 'X', wmsStatus: 'ERP_SYNCED', count: 50 }]);
    expect(counts.total).toBe(50);
    expect(counts.actionable).toBe(0);
  });
});

describe('countByCapability', () => {
  const ROWS: DocumentSummaryRowLike[] = [
    { formId: 'PRD_PickMtrl', wmsStatus: 'ERP_SYNCED', count: 10 },
    { formId: 'PUR_ReceiveBill', wmsStatus: 'ERP_SYNCED', count: 976 },
    { formId: 'STK_TransferDirect', wmsStatus: 'ERP_SYNCED', count: 5 },
    { formId: 'AR_receivable', wmsStatus: 'ERP_SYNCED', count: 7 },
  ];

  /**
   * 这是「capability 不落库」的兑现方式：分组结果穿过注册表映射，后端零改动。
   * 计数仍是全量的 —— 分组行覆盖全表，不是当前页。
   */
  it('把 formId 分组结果穿过注册表数出具备该 capability 的张数', () => {
    expect(countByCapability(ROWS, REGISTRATIONS, 'WMS_TASK')).toBe(986);
    expect(countByCapability(ROWS, REGISTRATIONS, 'DEFERRED')).toBe(7);
  });

  /** 没有任何 formId 具备该 capability 时返回 0。 */
  it('无匹配 capability 时返回 0', () => {
    expect(countByCapability(ROWS, REGISTRATIONS, 'NOT_A_CAPABILITY')).toBe(0);
  });

  /**
   * 注册表里查不到的 formId 直接跳过，不能计入。
   * 那种单据类型未注册，后端 `registryService.require` 也会拒绝它。
   */
  it('未注册的 formId 不计入', () => {
    const withUnknown = [...ROWS, { formId: 'UNKNOWN_FORM', wmsStatus: 'ERP_SYNCED', count: 999 }];
    expect(countByCapability(withUnknown, REGISTRATIONS, 'WMS_TASK')).toBe(986);
  });
});
