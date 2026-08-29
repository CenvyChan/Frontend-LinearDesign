<script lang="ts" setup>
import type {
  MouldQuote,
  MouldQuoteActualCost,
  MouldQuoteCategory,
  MouldQuoteComparisonItem,
  MouldQuoteCostCategory,
  MouldQuoteFlowLog,
  MouldQuoteFormulaMapping,
  MouldQuoteLine,
  MouldQuoteParameter,
  MouldQuoteRuleParameter,
  MouldQuoteStatus,
} from '#/api/mouldQuote';

import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  acceptMouldQuote,
  addMouldQuoteActualCost,
  approveMouldQuote,
  calculateMouldQuote,
  createMouldQuote,
  customerConfirmMouldQuote,
  getMouldQuoteCalculationTrace,
  getMouldQuoteDetail,
  getMouldQuoteFormulaMappings,
  getMouldQuotes,
  getMouldQuoteRuleParameters,
  submitMouldQuote,
  syncMouldQuoteActualCosts,
  updateMouldQuote,
} from '#/api/mouldQuote';

defineOptions({ name: 'MouldQuote' });

const route = useRoute();
const router = useRouter();

type ActualCostCategory = Exclude<MouldQuoteCostCategory, 'OTHER'>;
type TagType = 'danger' | 'info' | 'primary' | 'success' | 'warning';

const CATEGORY_LABELS: Record<MouldQuoteCategory, string> = {
  INJECTION: '注塑',
  SHEET_METAL: '钣金',
  STAMPING: '冲压',
};

const STATUS_LABELS: Record<MouldQuoteStatus, string> = {
  ACCEPTED: '模具已验收',
  APPROVED: '内部已审核',
  CANCELLED: '已取消',
  CUSTOMER_CONFIRMED: '客户已确认',
  DRAFT: '草稿',
  QUOTED: '已计算报价',
  REJECTED: '已驳回',
  REVIEWED: '成本复盘完成',
  SUBMITTED: '已提交',
};

const STATUS_TYPES: Partial<Record<MouldQuoteStatus, TagType>> = {
  ACCEPTED: 'success',
  APPROVED: 'primary',
  CANCELLED: 'info',
  CUSTOMER_CONFIRMED: 'success',
  DRAFT: 'info',
  QUOTED: 'warning',
  REJECTED: 'danger',
  REVIEWED: 'success',
  SUBMITTED: 'primary',
};

const COST_CATEGORY_LABELS: Record<MouldQuoteCostCategory, string> = {
  LABOR: '人工',
  MATERIAL: '材料',
  OTHER: '其他费用',
  OUTSOURCE: '工序委外',
};

const ACTUAL_COST_CATEGORY_OPTIONS: Array<{ label: string; value: ActualCostCategory }> = [
  { label: '材料', value: 'MATERIAL' },
  { label: '人工', value: 'LABOR' },
  { label: '工序委外', value: 'OUTSOURCE' },
];

const STAMPING_MOULD_TYPE_OPTIONS = ['连续模', '复合模', '冲孔模', 'U形折', 'V形折', '轧形模'];

const PARAM_VALUE_OPTIONS: Record<string, Array<{ label: string; value: string }>> = {
  press_mode: [
    { label: '连续冲', value: '连续冲' },
    { label: '单冲', value: '单冲' },
  ],
  size_grade: [
    { label: 'A级', value: 'A' },
    { label: 'B级', value: 'B' },
    { label: 'C级', value: 'C' },
  ],
};

const PARAM_TEMPLATES: Record<MouldQuoteCategory, MouldQuoteParameter[]> = {
  INJECTION: [
    { paramKey: 'cavity_count', paramName: '模穴数', sectionCode: 'MOULD', sortNo: 1, valueType: 'NUMBER' },
    { paramKey: 'mould_life', paramName: '模具寿命', sectionCode: 'MOULD', sortNo: 2, valueType: 'NUMBER' },
    { paramKey: 'machine_tonnage', paramName: '机台吨位', sectionCode: 'MOULD', sortNo: 3, valueType: 'TEXT' },
    { paramKey: 'mould_base_size', paramName: '模架尺寸', sectionCode: 'MOULD', sortNo: 4, valueType: 'TEXT' },
    { paramKey: 'product_weight', paramName: '产品重量', sectionCode: 'MOULD', sortNo: 5, valueType: 'NUMBER' },
  ],
  SHEET_METAL: [
    { paramKey: 'material_thickness', paramName: '料厚', sectionCode: 'MOULD', sortNo: 1, valueType: 'NUMBER' },
    { paramKey: 'bend_count', paramName: '折弯次数', sectionCode: 'MOULD', sortNo: 2, valueType: 'NUMBER' },
    { paramKey: 'product_width', paramName: '产品宽', sectionCode: 'MOULD', sortNo: 3, valueType: 'NUMBER' },
    { paramKey: 'product_length', paramName: '产品长', sectionCode: 'MOULD', sortNo: 4, valueType: 'NUMBER' },
    { paramKey: 'bend_height', paramName: '折弯高度', sectionCode: 'MOULD', sortNo: 5, valueType: 'NUMBER' },
    { paramKey: 'bend_angle', paramName: '折弯角度', sectionCode: 'MOULD', sortNo: 6, valueType: 'NUMBER' },
    { paramKey: 'bend_side_length', paramName: '折弯边长', sectionCode: 'MOULD', sortNo: 7, valueType: 'NUMBER' },
    { paramKey: 'press_tonnage', paramName: '冲床吨位', sectionCode: 'MOULD', sortNo: 8, valueType: 'NUMBER' },
    { paramKey: 'size_grade', paramName: '工价级别', sectionCode: 'MOULD', sortNo: 9, valueType: 'TEXT' },
    { paramKey: 'mould_life', paramName: '模具寿命', sectionCode: 'MOULD', sortNo: 10, valueType: 'NUMBER' },
  ],
  STAMPING: [
    { paramKey: 'size_grade', paramName: '工价级别', sectionCode: 'MOULD', sortNo: 1, valueType: 'TEXT' },
    { paramKey: 'press_tonnage', paramName: '冲床吨位', sectionCode: 'MOULD', sortNo: 2, valueType: 'NUMBER' },
    { paramKey: 'press_mode', paramName: '冲压模式', sectionCode: 'MOULD', sortNo: 3, valueType: 'TEXT' },
    { paramKey: 'press_strokes', paramName: '冲压次数', sectionCode: 'MOULD', sortNo: 4, valueType: 'NUMBER' },
    { paramKey: 'material_thickness', paramName: '料厚', sectionCode: 'MOULD', sortNo: 5, valueType: 'NUMBER' },
    { paramKey: 'product_width', paramName: '产品宽/料宽', sectionCode: 'MOULD', sortNo: 6, valueType: 'NUMBER' },
    { paramKey: 'product_length', paramName: '产品长/步距', sectionCode: 'MOULD', sortNo: 7, valueType: 'NUMBER' },
    { paramKey: 'step_distance', paramName: '步距', sectionCode: 'MOULD', sortNo: 8, valueType: 'NUMBER' },
    { paramKey: 'station_count', paramName: '步数/工位数', sectionCode: 'MOULD', sortNo: 9, valueType: 'NUMBER' },
    { paramKey: 'cutting_perimeter', paramName: '刃口/内孔周长', sectionCode: 'MOULD', sortNo: 10, valueType: 'NUMBER' },
    { paramKey: 'bend_height', paramName: '折弯高度', sectionCode: 'MOULD', sortNo: 11, valueType: 'NUMBER' },
    { paramKey: 'bend_angle', paramName: '折弯角度', sectionCode: 'MOULD', sortNo: 12, valueType: 'NUMBER' },
    { paramKey: 'bend_side_length', paramName: '折弯边长', sectionCode: 'MOULD', sortNo: 13, valueType: 'NUMBER' },
    { paramKey: 'punch_count', paramName: '冲孔数量', sectionCode: 'MOULD', sortNo: 14, valueType: 'NUMBER' },
    { paramKey: 'difficulty_coefficient', paramName: '难度系数', sectionCode: 'MOULD', sortNo: 15, valueType: 'NUMBER' },
    { paramKey: 'mould_life', paramName: '模具寿命', sectionCode: 'MOULD', sortNo: 16, valueType: 'NUMBER' },
  ],
};

