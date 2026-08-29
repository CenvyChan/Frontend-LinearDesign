import type { ErpChainKey } from './erp-chain-preset';

import { describe, expect, it } from 'vitest';

import {
  KEYWORD_FIELDS,
  blockReasonLabel,
  chainPreset,
  stageLabel,
  summariseChainMetrics,
} from './erp-chain-preset';

/** 五条业务链路。新增链路时这里会强制补齐，避免新 preset 漏过跨链路的一致性断言。 */
const ALL_CHAINS = [
  'PURCHASE_RECEIVE',
  'PURCHASE_INSPECTION_RETURN',
  'PURCHASE_STOCK_RETURN',
  'SALES_DELIVERY',
  'SALES_RETURN',
] as const satisfies readonly ErpChainKey[];

describe('erp-chain-preset', () => {
  it('采购收料链路有检验节点，销售发货没有', () => {
    // 这是两条链路的核心结构差异：采购是 3 段（通知→检验→入库），销售是 2 段（通知→出库）。
    // 如果共用一份写死 NOTICE/OUTSTOCK 的映射，采购的检验阶段会显示成原始英文枚举值。
    expect(chainPreset('PURCHASE_RECEIVE').stages.map((s) => s.value))
      .toEqual(['NOTICE', 'INSPECTION', 'INSTOCK']);
    expect(chainPreset('SALES_DELIVERY').stages.map((s) => s.value))
      .toEqual(['NOTICE', 'OUTSTOCK']);
  });

  it('同一个 NOTICE 阶段在两条链路下文案不同', () => {
    expect(stageLabel(chainPreset('PURCHASE_RECEIVE'), 'NOTICE')).toBe('收料通知');
    expect(stageLabel(chainPreset('SALES_DELIVERY'), 'NOTICE')).toBe('发货通知');
  });

  it('检验阶段在采购链路有中文名，不能漏成英文枚举值', () => {
    expect(stageLabel(chainPreset('PURCHASE_RECEIVE'), 'INSPECTION')).toBe('检验中');
  });

  it('BLOCKED 与 COMPLETED 是跨链路共有的终止态', () => {
    // 它们不在各自 stages 列表里（下拉不该出现），但必须能翻译
    for (const key of ['PURCHASE_RECEIVE', 'SALES_DELIVERY'] as const) {
      expect(stageLabel(chainPreset(key), 'BLOCKED')).toBe('已阻塞');
      expect(stageLabel(chainPreset(key), 'COMPLETED')).toBe('已完成');
    }
  });

  it('未知阶段原样回显，不能变成空白', () => {
    // ERP 侧新增阶段时宁可显示英文值，也不要让单元格空着让人以为没数据
    expect(stageLabel(chainPreset('SALES_DELIVERY'), 'SOME_NEW_STAGE')).toBe('SOME_NEW_STAGE');
    expect(stageLabel(chainPreset('SALES_DELIVERY'), undefined)).toBe('-');
  });

  /**
   * formIds 是链路过滤的**唯一**判据（服务端按它过滤），所以必须完整。
   *
   * 早先前端另有 belongsToChain 用 businessChainType + formId 兜底，
   * 服务端过滤取代它之后已删除 —— 服务端按 formId 过滤天然覆盖了
   * "businessChainType 为 null 的老单据"这个场景，因为老单据的 formId 一直是有值的。
   */
  it('采购收料链路的三段单据都在 formIds 里', () => {
    expect(chainPreset('PURCHASE_RECEIVE').formIds)
      .toEqual(['PUR_ReceiveBill', 'QM_InspectBill', 'STK_InStock']);
    expect(chainPreset('SALES_DELIVERY').formIds)
      .toEqual(['SAL_DELIVERYNOTICE', 'SAL_OUTSTOCK']);
  });

  /**
   * **区分链路的键是 chainTypes，不是 formIds。**
   *
   * 这条断言原本是「formId 集合不重叠」，四个菜单下必然破 —— 有两组 formId 天生共用：
   * - `QM_InspectBill`：采购检验与销售退货检验共用（K3Cloud 只有一张检验单）
   * - `PUR_MRB`：检验退料与库存退料共用（只是源单不同：PUR_ReceiveBill vs STK_InStock）
   *
   * 所以判据换了维度而不是放宽：chainTypes 必须互不重叠，否则同一张单据会进两个菜单。
   */
  it('五条链路的 chainType 集合互不重叠，一张单据不会同时出现在两个页面', () => {
    const seen = new Map<string, ErpChainKey>();
    for (const key of ALL_CHAINS) {
      for (const chainType of chainPreset(key).chainTypes) {
        expect(
          seen.has(chainType),
          `${chainType} 同时属于 ${seen.get(chainType)} 与 ${key}`,
        ).toBe(false);
        seen.set(chainType, key);
      }
    }
  });

  /** 两组共用 formId 的链路必须靠 chainTypes 分开 —— 这是上一条断言存在的具体理由。 */
  it('共用 formId 的链路对确实靠 chainType 区分', () => {
    // QM_InspectBill 同时出现在采购收料与销售退货两条链路里
    expect(chainPreset('PURCHASE_RECEIVE').formIds).toContain('QM_InspectBill');
    expect(chainPreset('SALES_RETURN').formIds).toContain('QM_InspectBill');
    expect(chainPreset('PURCHASE_RECEIVE').chainTypes).not.toEqual(
      chainPreset('SALES_RETURN').chainTypes,
    );

    // PUR_MRB 同时出现在检验退料与库存退料两条链路里
    expect(chainPreset('PURCHASE_INSPECTION_RETURN').formIds).toContain('PUR_MRB');
    expect(chainPreset('PURCHASE_STOCK_RETURN').formIds).toContain('PUR_MRB');
    expect(chainPreset('PURCHASE_INSPECTION_RETURN').chainTypes).not.toEqual(
      chainPreset('PURCHASE_STOCK_RETURN').chainTypes,
    );
  });

  /** chainTypes 为空会让页面退化成只按 formId 过滤，混进别的链路的单据。 */
  it('每条链路都必须声明至少一个 chainType', () => {
    for (const key of ALL_CHAINS) {
      expect(chainPreset(key).chainTypes.length).toBeGreaterThan(0);
    }
  });

  it('noticeFormId 必须在自己的 formIds 里', () => {
    // 「待推进」计数按 noticeFormId 过滤，它若不在集合内会恒为 0
    for (const key of ALL_CHAINS) {
      const preset = chainPreset(key);
      expect(preset.formIds).toContain(preset.noticeFormId);
    }
  });

  /** 退货是收货方向。沿用发货的 OUTSTOCK 会让方向与后续转换规则全错。 */
  it('销售退货的阶段是入库方向而不是出库', () => {
    const stages = chainPreset('SALES_RETURN').stages.map((s) => s.value);
    expect(stages).toContain('INSTOCK');
    expect(stages).not.toContain('OUTSTOCK');
  });

  /**
   * 阻塞原因必须翻成人话。
   *
   * 用户实测看到的是 `UPSTREAM_NOT_READY:CGSL202608287541；INSPECTION_PENDING:CGSL202608287541`
   * —— 后端给的机器可读串被直接 join 后怼给用户看。
   */
  it('把阻塞原因的枚举串翻成中文并带上单号', () => {
    expect(blockReasonLabel('INSPECTION_PENDING:CGSL-001')).toBe('待检验（CGSL-001）');
    expect(blockReasonLabel('UPSTREAM_NOT_READY:CGSL-001')).toBe('上游未就绪（CGSL-001）');
    expect(blockReasonLabel('INSPECTION_REJECTED:CGSL-001')).toBe('检验判退（CGSL-001）');
    expect(blockReasonLabel('NO_AVAILABLE_QTY:CGSL-001')).toBe('无可执行数量（CGSL-001）');
    // 没有单号时不留空括号
    expect(blockReasonLabel('CHAIN_BLOCKED')).toBe('链路阻塞');
  });

  /** 未知枚举原样回显 —— 宁可让用户看到英文码去问，也不要提示框里什么都没有。 */
  it('未知阻塞原因原样回显而不是变成空白', () => {
    expect(blockReasonLabel('SOME_NEW_REASON:CGSL-001')).toBe('SOME_NEW_REASON（CGSL-001）');
    expect(blockReasonLabel('')).toBe('');
  });

  /**
   * 关键字字段是**前后端契约**：过滤已下推服务端（JPQL），这份常量只作备忘。
   *
   * 后端那侧由 `WmsErpDocumentSearchQueryShapeTest` 逐字段钉住。两处漂移的症状是
   * "第 1 页搜得到、翻页后消失"—— 因为服务端少搜一个字段，命中的行分布就变了。
   * 这条断言的作用是：改动这份常量时必须同时想到后端。
   */
  it('关键字字段与后端 JPQL 的五个字段一致', () => {
    expect([...KEYWORD_FIELDS])
      .toEqual(['billNo', 'formId', 'sourceBillNo', 'stockNumber', 'stockName']);
  });
});

