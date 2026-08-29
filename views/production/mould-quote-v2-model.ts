import type {
  MouldQuote,
  MouldQuoteActualCost,
  MouldQuoteCategory,
  MouldQuoteComparisonItem,
  MouldQuoteCostCategory,
  MouldQuoteLine,
  MouldQuoteParameter,
  MouldQuoteStatus,
} from '#/api/mouldQuote';

export type MouldQuoteV2Tone = 'danger' | 'info' | 'normal' | 'primary' | 'success' | 'warning';

export interface MouldQuoteV2IssueGroup {
  count: number;
  key: 'acceptedNotReviewed' | 'lowMargin' | 'missingAmount' | 'rejected';
  label: string;
  tone: MouldQuoteV2Tone;
}

export interface MouldQuoteV2Stage {
  count: number;
  key: MouldQuoteStatus;
  label: string;
  tone: MouldQuoteV2Tone;
}

export interface MouldQuoteV2ActionState {
  canAccept: boolean;
  canApprove: boolean;
  canCalculate: boolean;
  canCustomerConfirm: boolean;
  canSubmit: boolean;
  risk: MouldQuoteV2Tone;
}

export interface MouldQuotePricingMode {
  automated: boolean;
  label: string;
  remark: string;
  tone: MouldQuoteV2Tone;
}

export interface MouldQuoteTypeOption {
  label: string;
  value: string;
}

export interface MouldQuoteV2Model {
  issueGroups: MouldQuoteV2IssueGroup[];
  stages: MouldQuoteV2Stage[];
  summary: {
    accepted: number;
    averageGrossProfitRate: number;
    reviewed: number;
    submitted: number;
    total: number;
    totalAmount: number;
  };
}

const STATUS_LABELS: Record<MouldQuoteStatus, string> = {
  ACCEPTED: '已验收',
  APPROVED: '内部已审核',
  CANCELLED: '已取消',
  CUSTOMER_CONFIRMED: '客户已确认',
  DRAFT: '草稿',
  QUOTED: '已报价',
  REJECTED: '已驳回',
  REVIEWED: '成本复盘',
  SUBMITTED: '已提交',
};

const MOULD_TYPE_OPTIONS: Record<MouldQuoteCategory, MouldQuoteTypeOption[]> = {
  INJECTION: [
    { label: '注塑模', value: '注塑模' },
  ],
  SHEET_METAL: [
    { label: '钣金产品成本', value: '钣金产品成本' },
    { label: 'U形折', value: 'U形折' },
    { label: 'V形折', value: 'V形折' },
    { label: '钣金折弯模（手工预算）', value: '钣金折弯模' },
  ],
  STAMPING: [
    { label: '连续模', value: '连续模' },
    { label: '复合模', value: '复合模' },
    { label: '冲孔模', value: '冲孔模' },
    { label: 'U形折', value: 'U形折' },
    { label: 'V形折', value: 'V形折' },
    { label: '轧形模', value: '轧形模' },
  ],
};