const loading = ref(false);
const saving = ref(false);
const actionLoading = ref(false);
const actualSaving = ref(false);
const drawerVisible = ref(false);
const activeTab = ref('form');
const keyword = ref('');
const statusFilter = ref<MouldQuoteStatus | ''>('');
const categoryFilter = ref<MouldQuoteCategory | ''>('');
const currentPage = ref(1);
const pageSize = ref(20);
const tableData = ref<MouldQuote[]>([]);
const parameters = ref<MouldQuoteParameter[]>([]);
const budgetLines = ref<MouldQuoteLine[]>([]);
const actualCosts = ref<MouldQuoteActualCost[]>([]);
const comparison = ref<MouldQuoteComparisonItem[]>([]);
const flowLogs = ref<MouldQuoteFlowLog[]>([]);
const calculationTrace = ref<MouldQuoteLine[]>([]);
const ruleParameters = ref<MouldQuoteRuleParameter[]>([]);
const formulaMappings = ref<MouldQuoteFormulaMapping[]>([]);

const quoteForm = reactive<MouldQuote>(defaultQuote());
const actualForm = reactive<MouldQuoteActualCost>({
  amount: 0,
  costCategory: 'MATERIAL',
  itemName: '',
  quantity: 1,
  sourceBill: '',
  sourceType: 'MANUAL',
  unitPrice: 0,
});

const filteredData = computed(() => {
  if (!categoryFilter.value) {
    return tableData.value;
  }
  return tableData.value.filter(item => item.quoteCategory === categoryFilter.value);
});

const pagedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredData.value.slice(start, start + pageSize.value);
});

const currentStatus = computed<MouldQuoteStatus>(() => quoteForm.quoteStatus || 'DRAFT');
const isNew = computed(() => !quoteForm.id);
const budgetEditable = computed(() => !['ACCEPTED', 'REVIEWED'].includes(currentStatus.value));
const actualCostEditable = computed(() => ['ACCEPTED', 'REVIEWED'].includes(currentStatus.value));

const summary = computed(() => {
  const totalQuote = tableData.value.reduce((sum, item) => sum + numberValue(item.quoteAmount), 0);
  const submitted = tableData.value.filter(item => item.quoteStatus === 'SUBMITTED').length;
  const accepted = tableData.value.filter(item => item.quoteStatus === 'ACCEPTED' || item.quoteStatus === 'REVIEWED').length;
  const reviewed = tableData.value.filter(item => item.quoteStatus === 'REVIEWED').length;
  return { accepted, reviewed, submitted, total: tableData.value.length, totalQuote };
});

const budgetSummary = computed(() => {
  const totals: Record<MouldQuoteCostCategory, number> = {
    LABOR: 0,
    MATERIAL: 0,
    OTHER: 0,
    OUTSOURCE: 0,
  };
  for (const line of budgetLines.value) {
    totals[line.costCategory || 'OTHER'] += estimateLineAmount(line);
  }
  return totals;
});

function defaultQuote(): MouldQuote {
  return {
    grossProfitRate: 0.1,
    managementRate: 0.03,
    mouldType: '连续模',
    quoteCategory: 'STAMPING',
    quoteDate: Date.now(),
    quoteStatus: 'DRAFT',
    riskRate: 0.03,
    taxRate: 0.13,
  };
}

function defaultParameters(category: MouldQuoteCategory) {
  return PARAM_TEMPLATES[category].map((item, index) => ({
    ...item,
    id: undefined,
    paramValue: '',
    quoteId: undefined,
    sortNo: index + 1,
  }));
}