describe('summariseChainMetrics', () => {
  const preset = chainPreset('PURCHASE_RECEIVE');
  /** 模拟 erp-business-type 的判据：资产采购不参与收料。注入而非 import，见函数注释。 */
  const outOfScope = (formId?: string, businessType?: string) =>
    formId === 'PUR_ReceiveBill' && businessType === 'ZCCG';

  /** 贴近 UB 真实分布的分组数据（2026-08-27 实测 CG 976 / WW 346 / ZCCG 6 / null 2）。 */
  const rows = [
    { formId: 'PUR_ReceiveBill', businessType: 'CG', wmsStatus: 'ERP_SYNCED', count: 900 },
    { formId: 'PUR_ReceiveBill', businessType: 'CG', wmsStatus: 'OPERATING', count: 50 },
    { formId: 'PUR_ReceiveBill', businessType: 'CG', wmsStatus: 'WMS_POSTED', count: 26 },
    { formId: 'PUR_ReceiveBill', businessType: 'WW', wmsStatus: 'ERP_SYNCED', count: 346 },
    { formId: 'PUR_ReceiveBill', businessType: 'ZCCG', wmsStatus: 'ERP_SYNCED', count: 6 },
    { formId: 'STK_InStock', businessType: null as unknown as string, wmsStatus: 'WMS_POSTED', count: 2 },
  ];

  it('total 是所有分组之和，含不参与本业务的单据', () => {
    // 总数要如实反映"这条链路里有多少单据"，包括资产接收单 —— 它们确实在库里
    expect(summariseChainMetrics(preset, rows, outOfScope).total).toBe(1330);
  });

  /**
   * 待推进要排除不参与本业务的单据。
   *
   * 900+50+26+346 = 1322 是通知单里的 CG/WW，ZCCG 那 6 张必须被排掉 ——
   * 否则数字永久偏高、看着像积压（那 6 张永远不会被处理）。
   */
  it('pending 排除 out-of-scope 的业务类型', () => {
    expect(summariseChainMetrics(preset, rows, outOfScope).pending).toBe(1322);
    // 反证：不排除时会多算那 6 张
    expect(summariseChainMetrics(preset, rows, () => false).pending).toBe(1328);
  });

  /** pending 只数通知单：STK_InStock 是执行单据，已经在链路末端，不算"待推进"。 */
  it('pending 只统计 noticeFormId，不含执行单据', () => {
    const onlyExecution = [{ formId: 'STK_InStock', wmsStatus: 'ERP_SYNCED', count: 10 }];
    expect(summariseChainMetrics(preset, onlyExecution, outOfScope).pending).toBe(0);
    expect(summariseChainMetrics(preset, onlyExecution, outOfScope).total).toBe(10);
  });

  it('inProgress 覆盖三个作业中状态', () => {
    const inFlight = [
      { formId: 'PUR_ReceiveBill', wmsStatus: 'OPERATING', count: 1 },
      { formId: 'PUR_ReceiveBill', wmsStatus: 'RESERVED', count: 2 },
      { formId: 'PUR_ReceiveBill', wmsStatus: 'TASK_CREATED', count: 4 },
      { formId: 'PUR_ReceiveBill', wmsStatus: 'ERP_SYNCED', count: 8 },
    ];
    expect(summariseChainMetrics(preset, inFlight, outOfScope).inProgress).toBe(7);
  });

  it('done 按 preset 的 doneStatus 统计', () => {
    expect(summariseChainMetrics(preset, rows, outOfScope).done).toBe(28);
  });

  /** count 可能是字符串（JSON 里的 long 或 BigInteger 序列化后形态不定），要能容忍。 */
  it('count 是字符串时也能累加而不是字符串拼接', () => {
    const stringy = [{ formId: 'PUR_ReceiveBill', wmsStatus: 'ERP_SYNCED', count: '5' as unknown as number }];
    expect(summariseChainMetrics(preset, stringy, outOfScope).total).toBe(5);
  });

  it('空分组返回全 0 而不是 NaN', () => {
    expect(summariseChainMetrics(preset, [], outOfScope))
      .toEqual({ actionable: 0, done: 0, inProgress: 0, pending: 0, total: 0 });
  });

  /**
   * actionable 与 total 是**两个独立基准**，由服务端各自给出。
   *
   * 实测 1332 张里只有 30 张可作业。前端不能自己按 availableQty 算 actionable ——
   * 分页后手上只有当前页 50 行，那样算出来是"本页统计"，会显示「可作业 50」而实际 30。
   */
  it('actionable 只累加服务端给的 actionableCount，与 total 互不影响', () => {
    const withActionable = [
      { formId: 'PUR_ReceiveBill', businessType: 'CG', wmsStatus: 'ERP_SYNCED', count: 976, actionableCount: 22 },
      { formId: 'PUR_ReceiveBill', businessType: 'WW', wmsStatus: 'ERP_SYNCED', count: 346, actionableCount: 6 },
      { formId: 'PUR_ReceiveBill', businessType: 'ZCCG', wmsStatus: 'ERP_SYNCED', count: 6, actionableCount: 0 },
    ];
    const counts = summariseChainMetrics(preset, withActionable, outOfScope);
    expect(counts.total).toBe(1328);
    expect(counts.actionable).toBe(28);
  });

  /** 服务端没给 actionableCount 时按 0 计，不能变成 NaN 或退化成 count。 */
  it('缺 actionableCount 的分组按 0 计而不是 NaN', () => {
    const noActionable = [{ formId: 'PUR_ReceiveBill', wmsStatus: 'ERP_SYNCED', count: 10 }];
    const counts = summariseChainMetrics(preset, noActionable, outOfScope);
    expect(counts.actionable).toBe(0);
    expect(counts.total).toBe(10);
  });
});