const PARAM_TEMPLATES: Record<MouldQuoteCategory, MouldQuoteParameter[]> = {
  INJECTION: [
    { paramKey: 'injection_material_amount', paramName: '注塑材料覆盖金额', sectionCode: 'OVERRIDE', sortNo: 1, valueType: 'NUMBER' },
    { paramKey: 'mould_base_length', paramName: '模架长', sectionCode: 'MATERIAL', sortNo: 2, valueType: 'NUMBER' },
    { paramKey: 'mould_base_width', paramName: '模架宽', sectionCode: 'MATERIAL', sortNo: 3, valueType: 'NUMBER' },
    { paramKey: 'mould_base_height', paramName: '模架高', sectionCode: 'MATERIAL', sortNo: 4, valueType: 'NUMBER' },
    { paramKey: 'cavity_length', paramName: '型腔长', sectionCode: 'MATERIAL', sortNo: 5, valueType: 'NUMBER' },
    { paramKey: 'cavity_width', paramName: '型腔宽', sectionCode: 'MATERIAL', sortNo: 6, valueType: 'NUMBER' },
    { paramKey: 'cavity_height', paramName: '型腔高', sectionCode: 'MATERIAL', sortNo: 7, valueType: 'NUMBER' },
    { paramKey: 'core_length', paramName: '型芯长', sectionCode: 'MATERIAL', sortNo: 8, valueType: 'NUMBER' },
    { paramKey: 'core_width', paramName: '型芯宽', sectionCode: 'MATERIAL', sortNo: 9, valueType: 'NUMBER' },
    { paramKey: 'core_height', paramName: '型芯高', sectionCode: 'MATERIAL', sortNo: 10, valueType: 'NUMBER' },
    { paramKey: 'electrode_length', paramName: '电极长', sectionCode: 'MATERIAL', sortNo: 11, valueType: 'NUMBER' },
    { paramKey: 'electrode_width', paramName: '电极宽', sectionCode: 'MATERIAL', sortNo: 12, valueType: 'NUMBER' },
    { paramKey: 'electrode_height', paramName: '电极高', sectionCode: 'MATERIAL', sortNo: 13, valueType: 'NUMBER' },
    { paramKey: 'electrode_count', paramName: '电极数量', sectionCode: 'MATERIAL', sortNo: 14, valueType: 'NUMBER' },
    { paramKey: 'hot_runner_count', paramName: '热流道数量', sectionCode: 'STANDARD', sortNo: 15, valueType: 'NUMBER' },
    { paramKey: 'ejector_pin_count', paramName: '顶杆数量', sectionCode: 'STANDARD', sortNo: 16, valueType: 'NUMBER' },
    { paramKey: 'cnc_hours', paramName: 'CNC工时', sectionCode: 'PROCESS', sortNo: 17, valueType: 'NUMBER' },
    { paramKey: 'edm_hours', paramName: 'EDM工时', sectionCode: 'PROCESS', sortNo: 18, valueType: 'NUMBER' },
    { paramKey: 'wire_cutting_hours', paramName: '线切割工时', sectionCode: 'PROCESS', sortNo: 19, valueType: 'NUMBER' },
    { paramKey: 'polishing_hours', paramName: '抛光赛纹工时', sectionCode: 'PROCESS', sortNo: 20, valueType: 'NUMBER' },
    { paramKey: 'assembly_hours', paramName: '组模工时', sectionCode: 'PROCESS', sortNo: 21, valueType: 'NUMBER' },
    { paramKey: 'design_hours', paramName: '设计工时', sectionCode: 'PROCESS', sortNo: 22, valueType: 'NUMBER' },
    { paramKey: 'trial_count', paramName: '试模次数', sectionCode: 'PROCESS', sortNo: 23, valueType: 'NUMBER' },
  ],
  SHEET_METAL: [
    { paramKey: 'sheet_material_amount', paramName: '材料成本', sectionCode: 'PRODUCT_COST', sortNo: 1, valueType: 'NUMBER' },
    { paramKey: 'accessory_assembly_amount', paramName: '配件及组装', sectionCode: 'PRODUCT_COST', sortNo: 2, valueType: 'NUMBER' },
    { paramKey: 'stamping_amount', paramName: '冲压加工', sectionCode: 'PRODUCT_COST', sortNo: 3, valueType: 'NUMBER' },
    { paramKey: 'nct_amount', paramName: 'NCT数冲', sectionCode: 'PRODUCT_COST', sortNo: 4, valueType: 'NUMBER' },
    { paramKey: 'laser_amount', paramName: 'LAS激光', sectionCode: 'PRODUCT_COST', sortNo: 5, valueType: 'NUMBER' },
    { paramKey: 'bending_amount', paramName: '折床', sectionCode: 'PRODUCT_COST', sortNo: 6, valueType: 'NUMBER' },
    { paramKey: 'cnc_amount', paramName: 'CNC', sectionCode: 'PRODUCT_COST', sortNo: 7, valueType: 'NUMBER' },
    { paramKey: 'secondary_process_amount', paramName: '二次加工', sectionCode: 'PRODUCT_COST', sortNo: 8, valueType: 'NUMBER' },
    { paramKey: 'surface_treatment_amount', paramName: '表面处理', sectionCode: 'PRODUCT_COST', sortNo: 9, valueType: 'NUMBER' },
    { paramKey: 'tooling_fixture_amount', paramName: '模具/夹具', sectionCode: 'PRODUCT_COST', sortNo: 10, valueType: 'NUMBER' },
    { paramKey: 'sheet_metal_process_amount', paramName: '钣金工序覆盖金额', sectionCode: 'OVERRIDE', sortNo: 11, valueType: 'NUMBER' },
  ],
  STAMPING: [
    { paramKey: 'size_grade', paramName: '工价级别', sectionCode: 'MOULD', sortNo: 1, valueType: 'TEXT' },
    { paramKey: 'press_tonnage', paramName: '冲床吨位', sectionCode: 'MOULD', sortNo: 2, valueType: 'NUMBER' },
    { paramKey: 'press_mode', paramName: '冲压模式', sectionCode: 'MOULD', sortNo: 3, valueType: 'TEXT' },
    { paramKey: 'press_strokes', paramName: '冲压次数', sectionCode: 'MOULD', sortNo: 4, valueType: 'NUMBER' },
    { paramKey: 'material_thickness', paramName: '料厚', sectionCode: 'MOULD', sortNo: 5, valueType: 'NUMBER' },
    { paramKey: 'step_distance', paramName: '步距', sectionCode: 'MOULD', sortNo: 6, valueType: 'NUMBER' },
    { paramKey: 'punch_count', paramName: '冲孔数量', sectionCode: 'MOULD', sortNo: 7, valueType: 'NUMBER' },
    { paramKey: 'station_count', paramName: '工位数', sectionCode: 'MOULD', sortNo: 8, valueType: 'NUMBER' },
    { paramKey: 'mould_life', paramName: '模具寿命', sectionCode: 'MOULD', sortNo: 9, valueType: 'NUMBER' },
  ],
};

