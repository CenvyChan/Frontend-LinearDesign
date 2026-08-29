import { describe, expect, it } from 'vitest';

import type { MouldQuote } from '#/api/mouldQuote';

import {
  buildMouldQuoteBudgetActualComparison,
  buildMouldQuoteV2Model,
  createDefaultMouldQuoteBudgetLines,
  createDefaultMouldQuoteDraft,
  createDefaultMouldQuoteParameters,
  estimateMouldQuoteLineAmount,
  getMouldQuotePricingMode,
  getMouldQuoteTypeOptions,
  getMouldQuoteV2ActionState,
  isDimensionalMouldQuoteLine,
} from './mould-quote-v2-model';

describe('mould-quote-v2-model', () => {
  it('summarizes quote lifecycle, margin, and review risks', () => {
    const rows: MouldQuote[] = [
      {
        grossProfitRate: 0.02,
        id: 1,
        quoteAmount: 1000,
        quoteNo: 'Q-001',
        quoteStatus: 'QUOTED',
      },
      {
        id: 2,
        quoteAmount: 2000,
        quoteNo: 'Q-002',
        quoteStatus: 'ACCEPTED',
      },
      {
        id: 3,
        quoteNo: 'Q-003',
        quoteStatus: 'REJECTED',
      },
    ];

    const model = buildMouldQuoteV2Model(rows);

    expect(model.summary.total).toBe(3);
    expect(model.summary.totalAmount).toBe(3000);
    expect(model.issueGroups.map((item) => item.key)).toEqual([
      'rejected',
      'lowMargin',
      'acceptedNotReviewed',
      'missingAmount',
    ]);
    expect(getMouldQuoteV2ActionState(rows[0]!).canApprove).toBe(true);
  });

  it('creates a local drawer draft with default parameters, budgets, and amount estimates', () => {
    expect(createDefaultMouldQuoteDraft()).toMatchObject({
      grossProfitRate: 0.1,
      managementRate: 0.03,
      mouldType: '连续模',
      quoteCategory: 'STAMPING',
      quoteStatus: 'DRAFT',
      riskRate: 0.03,
      taxRate: 0.13,
    });

    expect(createDefaultMouldQuoteParameters('STAMPING').map((item) => item.paramKey)).toEqual([
      'size_grade',
      'press_tonnage',
      'press_mode',
      'press_strokes',
      'material_thickness',
      'product_width',
      'product_length',
      'step_distance',
      'station_count',
      'punch_count',
      'mould_material_amount',
      'wire_cutting_amount',
      'standard_parts_amount',
      'mould_life',
    ]);

    const lines = createDefaultMouldQuoteBudgetLines('STAMPING');
    expect(lines.map((item) => item.costCategory)).toContain('MATERIAL');
    expect(lines.map((item) => item.costCategory)).toContain('LABOR');
    expect(lines.map((item) => item.costCategory)).toContain('OUTSOURCE');

    expect(estimateMouldQuoteLineAmount({
      costCategory: 'MATERIAL',
      density: 7.85,
      heightValue: 10,
      itemName: '模板',
      lengthValue: 100,
      lossRate: 0.1,
      quantity: 2,
      unitPrice: 20,
      widthValue: 50,
    })).toBe(17.27);
    expect(estimateMouldQuoteLineAmount({
      costCategory: 'LABOR',
      itemName: 'CNC',
      unitPrice: 65,
      workHours: 3,
    })).toBe(195);
  });

  it('creates mould-type specific parameter templates and pricing mode hints', () => {
    expect(getMouldQuoteTypeOptions('STAMPING').map((item) => item.value)).toEqual([
      '连续模',
      '复合模',
      '冲孔模',
      'U形折',
      'V形折',
      '轧形模',
    ]);
    expect(createDefaultMouldQuoteParameters('STAMPING', '复合模').map((item) => item.paramKey)).toContain('shared_template');
    expect(createDefaultMouldQuoteParameters('STAMPING', '冲孔模').map((item) => item.paramKey)).toContain('inner_perimeter');
    expect(createDefaultMouldQuoteParameters('STAMPING', 'U形折').map((item) => item.paramKey)).toContain('bend_height');
    expect(createDefaultMouldQuoteParameters('STAMPING', 'V形折').map((item) => item.paramKey)).toContain('bend_angle');

    expect(getMouldQuotePricingMode('STAMPING', '连续模')).toMatchObject({
      automated: true,
      tone: 'success',
    });
    expect(getMouldQuotePricingMode('INJECTION', '注塑模')).toMatchObject({
      automated: true,
      tone: 'success',
    });
  });

  it('creates injection parameters and Philips-style budget presets', () => {
    expect(createDefaultMouldQuoteDraft('INJECTION')).toMatchObject({
      mouldType: '注塑模',
      quoteCategory: 'INJECTION',
    });
    expect(createDefaultMouldQuoteParameters('INJECTION', '注塑模').map((item) => item.paramKey)).toEqual([
      'injection_material_amount',
      'mould_base_length',
      'mould_base_width',
      'mould_base_height',
      'cavity_length',
      'cavity_width',
      'cavity_height',
      'core_length',
      'core_width',
      'core_height',
      'electrode_length',
      'electrode_width',
      'electrode_height',
      'electrode_count',
      'hot_runner_count',
      'ejector_pin_count',
      'cnc_hours',
      'edm_hours',
      'wire_cutting_hours',
      'polishing_hours',
      'assembly_hours',
      'design_hours',
      'trial_count',
    ]);

    const lines = createDefaultMouldQuoteBudgetLines('INJECTION');
    expect(lines.map((item) => item.itemName)).toContain('热流道');
    expect(lines.map((item) => item.itemName)).toContain('抛光赛纹');
    expect(lines.find((item) => item.itemName === '电极')).toMatchObject({
      density: 9,
      unitPrice: 105,
    });
  });

  it('creates sheet-metal product cost templates and automated pricing hints', () => {
    expect(createDefaultMouldQuoteDraft('SHEET_METAL')).toMatchObject({
      mouldType: '钣金产品成本',
      quoteCategory: 'SHEET_METAL',
    });
    expect(getMouldQuoteTypeOptions('SHEET_METAL').map((item) => item.value)).toEqual([
      '钣金产品成本',
      'U形折',
      'V形折',
      '钣金折弯模',
    ]);
    expect(createDefaultMouldQuoteParameters('SHEET_METAL', '钣金产品成本').map((item) => item.paramKey)).toEqual([
      'sheet_material_amount',
      'accessory_assembly_amount',
      'stamping_amount',
      'nct_amount',
      'laser_amount',
      'bending_amount',
      'cnc_amount',
      'secondary_process_amount',
      'surface_treatment_amount',
      'tooling_fixture_amount',
      'sheet_metal_process_amount',
    ]);
    expect(getMouldQuotePricingMode('SHEET_METAL', '钣金产品成本')).toMatchObject({
      automated: true,
      tone: 'success',
    });

    const lines = createDefaultMouldQuoteBudgetLines('SHEET_METAL');
    expect(lines.map((item) => item.itemName)).toEqual([
      '材料成本',
      '配件及组装',
      '冲压加工',
      'NCT数冲',
      'LAS激光',
      '折床',
      'CNC',
      '二次加工',
      '表面处理',
      '模具/夹具',
    ]);
  });

  it('separates dimensional material rows from ordinary budget rows', () => {
    const lines = createDefaultMouldQuoteBudgetLines('STAMPING');
    const dimensionRows = lines.filter(isDimensionalMouldQuoteLine);
    const ordinaryRows = lines.filter((line) => !isDimensionalMouldQuoteLine(line));

    expect(dimensionRows.map((item) => item.itemName)).toEqual(['模板', '冲头', '凹模']);
    expect(ordinaryRows.map((item) => item.costCategory)).toEqual([
      'LABOR',
      'LABOR',
      'LABOR',
      'LABOR',
      'LABOR',
      'LABOR',
      'OUTSOURCE',
      'OUTSOURCE',
      'OTHER',
    ]);
    expect(isDimensionalMouldQuoteLine({
      amount: 800,
      costCategory: 'MATERIAL',
      itemName: '热流道',
    })).toBe(false);
  });

  it('builds budget and actual comparison rows for material, labor, and outsource costs', () => {
    const comparison = buildMouldQuoteBudgetActualComparison(
      [
        { amount: 100, costCategory: 'MATERIAL', itemName: '材料预算' },
        { costCategory: 'LABOR', itemName: '人工预算', unitPrice: 80, workHours: 2 },
        { costCategory: 'OUTSOURCE', itemName: '委外预算', quantity: 3, unitPrice: 50 },
        { amount: 999, costCategory: 'OTHER', itemName: '其他费用' },
      ],
      [
        { amount: 120, costCategory: 'MATERIAL', itemName: '材料实际' },
        { amount: 130, costCategory: 'LABOR', itemName: '人工实际' },
      ],
    );

    expect(comparison).toEqual([
      {
        actualAmount: 120,
        budgetAmount: 100,
        category: 'MATERIAL',
        categoryName: '材料',
        varianceAmount: 20,
        varianceRate: 0.2,
      },
      {
        actualAmount: 130,
        budgetAmount: 160,
        category: 'LABOR',
        categoryName: '人工',
        varianceAmount: -30,
        varianceRate: -0.1875,
      },
      {
        actualAmount: 0,
        budgetAmount: 150,
        category: 'OUTSOURCE',
        categoryName: '工序委外',
        varianceAmount: -150,
        varianceRate: -1,
      },
    ]);
  });
});