function defaultBudgetLines(category: MouldQuoteCategory): MouldQuoteLine[] {
  const commonLabor = [
    budgetLine('LABOR', '设计', { workHours: 0, unitPrice: 100 }),
    budgetLine('LABOR', 'CNC', { workHours: 0, unitPrice: 65 }),
    budgetLine('LABOR', 'EDM', { workHours: 0, unitPrice: 60 }),
    budgetLine('LABOR', '线割', { workHours: 0, unitPrice: 80 }),
    budgetLine('LABOR', '组模', { workHours: 0, unitPrice: 60 }),
    budgetLine('LABOR', '试模', { workHours: 0, unitPrice: 500 }),
  ];
  const outsource = [
    budgetLine('OUTSOURCE', '热处理', { quantity: 1, unitPrice: 0 }),
    budgetLine('OUTSOURCE', '表面处理', { quantity: 1, unitPrice: 0 }),
  ];
  const other = [budgetLine('OTHER', '标准件', { quantity: 1, unitPrice: 0 })];
  const materialPreset: Record<MouldQuoteCategory, MouldQuoteLine[]> = {
    INJECTION: [
      budgetLine('MATERIAL', '模架', { density: 8, quantity: 1 }),
      budgetLine('MATERIAL', '型腔材料', { density: 8, quantity: 1 }),
      budgetLine('MATERIAL', '型芯材料', { density: 8, quantity: 1 }),
    ],
    SHEET_METAL: [
      budgetLine('MATERIAL', '上模材料', { density: 7.85, quantity: 1 }),
      budgetLine('MATERIAL', '下模材料', { density: 7.85, quantity: 1 }),
    ],
    STAMPING: [
      budgetLine('MATERIAL', '模板', { density: 7.85, quantity: 1 }),
      budgetLine('MATERIAL', '冲头', { density: 7.85, quantity: 1 }),
      budgetLine('MATERIAL', '凹模', { density: 7.85, quantity: 1 }),
    ],
  };
  return [...materialPreset[category], ...commonLabor, ...outsource, ...other].map((item, index) => ({
    ...item,
    sortNo: index + 1,
  }));
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

function resetQuoteForm(quote?: MouldQuote) {
  Object.assign(quoteForm, defaultQuote(), quote || {});
}

function resetActualForm(category: ActualCostCategory = 'MATERIAL') {
  Object.assign(actualForm, {
    amount: 0,
    costCategory: category,
    itemName: '',
    quantity: 1,
    remark: '',
    sourceBill: '',
    sourceType: 'MANUAL',
    unitPrice: 0,
  });
}

function handleCategoryChange(category: MouldQuoteCategory) {
  quoteForm.mouldType = defaultMouldType(category);
  parameters.value = defaultParameters(category);
  budgetLines.value = defaultBudgetLines(category);
}

function defaultMouldType(category: MouldQuoteCategory) {
  if (category === 'STAMPING') return '连续模';
  if (category === 'SHEET_METAL') return 'U形折';
  return '注塑模';
}

function parameterValueOptions(paramKey?: string) {
  return paramKey ? PARAM_VALUE_OPTIONS[paramKey] || [] : [];
}

function openCreate() {
  resetQuoteForm();
  parameters.value = defaultParameters(quoteForm.quoteCategory || 'STAMPING');
  budgetLines.value = defaultBudgetLines(quoteForm.quoteCategory || 'STAMPING');
  actualCosts.value = [];
  comparison.value = [];
  flowLogs.value = [];
  calculationTrace.value = [];
  ruleParameters.value = [];
  formulaMappings.value = [];
  resetActualForm();
  activeTab.value = 'form';
  drawerVisible.value = true;
}

async function openDetail(row: MouldQuote) {
  if (!row.id) return;
  activeTab.value = 'form';
  await loadDetail(row.id);
}

async function loadData() {
  loading.value = true;
  try {
    const res = await getMouldQuotes({
      keyword: keyword.value || undefined,
      status: statusFilter.value || undefined,
    });
    if (res.success) {
      tableData.value = res.data || [];
    } else {
      ElMessage.error(res.message || '查询模具报价失败');
    }
  } catch (error) {
    console.error(error);
    ElMessage.error('查询模具报价失败');
  } finally {
    loading.value = false;
  }
}

async function loadDetail(id: number) {
  const res = await getMouldQuoteDetail(id);
  if (!res.success || !res.data) {
    ElMessage.error(res.message || '查询报价详情失败');
    return;
  }
  resetQuoteForm(res.data.quote);
  parameters.value = res.data.parameters?.length
    ? res.data.parameters
    : defaultParameters(res.data.quote.quoteCategory || 'STAMPING');
  budgetLines.value = res.data.budgetLines || [];
  actualCosts.value = res.data.actualCosts || [];
  comparison.value = res.data.comparison || [];
  flowLogs.value = res.data.flowLogs || [];
  calculationTrace.value = (res.data.budgetLines || []).filter(item => !!item.formulaCode);
  await loadRuleMeta(id, res.data.quote.mouldType);
  drawerVisible.value = true;
}

async function loadRuleMeta(id: number, mouldType?: string) {
  try {
    const [traceRes, paramRes, mappingRes] = await Promise.all([
      getMouldQuoteCalculationTrace(id),
      getMouldQuoteRuleParameters({ mouldType }),
      getMouldQuoteFormulaMappings({ mouldType }),
    ]);
    if (traceRes.success) {
      calculationTrace.value = traceRes.data || [];
    }
    if (paramRes.success) {
      ruleParameters.value = paramRes.data || [];
    }
    if (mappingRes.success) {
      formulaMappings.value = mappingRes.data || [];
    }
  } catch (error) {
    console.error(error);
  }
}

function handleSearch() {
  currentPage.value = 1;
  loadData();
}

function addBudgetLine(category: MouldQuoteCostCategory) {
  budgetLines.value.push({
    ...budgetLine(category, COST_CATEGORY_LABELS[category]),
    sortNo: budgetLines.value.length + 1,
  });
}

function removeBudgetLine(index: number) {
  budgetLines.value.splice(index, 1);
  budgetLines.value.forEach((item, sortIndex) => {
    item.sortNo = sortIndex + 1;
  });
}

async function saveCurrent(silent = false) {
  if (!quoteForm.quoteCategory) {
    ElMessage.warning('请选择模具类别');
    return false;
  }
  if (!budgetEditable.value && !isNew.value) {
    return true;
  }
  saving.value = true;
  try {
    const payload = {
      budgetLines: budgetLines.value
        .filter(item => item.itemName)
        .map((item, index) => ({ ...item, sortNo: index + 1 })),
      parameters: parameters.value
        .filter(item => item.paramKey && item.paramName)
        .map((item, index) => ({ ...item, sortNo: index + 1 })),
      quote: { ...quoteForm },
    };
    const res = quoteForm.id
      ? await updateMouldQuote(quoteForm.id, payload)
      : await createMouldQuote(payload);
    if (!res.success || !res.data?.id) {
      ElMessage.error(res.message || '保存报价失败');
      return false;
    }
    if (!silent) {
      ElMessage.success(res.message || '保存成功');
    }
    const keepTab = activeTab.value;
    await loadDetail(res.data.id);
    activeTab.value = keepTab;
    await loadData();
    return true;
  } catch (error) {
    console.error(error);
    ElMessage.error('保存报价失败');
    return false;
  } finally {
    saving.value = false;
  }
}

async function runWorkflowAction(action: (id: number) => Promise<any>, message: string) {
  if (!quoteForm.id) {
    ElMessage.warning('请先保存报价单');
    return;
  }
  actionLoading.value = true;
  try {
    const res = await action(quoteForm.id);
    if (res.success) {
      ElMessage.success(res.message || message);
      const keepTab = activeTab.value;
      await loadDetail(quoteForm.id);
      activeTab.value = keepTab;
      await loadData();
    } else {
      ElMessage.error(res.message || `${message}失败`);
    }
  } catch (error) {
    console.error(error);
    ElMessage.error(`${message}失败`);
  } finally {
    actionLoading.value = false;
  }
}

async function handleSubmit() {
  if (!(await saveCurrent(true))) return;
  await runWorkflowAction(submitMouldQuote, '提交成功');
}

async function handleCalculate() {
  if (!(await saveCurrent(true))) return;
  await runWorkflowAction(calculateMouldQuote, '报价计算完成');
}

async function handleAccept() {
  try {
    await ElMessageBox.confirm('验收后报价预算会冻结，是否继续？', '模具验收确认', { type: 'warning' });
  } catch {
    return;
  }
  await runWorkflowAction(acceptMouldQuote, '模具验收完成');
}

async function handleSyncActualCosts() {
  if (!quoteForm.id) return;
  try {
    await ElMessageBox.confirm('将从工序工资和模具成本记录重新归集自动成本，是否继续？', '同步实际成本', { type: 'warning' });
  } catch {
    return;
  }
  await runWorkflowAction(syncMouldQuoteActualCosts, '实际成本已同步');
}

async function handleAddActualCost() {
  if (!quoteForm.id || !actualCostEditable.value) {
    ElMessage.warning('模具验收后才能补录实际成本');
    return;
  }
  if (!actualForm.itemName || !actualForm.amount) {
    ElMessage.warning('请填写成本项目和金额');
    return;
  }
  actualSaving.value = true;
  try {
    const res = await addMouldQuoteActualCost(quoteForm.id, { ...actualForm });
    if (res.success) {
      ElMessage.success(res.message || '补录成功');
      resetActualForm(actualForm.costCategory as ActualCostCategory);
      activeTab.value = 'review';
      await loadDetail(quoteForm.id);
      await loadData();
    } else {
      ElMessage.error(res.message || '补录失败');
    }
  } catch (error) {
    console.error(error);
    ElMessage.error('补录失败');
  } finally {
    actualSaving.value = false;
  }
}

function estimateLineAmount(line: MouldQuoteLine) {
  if (line.costCategory === 'MATERIAL' && hasMaterialDimensions(line)) {
    let amount = numberValue(line.lengthValue)
      * numberValue(line.widthValue)
      * numberValue(line.heightValue)
      * numberValue(line.density)
      / 1_000_000
      * numberValue(line.quantity)
      * numberValue(line.unitPrice);
    const lossRate = rateValue(line.lossRate);
    if (lossRate > 0) {
      amount *= 1 + lossRate;
    }
    return roundAmount(amount);
  }
  if (line.costCategory === 'LABOR' && numberValue(line.workHours) > 0) {
    return roundAmount(numberValue(line.workHours) * numberValue(line.unitPrice));
  }
  if (numberValue(line.quantity) > 0 || numberValue(line.unitPrice) > 0) {
    return roundAmount(numberValue(line.quantity) * numberValue(line.unitPrice));
  }
  return roundAmount(line.amount);
}

function hasMaterialDimensions(line: MouldQuoteLine) {
  return numberValue(line.lengthValue) > 0
    && numberValue(line.widthValue) > 0
    && numberValue(line.heightValue) > 0
    && numberValue(line.density) > 0
    && numberValue(line.unitPrice) > 0;
}

function rateValue(value?: number) {
  const rate = numberValue(value);
  return rate > 1 ? rate / 100 : rate;
}

function numberValue(value?: number) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function roundAmount(value?: number) {
  return Math.round(numberValue(value) * 10_000) / 10_000;
}

function formatMoney(value?: number, digits = 2) {
  return numberValue(value).toLocaleString('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 2,
  });
}