const STAMPING_COMMON_PARAMS: MouldQuoteParameter[] = [
  { paramKey: 'size_grade', paramName: '工价级别', sectionCode: 'MOULD', sortNo: 1, valueType: 'TEXT' },
  { paramKey: 'press_tonnage', paramName: '冲床吨位', sectionCode: 'MOULD', sortNo: 2, valueType: 'NUMBER' },
  { paramKey: 'press_mode', paramName: '冲压模式', sectionCode: 'MOULD', sortNo: 3, valueType: 'TEXT' },
  { paramKey: 'press_strokes', paramName: '冲压次数', sectionCode: 'MOULD', sortNo: 4, valueType: 'NUMBER' },
  { paramKey: 'material_thickness', paramName: '料厚', sectionCode: 'MOULD', sortNo: 5, valueType: 'NUMBER' },
  { paramKey: 'product_width', paramName: '产品/料宽', sectionCode: 'MOULD', sortNo: 6, valueType: 'NUMBER' },
  { paramKey: 'product_length', paramName: '产品/料长', sectionCode: 'MOULD', sortNo: 7, valueType: 'NUMBER' },
];

const STAMPING_OVERRIDE_PARAMS: MouldQuoteParameter[] = [
  { paramKey: 'mould_material_amount', paramName: '指定模料费用', sectionCode: 'OVERRIDE', sortNo: 90, valueType: 'NUMBER' },
  { paramKey: 'wire_cutting_amount', paramName: '指定线割费用', sectionCode: 'OVERRIDE', sortNo: 91, valueType: 'NUMBER' },
  { paramKey: 'standard_parts_amount', paramName: '指定标准件金额', sectionCode: 'OVERRIDE', sortNo: 92, valueType: 'NUMBER' },
  { paramKey: 'mould_life', paramName: '模具寿命', sectionCode: 'MOULD', sortNo: 99, valueType: 'NUMBER' },
];