describe('ErpChainPreset 的业务类型与默认可见范围', () => {
  /**
   * 采购分「采购/委外」，销售分「标准/寄售」—— 用户明确要求的维度。
   * 文案必须与 erp-business-type.ts 的映射一致（那边另有 spec 钉住 CG→采购 等）。
   */
  it('两条链路各自的业务类型选项', () => {
    expect(chainPreset('PURCHASE_RECEIVE').businessTypes).toEqual([
      { value: 'CG', label: '采购' },
      { value: 'WW', label: '委外' },
    ]);
    expect(chainPreset('SALES_DELIVERY').businessTypes).toEqual([
      { value: 'NORMAL', label: '标准' },
      { value: 'CONSIGNMENT', label: '寄售' },
    ]);
  });

  /**
   * ZCCG（资产采购）刻意不进下拉。
   *
   * 它不参与收料业务，可作业量恒为 0（业务路径里被显式清零），
   * 放进下拉只会给出一个永远筛不到东西的选项。
   */
  it('资产采购不进业务类型下拉', () => {
    expect(chainPreset('PURCHASE_RECEIVE').businessTypes.map((t) => t.value))
      .not.toContain('ZCCG');
  });

  /**
   * 默认可见范围按链路分开定（用户决策）。
   *
   * 采购收料 true：实测 1332 张里 97.7% 是 ERP 侧已闭环的历史单据。
   * 销售发货 false：暂无存量补录，默认过滤会让人以为页面是空的。
   */
  it('采购默认只看可作业，销售默认看全部', () => {
    expect(chainPreset('PURCHASE_RECEIVE').defaultActionableOnly).toBe(true);
    expect(chainPreset('SALES_DELIVERY').defaultActionableOnly).toBe(false);
  });
});