function formatRate(value?: number) {
  return `${(numberValue(value) * 100).toFixed(2)}%`;
}

function formatTime(value?: number) {
  if (!value) return '--';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function getStatusType(status?: MouldQuoteStatus): TagType {
  return STATUS_TYPES[status || 'DRAFT'] || 'info';
}

function getVarianceType(value?: number): TagType {
  const amount = numberValue(value);
  if (amount > 0) return 'danger';
  if (amount < 0) return 'success';
  return 'info';
}

async function openCreateFromQuery() {
  if (route.query.action !== 'create' && route.query.mode !== 'create') return;
  openCreate();
  await nextTick();
  const query = { ...route.query };
  delete query.action;
  delete query.mode;
  await router.replace({ path: route.path, query });
}

onMounted(async () => {
  await loadData();
  await openCreateFromQuery();
});
</script>

<template>
  <div class="mould-quote-page">
    <div class="summary-row">
      <div class="summary-item">
        <span>报价单数</span>
        <strong>{{ summary.total }}</strong>
      </div>
      <div class="summary-item">
        <span>待工程报价</span>
        <strong>{{ summary.submitted }}</strong>
      </div>
      <div class="summary-item">
        <span>已验收</span>
        <strong>{{ summary.accepted }}</strong>
      </div>
      <div class="summary-item">
        <span>报价总额</span>
        <strong>{{ formatMoney(summary.totalQuote) }}</strong>
      </div>
    </div>

    <div class="toolbar-panel">
      <div class="toolbar-left">
        <el-input
          v-model="keyword"
          clearable
          placeholder="客户、产品、模具、工单"
          style="width: 260px"
          @keyup.enter="handleSearch"
        />
        <el-select v-model="statusFilter" clearable placeholder="流程状态" style="width: 150px">
          <el-option v-for="(label, value) in STATUS_LABELS" :key="value" :label="label" :value="value" />
        </el-select>
        <el-select v-model="categoryFilter" clearable placeholder="模具类别" style="width: 130px">
          <el-option v-for="(label, value) in CATEGORY_LABELS" :key="value" :label="label" :value="value" />
        </el-select>
        <el-button :icon="'Search'" @click="handleSearch">查询</el-button>
      </div>
      <div class="toolbar-right">
        <el-button :icon="'Refresh'" @click="loadData">刷新</el-button>
        <el-button type="primary" :icon="'Plus'" @click="openCreate">新增报价</el-button>
      </div>
    </div>

    <div class="table-panel">
      <el-table :data="pagedData" v-loading="loading" border size="small" stripe>
        <el-table-column prop="quoteNo" label="报价单号" width="150" fixed="left" />
        <el-table-column label="状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.quoteStatus)" size="small">
              {{ STATUS_LABELS[row.quoteStatus as MouldQuoteStatus] || row.quoteStatus }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类别" width="90" align="center">
          <template #default="{ row }">{{ CATEGORY_LABELS[row.quoteCategory as MouldQuoteCategory] || row.quoteCategory }}</template>
        </el-table-column>
        <el-table-column prop="customerName" label="客户" min-width="130" show-overflow-tooltip />
        <el-table-column prop="productNo" label="产品/图号" min-width="140" show-overflow-tooltip />
        <el-table-column prop="productName" label="产品名称" min-width="140" show-overflow-tooltip />
        <el-table-column prop="mouldCode" label="关联模具" min-width="130" show-overflow-tooltip />
        <el-table-column prop="orderNo" label="关联工单" min-width="130" show-overflow-tooltip />
        <el-table-column label="报价金额" width="130" align="right">
          <template #default="{ row }">{{ formatMoney(row.quoteAmount) }}</template>
        </el-table-column>
        <el-table-column label="含税金额" width="130" align="right">
          <template #default="{ row }">{{ formatMoney(row.taxIncludedAmount) }}</template>
        </el-table-column>
        <el-table-column prop="quoteByName" label="报价人" width="100" />
        <el-table-column label="更新时间" width="170">
          <template #default="{ row }">{{ formatTime(row.updateTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right" align="center">
          <template #default="{ row }">
            <el-button text type="primary" size="small" @click="openDetail(row)" :icon="'View'">工作台</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-area">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[20, 50, 100]"
          :total="filteredData.length"
          layout="total, sizes, prev, pager, next, jumper"
        />
      </div>
    </div>

    <el-drawer
      v-model="drawerVisible"
      :title="`${isNew ? '新增报价' : '模具报价工作台'} ${quoteForm.quoteNo || ''}`"
      direction="rtl"
      size="86%"
      destroy-on-close
    >
      <div class="drawer-body">
        <div class="quote-flow">
          <el-tag :type="getStatusType(currentStatus)" size="large">{{ STATUS_LABELS[currentStatus] }}</el-tag>
          <span>{{ CATEGORY_LABELS[quoteForm.quoteCategory || 'STAMPING'] }}</span>
          <span>{{ quoteForm.customerName || '-' }}</span>
          <span>{{ quoteForm.productNo || quoteForm.productName || '-' }}</span>
          <strong>￥{{ formatMoney(quoteForm.quoteAmount) }}</strong>
        </div>

        <el-tabs v-model="activeTab" class="quote-tabs">
          <el-tab-pane label="报价表单" name="form">
            <el-form :model="quoteForm" :disabled="!budgetEditable && !isNew" label-width="110px" size="small">
              <div class="form-grid">
                <el-form-item label="报价单号">
                  <el-input v-model="quoteForm.quoteNo" placeholder="保存时自动生成" />
                </el-form-item>
                <el-form-item label="客户">
                  <el-input v-model="quoteForm.customerName" />
                </el-form-item>
                <el-form-item label="产品/图号">
                  <el-input v-model="quoteForm.productNo" />
                </el-form-item>
                <el-form-item label="产品名称">
                  <el-input v-model="quoteForm.productName" />
                </el-form-item>
                <el-form-item label="模具类别">
                  <el-select v-model="quoteForm.quoteCategory" style="width: 100%" @change="handleCategoryChange">
                    <el-option v-for="(label, value) in CATEGORY_LABELS" :key="value" :label="label" :value="value" />
                  </el-select>
                </el-form-item>
                <el-form-item label="模具类型">
                  <el-select
                    v-if="quoteForm.quoteCategory === 'STAMPING'"
                    v-model="quoteForm.mouldType"
                    allow-create
                    default-first-option
                    filterable
                    style="width: 100%"
                  >
                    <el-option v-for="item in STAMPING_MOULD_TYPE_OPTIONS" :key="item" :label="item" :value="item" />
                  </el-select>
                  <el-input v-else v-model="quoteForm.mouldType" />
                </el-form-item>
                <el-form-item label="关联模具ID">
                  <el-input-number v-model="quoteForm.mouldId" :min="1" controls-position="right" style="width: 100%" />
                </el-form-item>
                <el-form-item label="关联模具">
                  <el-input v-model="quoteForm.mouldCode" />
                </el-form-item>
                <el-form-item label="模具名称">
                  <el-input v-model="quoteForm.mouldName" />
                </el-form-item>
                <el-form-item label="关联工单ID">
                  <el-input-number v-model="quoteForm.orderId" :min="1" controls-position="right" style="width: 100%" />
                </el-form-item>
                <el-form-item label="关联工单">
                  <el-input v-model="quoteForm.orderNo" />
                </el-form-item>
                <el-form-item label="报价日期">
                  <el-date-picker v-model="quoteForm.quoteDate" type="date" value-format="x" style="width: 100%" />
                </el-form-item>
                <el-form-item label="管理费率">
                  <el-input-number v-model="quoteForm.managementRate" :min="0" :precision="4" :step="0.01" controls-position="right" style="width: 100%" />
                </el-form-item>
                <el-form-item label="风险费率">
                  <el-input-number v-model="quoteForm.riskRate" :min="0" :precision="4" :step="0.01" controls-position="right" style="width: 100%" />
                </el-form-item>
                <el-form-item label="毛利率">
                  <el-input-number v-model="quoteForm.grossProfitRate" :min="0" :precision="4" :step="0.01" controls-position="right" style="width: 100%" />
                </el-form-item>
                <el-form-item label="税率">
                  <el-input-number v-model="quoteForm.taxRate" :min="0" :precision="4" :step="0.01" controls-position="right" style="width: 100%" />
                </el-form-item>
              </div>
              <el-form-item label="备注">
                <el-input v-model="quoteForm.remark" type="textarea" :rows="2" />
              </el-form-item>
            </el-form>

            <div class="section-title">
              <span>模具参数</span>
              <el-button size="small" :disabled="!budgetEditable && !isNew" @click="handleCategoryChange(quoteForm.quoteCategory || 'STAMPING')" :icon="'RefreshRight'">
                按类别重置
              </el-button>
            </div>
            <el-table :data="parameters" border size="small" stripe>
              <el-table-column type="index" width="50" align="center" />
              <el-table-column prop="paramName" label="字段" min-width="130">
                <template #default="{ row }">
                  <el-input v-model="row.paramName" :disabled="!budgetEditable && !isNew" />
                </template>
              </el-table-column>
              <el-table-column prop="paramKey" label="字段编码" min-width="140">
                <template #default="{ row }">
                  <el-input v-model="row.paramKey" :disabled="!budgetEditable && !isNew" />
                </template>
              </el-table-column>
              <el-table-column prop="paramValue" label="值" min-width="180">
                <template #default="{ row }">
                  <el-select
                    v-if="parameterValueOptions(row.paramKey).length"
                    v-model="row.paramValue"
                    :disabled="!budgetEditable && !isNew"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="item in parameterValueOptions(row.paramKey)"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                  <el-input v-else v-model="row.paramValue" :disabled="!budgetEditable && !isNew" />
                </template>
              </el-table-column>
              <el-table-column prop="valueType" label="类型" width="120">
                <template #default="{ row }">
                  <el-select v-model="row.valueType" :disabled="!budgetEditable && !isNew">
                    <el-option label="文本" value="TEXT" />
                    <el-option label="数字" value="NUMBER" />
                  </el-select>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="预算明细" name="budget">
            <div class="budget-summary-row">
              <div><span>材料</span><strong>{{ formatMoney(budgetSummary.MATERIAL) }}</strong></div>
              <div><span>人工</span><strong>{{ formatMoney(budgetSummary.LABOR) }}</strong></div>
              <div><span>工序委外</span><strong>{{ formatMoney(budgetSummary.OUTSOURCE) }}</strong></div>
              <div><span>其他费用</span><strong>{{ formatMoney(budgetSummary.OTHER) }}</strong></div>
            </div>

            <div class="detail-toolbar">
              <el-button :disabled="!budgetEditable" :icon="'Plus'" size="small" @click="addBudgetLine('MATERIAL')">材料</el-button>
              <el-button :disabled="!budgetEditable" :icon="'Plus'" size="small" @click="addBudgetLine('LABOR')">人工</el-button>
              <el-button :disabled="!budgetEditable" :icon="'Plus'" size="small" @click="addBudgetLine('OUTSOURCE')">委外</el-button>
              <el-button :disabled="!budgetEditable" :icon="'Plus'" size="small" @click="addBudgetLine('OTHER')">其他</el-button>
            </div>

            <el-table :data="budgetLines" border size="small" stripe>
              <el-table-column type="index" width="48" fixed="left" />
              <el-table-column prop="costCategory" label="分类" width="110" fixed="left">
                <template #default="{ row }">
                  <el-select v-model="row.costCategory" :disabled="!budgetEditable">
                    <el-option v-for="(label, value) in COST_CATEGORY_LABELS" :key="value" :label="label" :value="value" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column prop="itemName" label="项目" min-width="130" fixed="left">
                <template #default="{ row }">
                  <el-input v-model="row.itemName" :disabled="!budgetEditable" />
                </template>
              </el-table-column>
              <el-table-column prop="materialName" label="材质/材料" width="130">
                <template #default="{ row }">
                  <el-input v-model="row.materialName" :disabled="!budgetEditable" />
                </template>
              </el-table-column>
              <el-table-column prop="supplierName" label="供应商" width="130">
                <template #default="{ row }">
                  <el-input v-model="row.supplierName" :disabled="!budgetEditable" />
                </template>
              </el-table-column>
              <el-table-column prop="processName" label="工序" width="120">
                <template #default="{ row }">
                  <el-input v-model="row.processName" :disabled="!budgetEditable" />
                </template>
              </el-table-column>
              <el-table-column prop="lengthValue" label="长" width="110">
                <template #default="{ row }">
                  <el-input-number v-model="row.lengthValue" :disabled="!budgetEditable" :min="0" :precision="2" controls-position="right" />
                </template>
              </el-table-column>
              <el-table-column prop="widthValue" label="宽" width="110">
                <template #default="{ row }">
                  <el-input-number v-model="row.widthValue" :disabled="!budgetEditable" :min="0" :precision="2" controls-position="right" />
                </template>
              </el-table-column>
              <el-table-column prop="heightValue" label="高/厚" width="110">
                <template #default="{ row }">
                  <el-input-number v-model="row.heightValue" :disabled="!budgetEditable" :min="0" :precision="2" controls-position="right" />
                </template>
              </el-table-column>
              <el-table-column prop="density" label="密度" width="110">
                <template #default="{ row }">
                  <el-input-number v-model="row.density" :disabled="!budgetEditable" :min="0" :precision="4" controls-position="right" />
                </template>
              </el-table-column>
              <el-table-column prop="quantity" label="数量" width="110">
                <template #default="{ row }">
                  <el-input-number v-model="row.quantity" :disabled="!budgetEditable" :min="0" :precision="2" controls-position="right" />
                </template>
              </el-table-column>
              <el-table-column prop="unitPrice" label="单价" width="120">
                <template #default="{ row }">
                  <el-input-number v-model="row.unitPrice" :disabled="!budgetEditable" :min="0" :precision="4" controls-position="right" />
                </template>
              </el-table-column>
              <el-table-column prop="lossRate" label="损耗率" width="110">
                <template #default="{ row }">
                  <el-input-number v-model="row.lossRate" :disabled="!budgetEditable" :min="0" :precision="4" controls-position="right" />
                </template>
              </el-table-column>
              <el-table-column prop="workHours" label="工时" width="110">
                <template #default="{ row }">
                  <el-input-number v-model="row.workHours" :disabled="!budgetEditable" :min="0" :precision="2" controls-position="right" />
                </template>
              </el-table-column>
              <el-table-column label="系统金额" width="120" align="right">
                <template #default="{ row }">
                  <strong>{{ formatMoney(estimateLineAmount(row), 4) }}</strong>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="80" fixed="right" align="center">
                <template #default="{ $index }">
                  <el-button :disabled="!budgetEditable" text type="danger" size="small" @click="removeBudgetLine($index)" :icon="'Delete'">删除</el-button>
                </template>
              </el-table-column>
            </el-table>

            <el-descriptions class="quote-total" :column="4" border size="small">
              <el-descriptions-item label="直接成本">{{ formatMoney(quoteForm.directCost) }}</el-descriptions-item>
              <el-descriptions-item label="管理费">{{ formatMoney(quoteForm.managementFee) }}</el-descriptions-item>
              <el-descriptions-item label="风险费">{{ formatMoney(quoteForm.riskFee) }}</el-descriptions-item>
              <el-descriptions-item label="毛利">{{ formatMoney(quoteForm.grossProfit) }}</el-descriptions-item>
              <el-descriptions-item label="取整报价">{{ formatMoney(quoteForm.quoteAmount) }}</el-descriptions-item>
              <el-descriptions-item label="税额">{{ formatMoney(quoteForm.taxAmount) }}</el-descriptions-item>
              <el-descriptions-item label="含税报价">{{ formatMoney(quoteForm.taxIncludedAmount) }}</el-descriptions-item>
              <el-descriptions-item label="税率">{{ formatRate(quoteForm.taxRate) }}</el-descriptions-item>
            </el-descriptions>
          </el-tab-pane>

          <el-tab-pane label="规则追溯" name="trace">
            <el-table :data="calculationTrace" border size="small" stripe>
              <el-table-column prop="itemName" label="预算项" min-width="140" fixed="left" />
              <el-table-column prop="costCategory" label="分类" width="110">
                <template #default="{ row }">{{ COST_CATEGORY_LABELS[row.costCategory as MouldQuoteCostCategory] }}</template>
              </el-table-column>
              <el-table-column prop="sourceSheet" label="Sheet" width="110" />
              <el-table-column prop="sourceCell" label="公式格" width="90" />
              <el-table-column prop="formulaCode" label="规则编码" min-width="190" show-overflow-tooltip />
              <el-table-column prop="formulaText" label="计算方式" min-width="260" show-overflow-tooltip />
              <el-table-column prop="inputSnapshot" label="输入快照" min-width="260" show-overflow-tooltip />
              <el-table-column label="计算金额" width="130" align="right" fixed="right">
                <template #default="{ row }">{{ formatMoney(row.calculatedAmount ?? row.amount, 4) }}</template>
              </el-table-column>
            </el-table>

            <div class="section-title">
              <span>公式映射</span>
            </div>
            <el-table :data="formulaMappings" border size="small" stripe>
              <el-table-column prop="lineName" label="预算项" min-width="140" />
              <el-table-column prop="costCategory" label="分类" width="110">
                <template #default="{ row }">{{ COST_CATEGORY_LABELS[row.costCategory as MouldQuoteCostCategory] }}</template>
              </el-table-column>
              <el-table-column prop="sourceSheet" label="Sheet" width="110" />
              <el-table-column prop="sourceCell" label="公式格" width="100" />
              <el-table-column prop="formulaCode" label="规则编码" min-width="190" show-overflow-tooltip />
              <el-table-column prop="formulaText" label="Excel计算方式" min-width="260" show-overflow-tooltip />
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="规则参数" name="ruleParams">
            <el-table :data="ruleParameters" border size="small" stripe>
              <el-table-column prop="mouldType" label="模具类型" width="110" />
              <el-table-column prop="ruleCode" label="规则" width="110" />
              <el-table-column prop="paramName" label="参数" min-width="140" />
              <el-table-column prop="paramKey" label="编码" min-width="160" show-overflow-tooltip />
              <el-table-column prop="paramValue" label="值" width="120" />
              <el-table-column prop="valueType" label="类型" width="90" />
              <el-table-column prop="sourceSheet" label="Sheet" width="100" />
              <el-table-column prop="sourceCell" label="来源格" width="100" />
              <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="验收与成本复盘" name="review">
            <div class="detail-toolbar">
              <el-button :disabled="!actualCostEditable" :loading="actionLoading" :icon="'Refresh'" @click="handleSyncActualCosts">
                同步实际成本
              </el-button>
              <el-tag v-if="!actualCostEditable" type="info">验收后开放成本归集</el-tag>
            </div>

            <el-form :model="actualForm" inline size="small" :disabled="!actualCostEditable">
              <el-form-item label="分类">
                <el-select v-model="actualForm.costCategory" style="width: 120px">
                  <el-option v-for="item in ACTUAL_COST_CATEGORY_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
                </el-select>
              </el-form-item>
              <el-form-item label="项目">
                <el-input v-model="actualForm.itemName" style="width: 160px" />
              </el-form-item>
              <el-form-item label="金额">
                <el-input-number v-model="actualForm.amount" :min="0" :precision="4" controls-position="right" style="width: 140px" />
              </el-form-item>
              <el-form-item label="来源单据">
                <el-input v-model="actualForm.sourceBill" style="width: 160px" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="actualSaving" @click="handleAddActualCost" :icon="'Plus'">补录</el-button>
              </el-form-item>
            </el-form>

            <el-table :data="actualCosts" border size="small" stripe>
              <el-table-column prop="costCategory" label="分类" width="100">
                <template #default="{ row }">{{ COST_CATEGORY_LABELS[row.costCategory as MouldQuoteCostCategory] }}</template>
              </el-table-column>
              <el-table-column prop="itemName" label="项目" min-width="150" show-overflow-tooltip />
              <el-table-column label="金额" width="130" align="right">
                <template #default="{ row }">{{ formatMoney(row.amount, 4) }}</template>
              </el-table-column>
              <el-table-column prop="sourceType" label="来源" width="130" />
              <el-table-column prop="sourceBill" label="来源单据" min-width="150" show-overflow-tooltip />
              <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
            </el-table>

            <div class="section-title">
              <span>预算与实际对比</span>
            </div>
            <el-table :data="comparison" border size="small" stripe>
              <el-table-column prop="categoryName" label="维度" width="120" />
              <el-table-column label="预算" width="140" align="right">
                <template #default="{ row }">{{ formatMoney(row.budgetAmount, 4) }}</template>
              </el-table-column>
              <el-table-column label="实际" width="140" align="right">
                <template #default="{ row }">{{ formatMoney(row.actualAmount, 4) }}</template>
              </el-table-column>
              <el-table-column label="差异" width="140" align="right">
                <template #default="{ row }">
                  <el-tag :type="getVarianceType(row.varianceAmount)" size="small">
                    {{ formatMoney(row.varianceAmount, 4) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="差异率" width="120" align="right">
                <template #default="{ row }">{{ formatRate(row.varianceRate) }}</template>
              </el-table-column>
            </el-table>

            <div class="section-title">
              <span>流程记录</span>
            </div>
            <el-table :data="flowLogs" border size="small" stripe>
              <el-table-column prop="actionCode" label="动作" width="150" />
              <el-table-column label="状态变化" width="220">
                <template #default="{ row }">
                  {{ STATUS_LABELS[row.fromStatus as MouldQuoteStatus] || '-' }}
                  →
                  {{ STATUS_LABELS[row.toStatus as MouldQuoteStatus] || '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="operatorName" label="操作人" width="120" />
              <el-table-column label="时间" width="170">
                <template #default="{ row }">{{ formatTime(row.operateTime) }}</template>
              </el-table-column>
              <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </div>

      <template #footer>
        <div class="drawer-footer">
          <div class="footer-status">
            <el-tag :type="getStatusType(currentStatus)" size="small">{{ STATUS_LABELS[currentStatus] }}</el-tag>
            <span>{{ quoteForm.quoteNo || '未保存' }}</span>
          </div>
          <div class="footer-actions">
            <el-button @click="drawerVisible = false">关闭</el-button>
            <el-button v-if="budgetEditable" type="primary" :loading="saving" @click="saveCurrent(false)" :icon="'Edit'">保存</el-button>
            <el-button v-if="currentStatus === 'DRAFT'" type="success" :loading="saving || actionLoading" @click="handleSubmit" :icon="'Check'">提交</el-button>
            <el-button v-if="currentStatus === 'SUBMITTED'" type="warning" :loading="saving || actionLoading" @click="handleCalculate">
              计算报价
            </el-button>
            <el-button v-if="currentStatus === 'QUOTED'" type="primary" :loading="actionLoading" @click="runWorkflowAction(approveMouldQuote, '审核通过')" :icon="'Check'">
              审核
            </el-button>
            <el-button
              v-if="currentStatus === 'APPROVED'"
              type="success"
              :loading="actionLoading"
              @click="runWorkflowAction(customerConfirmMouldQuote, '客户已确认')" :icon="'Check'">
              客户确认
            </el-button>
            <el-button v-if="currentStatus === 'CUSTOMER_CONFIRMED'" type="success" :loading="actionLoading" @click="handleAccept" :icon="'Check'">
              验收
            </el-button>
          </div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.mould-quote-page {
  min-height: 100%;
  padding: 16px;
  background: #f5f7fb;
}

.summary-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.summary-item,
.toolbar-panel,
.table-panel {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  background: #fff;
}

.summary-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  padding: 14px 16px;
}

.summary-item span {
  color: #606266;
  font-size: 13px;
}

.summary-item strong {
  overflow: hidden;
  color: #1f2937;
  font-size: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px;
}

.toolbar-left,
.toolbar-right,
.detail-toolbar,
.drawer-footer,
.footer-actions,
.footer-status,
.quote-flow {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-left,
.toolbar-right {
  flex-wrap: wrap;
}

.table-panel {
  padding: 12px;
}

.pagination-area {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.drawer-body {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 150px);
}

.quote-flow {
  flex-wrap: wrap;
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  background: #fff;
  color: #606266;
  font-size: 13px;
}

.quote-flow strong {
  margin-left: auto;
  color: #1f2937;
  font-size: 18px;
}

.quote-tabs {
  flex: 1;
  min-height: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  column-gap: 12px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 14px 0 8px;
  color: #1f2937;
  font-weight: 600;
}

.budget-summary-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}

.budget-summary-row div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  background: #fff;
}

.budget-summary-row span {
  color: #606266;
  font-size: 13px;
}

.budget-summary-row strong {
  color: #1f2937;
}

.detail-toolbar {
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.quote-total {
  margin-top: 12px;
}

.drawer-footer {
  justify-content: space-between;
  width: 100%;
}

.footer-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.footer-actions :deep(.el-button),
.footer-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

@media (max-width: 1100px) {
  .summary-row,
  .budget-summary-row,
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .summary-row,
  .budget-summary-row,
  .form-grid {
    grid-template-columns: 1fr;
  }

  .toolbar-panel,
  .drawer-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .quote-flow strong {
    width: 100%;
    margin-left: 0;
  }
}
</style>