const TYPE_PARAM_TEMPLATES: Record<string, MouldQuoteParameter[]> = {
  U形折: [
    ...STAMPING_COMMON_PARAMS,
    { paramKey: 'bend_height', paramName: '折弯高度', sectionCode: 'MOULD', sortNo: 20, valueType: 'NUMBER' },
    { paramKey: 'u_length_side', paramName: '长度方向U形', sectionCode: 'MOULD', sortNo: 21, valueType: 'TEXT' },
    { paramKey: 'u_width_side', paramName: '宽度方向U形', sectionCode: 'MOULD', sortNo: 22, valueType: 'TEXT' },
    ...STAMPING_OVERRIDE_PARAMS,
  ],
  V形折: [
    ...STAMPING_COMMON_PARAMS,
    { paramKey: 'bend_angle', paramName: '折弯角度', sectionCode: 'MOULD', sortNo: 20, valueType: 'NUMBER' },
    { paramKey: 'bend_side_length', paramName: '折弯边长', sectionCode: 'MOULD', sortNo: 21, valueType: 'NUMBER' },
    { paramKey: 'template_width', paramName: '指定模板宽', sectionCode: 'MOULD', sortNo: 22, valueType: 'NUMBER' },
    { paramKey: 'template_length', paramName: '指定模板长', sectionCode: 'MOULD', sortNo: 23, valueType: 'NUMBER' },
    ...STAMPING_OVERRIDE_PARAMS,
  ],
  冲孔模: [
    ...STAMPING_COMMON_PARAMS,
    { paramKey: 'inner_perimeter', paramName: '内孔周长', sectionCode: 'PUNCH', sortNo: 20, valueType: 'NUMBER' },
    { paramKey: 'round_small_diameter', paramName: '小圆孔直径', sectionCode: 'PUNCH', sortNo: 21, valueType: 'NUMBER' },
    { paramKey: 'round_small_count', paramName: '小圆孔数量', sectionCode: 'PUNCH', sortNo: 22, valueType: 'NUMBER' },
    { paramKey: 'round_middle_diameter', paramName: '中圆孔直径', sectionCode: 'PUNCH', sortNo: 23, valueType: 'NUMBER' },
    { paramKey: 'round_middle_count', paramName: '中圆孔数量', sectionCode: 'PUNCH', sortNo: 24, valueType: 'NUMBER' },
    { paramKey: 'round_big_diameter', paramName: '大圆孔直径', sectionCode: 'PUNCH', sortNo: 25, valueType: 'NUMBER' },
    { paramKey: 'round_big_count', paramName: '大圆孔数量', sectionCode: 'PUNCH', sortNo: 26, valueType: 'NUMBER' },
    { paramKey: 'special_perimeter', paramName: '异形孔周长', sectionCode: 'PUNCH', sortNo: 27, valueType: 'NUMBER' },
    { paramKey: 'special_count', paramName: '异形孔数量', sectionCode: 'PUNCH', sortNo: 28, valueType: 'NUMBER' },
    ...STAMPING_OVERRIDE_PARAMS,
  ],
  复合模: [
    ...STAMPING_COMMON_PARAMS,
    { paramKey: 'inner_perimeter', paramName: '内孔周长', sectionCode: 'PUNCH', sortNo: 20, valueType: 'NUMBER' },
    { paramKey: 'shared_template', paramName: '模板共用', sectionCode: 'MOULD', sortNo: 21, valueType: 'TEXT' },
    { paramKey: 'round_small_diameter', paramName: '小圆孔直径', sectionCode: 'PUNCH', sortNo: 22, valueType: 'NUMBER' },
    { paramKey: 'round_small_count', paramName: '小圆孔数量', sectionCode: 'PUNCH', sortNo: 23, valueType: 'NUMBER' },
    { paramKey: 'special_perimeter', paramName: '异形孔周长', sectionCode: 'PUNCH', sortNo: 24, valueType: 'NUMBER' },
    { paramKey: 'special_count', paramName: '异形孔数量', sectionCode: 'PUNCH', sortNo: 25, valueType: 'NUMBER' },
    ...STAMPING_OVERRIDE_PARAMS,
  ],
  连续模: [
    ...STAMPING_COMMON_PARAMS,
    { paramKey: 'step_distance', paramName: '步距', sectionCode: 'MOULD', sortNo: 20, valueType: 'NUMBER' },
    { paramKey: 'station_count', paramName: '工位数', sectionCode: 'MOULD', sortNo: 21, valueType: 'NUMBER' },
    { paramKey: 'punch_count', paramName: '冲孔数量', sectionCode: 'PUNCH', sortNo: 22, valueType: 'NUMBER' },
    ...STAMPING_OVERRIDE_PARAMS,
  ],
  轧形模: [
    ...STAMPING_COMMON_PARAMS,
    { paramKey: 'difficulty_coefficient', paramName: '难度系数', sectionCode: 'MOULD', sortNo: 20, valueType: 'NUMBER' },
    ...STAMPING_OVERRIDE_PARAMS,
  ],
};

function defaultMouldType(category: MouldQuoteCategory) {
  if (category === 'STAMPING') return '连续模';
  if (category === 'SHEET_METAL') return '钣金产品成本';
  return '注塑模';
}

function budgetLine(costCategory: MouldQuoteCostCategory, itemName: string, extra: Partial<MouldQuoteLine> = {}): MouldQuoteLine {
  return {
    costCategory,
    itemName,
    quantity: costCategory === 'LABOR' ? undefined : 1,
    unitPrice: 0,
    ...extra,
  };
}

function asNumber(value: unknown): number {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function roundAmount(value?: number) {
  return Math.round(asNumber(value) * 10_000) / 10_000;
}

function hasAnyDimensionalValue(line: MouldQuoteLine) {
  return asNumber(line.lengthValue) > 0
    || asNumber(line.widthValue) > 0
    || asNumber(line.heightValue) > 0
    || asNumber(line.density) > 0;
}

function rateValue(value?: number) {
  const rate = asNumber(value);
  return rate > 1 ? rate / 100 : rate;
}

function count(rows: MouldQuote[], predicate: (row: MouldQuote) => boolean): number {
  return rows.filter(predicate).length;
}

function normalizeMouldType(value?: string) {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized.includes('连续') || normalized.includes('連續')) return '连续模';
  if (normalized.includes('复合') || normalized.includes('複合')) return '复合模';
  if (normalized.includes('冲孔') || normalized.includes('沖孔')) return '冲孔模';
  if (normalized.includes('u形') || normalized.includes('u型')) return 'U形折';
  if (normalized.includes('v形') || normalized.includes('v型')) return 'V形折';
  if (normalized.includes('轧形') || normalized.includes('軋形') || normalized.includes('轧型') || normalized.includes('軋型')) return '轧形模';
  if (normalized.includes('注塑') || normalized.includes('射出')) return '注塑模';
  if (normalized.includes('钣金产品') || normalized.includes('sheet metal product')) return '钣金产品成本';
  return value || '';
}

export function getMouldQuoteTypeOptions(category: MouldQuoteCategory): MouldQuoteTypeOption[] {
  return MOULD_TYPE_OPTIONS[category] || [];
}

export function getMouldQuotePricingMode(category?: MouldQuoteCategory, mouldType?: string): MouldQuotePricingMode {
  const normalizedType = normalizeMouldType(mouldType);
  if (category === 'STAMPING' && ['连续模', '复合模', '冲孔模', 'U形折', 'V形折', '轧形模'].includes(normalizedType)) {
    return {
      automated: true,
      label: '规则计价',
      remark: '会按模具类型生成自动规则明细，并叠加手工预算明细。',
      tone: 'success',
    };
  }
  if (category === 'INJECTION' && normalizedType === '注塑模') {
    return {
      automated: true,
      label: '飞利浦注塑规则计价',
      remark: '会按注塑材料、标准件、加工工序生成自动规则明细，并保留手工覆盖项。',
      tone: 'success',
    };
  }
  if (category === 'SHEET_METAL' && normalizedType === '钣金产品成本') {
    return {
      automated: true,
      label: '钣金产品成本规则计价',
      remark: '会按报价表格拆分材料、冲压/NCT/LAS/折床/CNC、二次加工、表面处理和模具夹具。',
      tone: 'success',
    };
  }
  if (category === 'SHEET_METAL' && ['U形折', 'V形折'].includes(normalizedType)) {
    return {
      automated: true,
      label: '折弯规则计价',
      remark: '会按 U/V 折模具规则生成费用，并叠加手工预算明细。',
      tone: 'success',
    };
  }
  return {
    automated: false,
    label: '手工预算模式',
    remark: '当前不会生成专属自动规则明细，报价主要依赖预算明细和费率。',
    tone: 'warning',
  };
}

export function getMouldQuoteV2ActionState(row: MouldQuote): MouldQuoteV2ActionState {
  const status = row.quoteStatus || 'DRAFT';
  return {
    canAccept: status === 'CUSTOMER_CONFIRMED',
    canApprove: status === 'QUOTED',
    canCalculate: status === 'SUBMITTED',
    canCustomerConfirm: status === 'APPROVED',
    canSubmit: status === 'DRAFT',
    risk: status === 'REJECTED'
      ? 'danger'
      : asNumber(row.grossProfitRate) > 0 && asNumber(row.grossProfitRate) < 0.05
        ? 'warning'
        : status === 'REVIEWED' || status === 'ACCEPTED'
          ? 'success'
          : 'normal',
  };
}

export function createDefaultMouldQuoteDraft(category: MouldQuoteCategory = 'STAMPING'): MouldQuote {
  return {
    grossProfitRate: 0.1,
    managementRate: 0.03,
    mouldType: defaultMouldType(category),
    quoteCategory: category,
    quoteDate: Date.now(),
    quoteStatus: 'DRAFT',
    riskRate: 0.03,
    taxRate: 0.13,
  };
}

export function createDefaultMouldQuoteParameters(category: MouldQuoteCategory, mouldType?: string): MouldQuoteParameter[] {
  const normalizedType = normalizeMouldType(mouldType || defaultMouldType(category));
  const template = category === 'INJECTION'
    ? PARAM_TEMPLATES.INJECTION
    : TYPE_PARAM_TEMPLATES[normalizedType] || PARAM_TEMPLATES[category];
  return template.map((item, index) => ({
    ...item,
    id: undefined,
    paramValue: '',
    quoteId: undefined,
    sortNo: index + 1,
  }));
}

export function createDefaultMouldQuoteBudgetLines(category: MouldQuoteCategory, mouldType?: string): MouldQuoteLine[] {
  const normalizedType = normalizeMouldType(mouldType || defaultMouldType(category));
  const commonLabor = [
    budgetLine('LABOR', '设计', { unitPrice: 100, workHours: 0 }),
    budgetLine('LABOR', 'CNC', { unitPrice: 65, workHours: 0 }),
    budgetLine('LABOR', 'EDM', { unitPrice: 60, workHours: 0 }),
    budgetLine('LABOR', '线割', { unitPrice: 80, workHours: 0 }),
    budgetLine('LABOR', '组模', { unitPrice: 60, workHours: 0 }),
    budgetLine('LABOR', '试模', { unitPrice: 500, workHours: 0 }),
  ];
  const outsource = [
    budgetLine('OUTSOURCE', '热处理', { quantity: 1, unitPrice: 0 }),
    budgetLine('OUTSOURCE', '表面处理', { quantity: 1, unitPrice: 0 }),
  ];
  const other = [budgetLine('OTHER', '标准件', { quantity: 1, unitPrice: 0 })];
  const materialPreset: Record<MouldQuoteCategory, MouldQuoteLine[]> = {
    INJECTION: [
      budgetLine('MATERIAL', '模架', { density: 8, heightValue: 560, lengthValue: 550, quantity: 1, unitPrice: 12, widthValue: 550 }),
      budgetLine('MATERIAL', '型腔材料', { density: 8, heightValue: 65, lengthValue: 380, quantity: 1, unitPrice: 30, widthValue: 360 }),
      budgetLine('MATERIAL', '型芯材料', { density: 8, heightValue: 65, lengthValue: 380, quantity: 1, unitPrice: 30, widthValue: 360 }),
      budgetLine('MATERIAL', '滑块', { density: 8, heightValue: 35, lengthValue: 120, quantity: 0, unitPrice: 35, widthValue: 70 }),
      budgetLine('MATERIAL', '电极', { density: 9, heightValue: 35, lengthValue: 60, quantity: 25, unitPrice: 105, widthValue: 60 }),
      budgetLine('MATERIAL', '热流道', { quantity: 4, unitPrice: 6000 }),
      budgetLine('MATERIAL', '定位环', { quantity: 1, unitPrice: 120 }),
      budgetLine('MATERIAL', '交口套', { quantity: 0, unitPrice: 120 }),
      budgetLine('MATERIAL', '顶杆', { quantity: 48, unitPrice: 25 }),
      budgetLine('MATERIAL', '弹簧', { quantity: 4, unitPrice: 35 }),
      budgetLine('MATERIAL', '其他', { quantity: 1, unitPrice: 500 }),
    ],
    SHEET_METAL: [
      budgetLine('MATERIAL', '材料成本', { amount: 0 }),
      budgetLine('OTHER', '配件及组装', { amount: 0 }),
      budgetLine('LABOR', '冲压加工', { amount: 0 }),
      budgetLine('LABOR', 'NCT数冲', { amount: 0 }),
      budgetLine('LABOR', 'LAS激光', { amount: 0 }),
      budgetLine('LABOR', '折床', { amount: 0 }),
      budgetLine('LABOR', 'CNC', { amount: 0 }),
      budgetLine('OUTSOURCE', '二次加工', { amount: 0 }),
      budgetLine('OUTSOURCE', '表面处理', { amount: 0 }),
      budgetLine('OTHER', '模具/夹具', { amount: 0 }),
    ],
    STAMPING: [
      budgetLine('MATERIAL', '模板', { density: 7.85, quantity: 1 }),
      budgetLine('MATERIAL', '冲头', { density: 7.85, quantity: 1 }),
      budgetLine('MATERIAL', '凹模', { density: 7.85, quantity: 1 }),
    ],
  };
  const lines = category === 'SHEET_METAL'
    ? normalizedType === '钣金产品成本'
      ? materialPreset.SHEET_METAL
      : [
          budgetLine('MATERIAL', '上模材料', { density: 7.85, quantity: 1 }),
          budgetLine('MATERIAL', '下模材料', { density: 7.85, quantity: 1 }),
          ...commonLabor,
          ...outsource,
          ...other,
        ]
    : category === 'INJECTION'
      ? [
          ...materialPreset.INJECTION,
          budgetLine('LABOR', 'CNC', { unitPrice: 65, workHours: 120 }),
          budgetLine('LABOR', 'EDM', { unitPrice: 60, workHours: 60 }),
          budgetLine('LABOR', '线切割', { unitPrice: 80, workHours: 40 }),
          budgetLine('LABOR', '热处理', { unitPrice: 0, workHours: 0 }),
          budgetLine('LABOR', '抛光赛纹', { unitPrice: 100, workHours: 15 }),
          budgetLine('LABOR', '组模', { unitPrice: 60, workHours: 50 }),
          budgetLine('LABOR', '设计', { unitPrice: 100, workHours: 20 }),
          budgetLine('LABOR', '试模', { unitPrice: 500, workHours: 2 }),
        ]
      : [...materialPreset[category], ...commonLabor, ...outsource, ...other];
  return lines.map((item, index) => ({
    ...item,
    sortNo: index + 1,
  }));
}

export function isDimensionalMouldQuoteLine(line: MouldQuoteLine) {
  return line.costCategory === 'MATERIAL' && hasAnyDimensionalValue(line);
}

export function estimateMouldQuoteLineAmount(line: MouldQuoteLine) {
  if (
    line.costCategory === 'MATERIAL'
    && asNumber(line.lengthValue) > 0
    && asNumber(line.widthValue) > 0
    && asNumber(line.heightValue) > 0
    && asNumber(line.density) > 0
    && asNumber(line.unitPrice) > 0
  ) {
    const baseAmount = asNumber(line.lengthValue)
      * asNumber(line.widthValue)
      * asNumber(line.heightValue)
      * asNumber(line.density)
      / 1_000_000
      * asNumber(line.quantity)
      * asNumber(line.unitPrice);
    return roundAmount(baseAmount * (1 + rateValue(line.lossRate)));
  }
  if (line.costCategory === 'LABOR' && asNumber(line.workHours) > 0) {
    return roundAmount(asNumber(line.workHours) * asNumber(line.unitPrice));
  }
  if (asNumber(line.quantity) > 0 || asNumber(line.unitPrice) > 0) {
    return roundAmount(asNumber(line.quantity) * asNumber(line.unitPrice));
  }
  return roundAmount(line.amount);
}

export function buildMouldQuoteBudgetActualComparison(
  budgetLines: MouldQuoteLine[] = [],
  actualCosts: MouldQuoteActualCost[] = [],
): MouldQuoteComparisonItem[] {
  const comparisonCategories: Array<Exclude<MouldQuoteCostCategory, 'OTHER'>> = ['MATERIAL', 'LABOR', 'OUTSOURCE'];
  const categoryNames: Record<Exclude<MouldQuoteCostCategory, 'OTHER'>, string> = {
    LABOR: '人工',
    MATERIAL: '材料',
    OUTSOURCE: '工序委外',
  };
  return comparisonCategories.map((category) => {
    const budgetAmount = roundAmount(
      budgetLines
        .filter((line) => line.costCategory === category)
        .reduce((sum, line) => sum + estimateMouldQuoteLineAmount(line), 0),
    );
    const actualAmount = roundAmount(
      actualCosts
        .filter((cost) => cost.costCategory === category)
        .reduce((sum, cost) => sum + asNumber(cost.amount), 0),
    );
    const varianceAmount = roundAmount(actualAmount - budgetAmount);
    const varianceRate = budgetAmount === 0 ? 0 : roundAmount(varianceAmount / budgetAmount);
    return {
      actualAmount,
      budgetAmount,
      category,
      categoryName: categoryNames[category],
      varianceAmount,
      varianceRate,
    };
  });
}

export function buildMouldQuoteV2Model(rows: MouldQuote[] = []): MouldQuoteV2Model {
  const totalAmount = rows.reduce((sum, row) => sum + asNumber(row.quoteAmount), 0);
  const margins = rows.map((row) => asNumber(row.grossProfitRate)).filter((value) => value > 0);
  const rejected = count(rows, (row) => row.quoteStatus === 'REJECTED');
  const lowMargin = count(rows, (row) => {
    const margin = asNumber(row.grossProfitRate);
    return margin > 0 && margin < 0.05;
  });
  const acceptedNotReviewed = count(rows, (row) => row.quoteStatus === 'ACCEPTED');
  const missingAmount = count(rows, (row) => !row.quoteAmount);

  return {
    issueGroups: ([
      { count: rejected, key: 'rejected', label: '被驳回报价', tone: 'danger' },
      { count: lowMargin, key: 'lowMargin', label: '毛利率偏低', tone: 'warning' },
      { count: acceptedNotReviewed, key: 'acceptedNotReviewed', label: '验收后未复盘', tone: 'warning' },
      { count: missingAmount, key: 'missingAmount', label: '缺少报价金额', tone: 'danger' },
    ] as MouldQuoteV2IssueGroup[]).filter((item) => item.count > 0),
    stages: (Object.keys(STATUS_LABELS) as MouldQuoteStatus[]).map((status) => ({
      count: count(rows, (row) => (row.quoteStatus || 'DRAFT') === status),
      key: status,
      label: STATUS_LABELS[status],
      tone: status === 'REJECTED' ? 'danger' : status === 'REVIEWED' || status === 'ACCEPTED' ? 'success' : 'info',
    })),
    summary: {
      accepted: count(rows, (row) => row.quoteStatus === 'ACCEPTED' || row.quoteStatus === 'REVIEWED'),
      averageGrossProfitRate: margins.length
        ? Math.round((margins.reduce((sum, value) => sum + value, 0) / margins.length) * 10000) / 100
        : 0,
      reviewed: count(rows, (row) => row.quoteStatus === 'REVIEWED'),
      submitted: count(rows, (row) => row.quoteStatus === 'SUBMITTED'),
      total: rows.length,
      totalAmount,
    },
  };
}
